export const PAGE_TTL_MS = 365 * 24 * 60 * 60 * 1000

/** Unpublished pages (no Cashu attached) are removed after this */
export const UNFUNDED_PAGE_TTL_MS = 60 * 60 * 1000

/** Claimed pages stay visible with a message for this long, then are deleted */
export const CLAIMED_PAGE_TTL_MS = 14 * 24 * 60 * 60 * 1000

/** Conservative limit for static QR (level M) */
export const MAX_STATIC_QR_TOKEN_LENGTH = 1400

export type StoredToken = {
  token: string
  amountSats: number
  unit: string
  mint: string
  addedAt: number
}

export type GiftPage = {
  id: string
  memo: string | null
  funded: boolean
  expired: boolean
  claimed: boolean
  amountSats: number | null
  initialAmountSats: number | null
  partiallySpent: boolean
  unit: string | null
  mint: string | null
  tokens: StoredToken[]
  createdAt: number
  fundedAt: number | null
  expiresAt: number | null
  daysRemaining: number | null
  claimedAt: number | null
  claimedDaysRemaining: number | null
  recipientEmail: string | null
  recipientWhatsapp: string | null
  notifyViaWhatsapp: boolean
}

export type CreatePageRequest = {
  memo?: string
  recipientEmail?: string
  recipientWhatsapp?: string
  notifyViaWhatsapp?: boolean
}

export type CreatePageResponse = {
  id: string
  url: string
}

export type FundPageRequest = {
  token: string
  memo?: string | null
  recipientEmail?: string | null
  recipientWhatsapp?: string | null
  notifyViaWhatsapp?: boolean
}

export type UpdateContactRequest = {
  memo?: string | null
  recipientEmail?: string | null
  recipientWhatsapp?: string | null
  notifyViaWhatsapp?: boolean
}

export type SyncRedeemRequest = {
  remainingToken?: string | null
}

export type TokenOptimizePreview = {
  currentLength: number
  currentProofCount: number
  currentProofSats: number[]
  estimatedLength: number
  estimatedProofCount: number
  estimatedProofSats: number[]
  feeSats: number
  costLabel: string
  swapRequired: boolean
  currentlyStaticQr: boolean
  currentlyEmoji: boolean
  canReachStaticQr: boolean
  canReachEmoji: boolean
  estimatedReductionPercent: number
  worthOptimizing: boolean
  benefitSummary: string | null
  alreadyOptimal: boolean
}

export type TokenOptimizeResult = {
  page: GiftPage
  previousLength: number
  newLength: number
  previousProofCount: number
  newProofCount: number
  feeSats: number
  reachedStaticQr: boolean
  reachedEmoji: boolean
  reductionPercent: number
  benefitSummary: string | null
}

export type ResolveLightningInvoiceRequest = {
  address: string
  amountSats: number
}

export type ResolveLightningInvoiceResponse = {
  invoice: string
}

export type SpendOption = {
  name: string
  description: string
  url: string
  category: 'wallet' | 'redeem' | 'shop' | 'learn'
}

export function computeDaysRemaining(expiresAt: number | null, now = Date.now()): number | null {
  if (expiresAt === null) return null
  const msLeft = expiresAt - now
  if (msLeft <= 0) return 0
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000))
}

export function computeExpiresAt(fromMs = Date.now()): number {
  return fromMs + PAGE_TTL_MS
}
