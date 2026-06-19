import { MAX_STATIC_QR_TOKEN_LENGTH } from './qr-token'

/** Smallest static-friendly amounts: one proof each (powers of 2 sats). */
export const STATIC_FRIENDLY_SATS = [
  1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768,
  65536,
] as const

export type QrDisplayKind = 'static' | 'animated'

export function qrDisplayKind(token: string): QrDisplayKind {
  return token.length <= MAX_STATIC_QR_TOKEN_LENGTH ? 'static' : 'animated'
}

/** How many proofs a greedy power-of-2 split would use (upper bound for typical sends). */
export function greedyProofCount(sats: number): number {
  if (!Number.isFinite(sats) || sats <= 0) return 0
  let n = Math.floor(sats)
  let count = 0
  while (n > 0) {
    if (n & 1) count++
    n >>= 1
  }
  return count
}

export function staticQrHintForToken(token: string): string | null {
  if (qrDisplayKind(token) === 'static') return null
  return 'This gift uses an animated QR because the token is large. Keep the camera steady until scanning finishes, or use Copy as text.'
}

export const LOAD_TOKEN_QR_ADVICE =
  'For a simple one-scan QR, prefer round powers of 2 (e.g. 64, 128, 256, 512, 1024 sats). Amounts that need many proofs (like 1023 or 2047) may produce an animated QR instead.'
