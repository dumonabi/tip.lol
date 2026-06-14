/*! Based on emoji-encoder by Paul Butler / cashu-emoji (robwoodgate) */

const VARIATION_SELECTOR_START = 0xfe00
const VARIATION_SELECTOR_END = 0xfe0f
const VARIATION_SELECTOR_SUPPLEMENT_START = 0xe0100
const VARIATION_SELECTOR_SUPPLEMENT_END = 0xe01ef

/** Default emoji carrier when copying a token for chat apps */
export const CASHU_EMOJI_CARRIER = '😊'

export const EMOJI_CARRIER_OPTIONS = [
  { emoji: '😊', label: 'Smile' },
  { emoji: '🥜', label: 'Cashew' },
  { emoji: '₿', label: 'Bitcoin' },
  { emoji: '💸', label: 'Tip' },
  { emoji: '🎁', label: 'Present' },
  { emoji: '💝', label: 'Gift' },
  { emoji: '🪙', label: 'Coin' },
  { emoji: '💰', label: 'Money' },
  { emoji: '⚡', label: 'Lightning' },
  { emoji: '🧡', label: 'Heart' },
  { emoji: '🫶', label: 'Thanks' },
  { emoji: '🌰', label: 'Nut' },
  { emoji: '✨', label: 'Sparkle' },
  { emoji: '🧧', label: 'Envelope' },
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🤑', label: 'Cash' },
  { emoji: '💎', label: 'Gem' },
] as const

export type EmojiCarrier = (typeof EMOJI_CARRIER_OPTIONS)[number]['emoji']

function toVariationSelector(byte: number): string | null {
  if (byte >= 0 && byte < 16) {
    return String.fromCodePoint(VARIATION_SELECTOR_START + byte)
  }
  if (byte >= 16 && byte < 256) {
    return String.fromCodePoint(
      VARIATION_SELECTOR_SUPPLEMENT_START + byte - 16,
    )
  }
  return null
}

function fromVariationSelector(codePoint: number): number | null {
  if (
    codePoint >= VARIATION_SELECTOR_START &&
    codePoint <= VARIATION_SELECTOR_END
  ) {
    return codePoint - VARIATION_SELECTOR_START
  }
  if (
    codePoint >= VARIATION_SELECTOR_SUPPLEMENT_START &&
    codePoint <= VARIATION_SELECTOR_SUPPLEMENT_END
  ) {
    return codePoint - VARIATION_SELECTOR_SUPPLEMENT_START + 16
  }
  return null
}

export function encodeEmojiToken(
  token: string,
  emoji = CASHU_EMOJI_CARRIER,
): string {
  const bytes = new TextEncoder().encode(token)
  let encoded = emoji
  for (const byte of bytes) {
    const vs = toVariationSelector(byte)
    if (!vs) throw new Error('Token too large for emoji encoding')
    encoded += vs
  }
  return encoded
}

/** Emoji encoding is only practical for small tokens */
export const MAX_EMOJI_TOKEN_BYTES = 480

export function tryEncodeEmojiToken(
  token: string,
  emoji = CASHU_EMOJI_CARRIER,
): string | null {
  const bytes = new TextEncoder().encode(token)
  if (bytes.length > MAX_EMOJI_TOKEN_BYTES) return null
  try {
    return encodeEmojiToken(token, emoji)
  } catch {
    return null
  }
}

export function decodeEmojiToken(text: string): string {
  const decoded: number[] = []
  for (const char of text) {
    const byte = fromVariationSelector(char.codePointAt(0) ?? 0)
    if (byte === null && decoded.length > 0) break
    if (byte === null) continue
    decoded.push(byte)
  }
  if (decoded.length === 0) return ''
  return new TextDecoder().decode(new Uint8Array(decoded))
}

export function hasEmojiTokenPayload(text: string): boolean {
  for (const char of text) {
    if (fromVariationSelector(char.codePointAt(0) ?? 0) !== null) return true
  }
  return false
}

export function resolveTokenFromInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('cashu')) return trimmed

  if (trimmed.startsWith('http')) {
    try {
      const url = new URL(trimmed)
      const fromQuery = url.searchParams.get('token')
      if (fromQuery) return resolveTokenFromInput(fromQuery)
    } catch {
      // ignore
    }
  }

  if (hasEmojiTokenPayload(trimmed)) {
    const decoded = decodeEmojiToken(trimmed)
    if (decoded.startsWith('cashu')) return decoded
  }

  return null
}
