import { UR, UREncoder } from '@gandlaf21/bc-ur'

/** NGRAVE / Cashu wallets commonly use 200-byte UR fragments */
export const UR_FRAGMENT_MAX_LENGTH = 200

export const UR_FRAME_INTERVAL_MS = 300

export function createTokenUrEncoder(token: string): UREncoder {
  const bytes = new TextEncoder().encode(token)
  const ur = UR.from(bytes)
  return new UREncoder(ur, UR_FRAGMENT_MAX_LENGTH, 0)
}
