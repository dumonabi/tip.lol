import {
  CheckStateEnum,
  Wallet,
  getEncodedToken,
  getTokenMetadata,
} from '@cashu/cashu-ts'
import type { StoredToken } from '../shared/types.js'

const walletCache = new Map<string, Wallet>()

async function getWallet(mintUrl: string, unit: string): Promise<Wallet> {
  const key = `${mintUrl}\0${unit}`
  let wallet = walletCache.get(key)
  if (!wallet) {
    wallet = new Wallet(mintUrl, { unit })
    await wallet.loadMint()
    walletCache.set(key, wallet)
  }
  return wallet
}

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

export async function syncTokenWithMint(
  tokenString: string,
): Promise<MintSyncResult> {
  try {
    const meta = getTokenMetadata(tokenString)
    const wallet = await getWallet(meta.mint, meta.unit)
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
