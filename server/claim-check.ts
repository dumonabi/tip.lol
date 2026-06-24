import {
  CheckStateEnum,
  getEncodedToken,
  getTokenMetadata,
} from '@cashu/cashu-ts'
import type { StoredToken } from '../shared/types.js'
import { listTokenProofDetails } from './token-context.js'
import { getMintWallet } from './mint-wallet.js'

/** Reuse a recent mint spendability check (same window as page refresh). */
export const CLAIM_CHECK_INTERVAL_MS = 5 * 60 * 1000

export function isSpendabilityFresh(
  claimCheckAt: number | null,
  now = Date.now(),
): boolean {
  if (claimCheckAt === null) return false
  return now - claimCheckAt < CLAIM_CHECK_INTERVAL_MS
}

export {
  getMintWallet,
  isMintWalletCached,
} from './mint-wallet.js'

export type MintSyncResult =
  | { ok: true; status: 'unchanged' }
  | { ok: true; status: 'claimed' }
  | {
      ok: true
      status: 'updated'
      token: string
      amountSats: number
      unit: string
      mint: string
    }
  | { ok: false; reason: 'unavailable' }

export class SpendabilityError extends Error {
  readonly httpStatus: number

  constructor(message: string, httpStatus = 409) {
    super(message)
    this.name = 'SpendabilityError'
    this.httpStatus = httpStatus
  }
}

/** Reject if any proof was spent, or if the mint cannot be reached to verify. */
export async function requireTokenFullySpendable(tokenString: string): Promise<void> {
  const result = await syncTokenWithMint(tokenString)
  if (!result.ok) {
    throw new SpendabilityError(
      'Could not verify this token with the mint — check your connection and try again',
      503,
    )
  }
  if (result.status === 'claimed') {
    throw new SpendabilityError('This token was already spent')
  }
  if (result.status === 'updated') {
    throw new SpendabilityError(
      'Part of this token was already spent — refresh the page before splitting or merging',
    )
  }
}

export async function requireTokensFullySpendable(tokenStrings: string[]): Promise<void> {
  for (const tokenString of tokenStrings) {
    await requireTokenFullySpendable(tokenString)
  }
}

export async function requireTokenFullySpendableUnlessFresh(
  claimCheckAt: number | null,
  tokenString: string,
): Promise<void> {
  if (isSpendabilityFresh(claimCheckAt)) return
  await requireTokenFullySpendable(tokenString)
}

export async function requireTokensFullySpendableUnlessFresh(
  claimCheckAt: number | null,
  tokenStrings: string[],
): Promise<void> {
  if (isSpendabilityFresh(claimCheckAt)) return
  await requireTokensFullySpendable(tokenStrings)
}

export type CollectionMintSyncResult = {
  tokens: StoredToken[]
  changed: boolean
  checkedAny: boolean
}

/** Sync each collection entry with the mint; drop fully spent tokens, shrink partial spends. */
export async function syncCollectionTokensWithMint(
  tokens: StoredToken[],
): Promise<CollectionMintSyncResult> {
  const updated: StoredToken[] = []
  let changed = false
  let checkedAny = false

  for (const entry of tokens) {
    const sync = await syncTokenWithMint(entry.token)
    if (!sync.ok) {
      updated.push(entry)
      continue
    }

    checkedAny = true

    if (sync.status === 'claimed') {
      changed = true
      continue
    }

    if (sync.status === 'updated') {
      changed = true
      updated.push({
        token: sync.token,
        amountSats: sync.amountSats,
        unit: sync.unit,
        mint: sync.mint,
        addedAt: entry.addedAt,
      })
      continue
    }

    updated.push(entry)
  }

  return { tokens: updated, changed, checkedAny }
}

export async function syncTokenWithMint(
  tokenString: string,
): Promise<MintSyncResult> {
  try {
    const meta = getTokenMetadata(tokenString)
    const wallet = await getMintWallet(meta.mint, meta.unit)
    const decoded = wallet.decodeToken(tokenString)
    if (decoded.proofs.length === 0) return { ok: false, reason: 'unavailable' }

    const states = await wallet.checkProofsStates(
      decoded.proofs.map((proof) => ({ secret: proof.secret, id: proof.id })),
    )

    const unspentProofs = decoded.proofs.filter(
      (_, index) => states[index]?.state !== CheckStateEnum.SPENT,
    )

    if (unspentProofs.length === 0) {
      return { ok: true, status: 'claimed' }
    }

    if (unspentProofs.length === decoded.proofs.length) {
      return { ok: true, status: 'unchanged' }
    }

    const remainingToken = getEncodedToken({
      mint: meta.mint,
      proofs: unspentProofs,
      unit: meta.unit,
    })
    const remainingMeta = getTokenMetadata(remainingToken)

    return {
      ok: true,
      status: 'updated',
      token: remainingToken,
      amountSats: remainingMeta.amount.toNumber(),
      unit: meta.unit,
      mint: meta.mint,
    }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

/** @deprecated use syncTokenWithMint */
export async function isTokenFullySpent(
  tokenString: string,
): Promise<boolean | null> {
  const result = await syncTokenWithMint(tokenString)
  if (!result.ok) return null
  return result.status === 'claimed'
}

export async function areAllTokensSpent(
  tokens: StoredToken[],
): Promise<boolean | null> {
  const primary = tokens[0]
  if (!primary) return null
  return isTokenFullySpent(primary.token)
}

/** Individual proofs in wallet decode order (stable indices for split). */
export function listTokenProofDetailsSync(tokenString: string) {
  return listTokenProofDetails(tokenString)
}

/** Individual proof amounts in sats, largest first. Offline. */
export function listTokenProofSats(tokenString: string): number[] {
  const details = listTokenProofDetailsSync(tokenString)
  return details.map((proof) => proof.amountSats).sort((a, b) => b - a)
}
