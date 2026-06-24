import {
  getDecodedTokenBinary,
  getEncodedToken,
  getTokenMetadata,
  Wallet,
  type Proof,
} from '@cashu/cashu-ts'
import type { OutputDataLike } from '@cashu/cashu-ts'
import { getMintWallet } from './mint-wallet.js'

export class TokenContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenContextError'
  }
}

export type DecodedTokenContext = {
  meta: ReturnType<typeof getTokenMetadata>
  proofs: Proof[]
  totalSats: number
}

function decodeFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (/short keyset|map short keyset|no keysets to map/i.test(message)) {
    return 'This token uses compressed keyset IDs that need mint keys to decode.'
  }
  return 'Could not decode Cashu token proofs'
}

function mintLoadErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(message)) {
    return 'Could not reach the mint. Check your connection and try again.'
  }
  return 'Could not load mint keys for this token'
}

function stripCashuTokenWrapper(token: string): string {
  let normalized = token.trim()
  for (const prefix of ['web+cashu://', 'cashu://', 'cashu:']) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length)
      break
    }
  }
  if (normalized.startsWith('cashu')) {
    normalized = normalized.slice(5)
  }
  return normalized
}

function decodeBase64Url(payload: string): Uint8Array {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padding)
  return new Uint8Array(Buffer.from(padded, 'base64'))
}

/** v4 cashuB tokens: decode CBOR proofs without expanding keyset IDs (no mint). */
function decodeTokenV4Offline(token: string): DecodedTokenContext | null {
  const normalized = stripCashuTokenWrapper(token)
  if (!normalized.startsWith('B')) return null

  try {
    const cborBytes = decodeBase64Url(normalized.slice(1))
    const binary = new Uint8Array(5 + cborBytes.length)
    binary.set(new TextEncoder().encode('craw'), 0)
    binary[4] = 'B'.charCodeAt(0)
    binary.set(cborBytes, 5)

    const decoded = getDecodedTokenBinary(binary)
    if (!decoded.proofs?.length) return null

    const meta = getTokenMetadata(token)
    const totalSats = sumProofSats(decoded.proofs)
    if (totalSats <= 0) return null

    return { meta, proofs: decoded.proofs, totalSats }
  } catch {
    return null
  }
}

export type TokenProofIndexAmount = { index: number; amountSats: number }

function proofDetailsFromDecoded(proofs: Proof[]): TokenProofIndexAmount[] {
  return proofs.map((proof, index) => ({
    index,
    amountSats: proof.amount.toNumber(),
  }))
}

function proofDetailsFromMetadata(token: string): TokenProofIndexAmount[] | null {
  try {
    const meta = getTokenMetadata(token)
    if (!meta.incompleteProofs?.length) return null
    return meta.incompleteProofs.map((proof, index) => ({
      index,
      amountSats: proof.amount.toNumber(),
    }))
  } catch {
    return null
  }
}

function finalizeDecodedContext(
  token: string,
  proofs: Proof[],
): DecodedTokenContext {
  if (proofs.length === 0) {
    throw new TokenContextError('This token has no spendable proofs')
  }

  const meta = getTokenMetadata(token)
  const totalSats = sumProofSats(proofs)
  if (totalSats <= 0) {
    throw new TokenContextError('Token amount must be greater than zero')
  }

  return { meta, proofs, totalSats }
}

/** Decode proof composition from the token string alone — no mint network call. */
export function decodeTokenOffline(token: string): DecodedTokenContext {
  const v4 = decodeTokenV4Offline(token)
  if (v4) return v4

  let meta: ReturnType<typeof getTokenMetadata>
  try {
    meta = getTokenMetadata(token)
  } catch {
    throw new TokenContextError('Could not decode Cashu token')
  }

  const wallet = new Wallet(meta.mint, { unit: meta.unit })
  try {
    return finalizeDecodedContext(token, wallet.decodeToken(token).proofs)
  } catch (err) {
    throw new TokenContextError(decodeFailureMessage(err))
  }
}

/** Proof amounts for display — offline decode, then token metadata fallback. */
export function listTokenProofDetails(token: string): TokenProofIndexAmount[] {
  try {
    return proofDetailsFromDecoded(decodeTokenOffline(token).proofs)
  } catch {
    const fromMetadata = proofDetailsFromMetadata(token)
    if (fromMetadata?.length) return fromMetadata
    throw new TokenContextError('Could not decode Cashu token proofs')
  }
}

/** Full proof decode for split/merge — offline first, cached mint keys only if needed. */
export async function decodeTokenResolving(token: string): Promise<DecodedTokenContext> {
  try {
    return decodeTokenOffline(token)
  } catch (offlineErr) {
    let meta: ReturnType<typeof getTokenMetadata>
    try {
      meta = getTokenMetadata(token)
    } catch {
      throw offlineErr instanceof TokenContextError
        ? offlineErr
        : new TokenContextError('Could not decode Cashu token')
    }

    try {
      const wallet = await getMintWallet(meta.mint, meta.unit)
      return finalizeDecodedContext(token, wallet.decodeToken(token).proofs)
    } catch (err) {
      if (err instanceof TokenContextError) throw err
      throw new TokenContextError(mintLoadErrorMessage(err))
    }
  }
}

/** Proof amounts for display — uses mint decode only when offline paths fail. */
export async function resolveTokenProofDetails(token: string): Promise<TokenProofIndexAmount[]> {
  try {
    return listTokenProofDetails(token)
  } catch {
    const ctx = await decodeTokenResolving(token)
    return proofDetailsFromDecoded(ctx.proofs)
  }
}

export function encodeProofs(
  meta: ReturnType<typeof getTokenMetadata>,
  proofs: Proof[],
): string {
  return getEncodedToken({
    mint: meta.mint,
    proofs,
    unit: meta.unit,
  })
}

export function proofAmountsFromOutputs(outputs: OutputDataLike[] | undefined): number[] {
  if (!outputs?.length) return []
  return outputs
    .map((output) => output.blindedMessage.amount.toNumber())
    .sort((a, b) => b - a)
}

export function proofAmountsFromProofs(proofs: Proof[]): number[] {
  return proofs.map((proof) => proof.amount.toNumber()).sort((a, b) => b - a)
}

export function sumProofSats(proofs: Proof[]): number {
  return proofs.reduce((sum, proof) => sum + proof.amount.toNumber(), 0)
}
