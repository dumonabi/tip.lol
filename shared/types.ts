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
  /** gift (default) or collection (multi-token split). */
  kind: PageKind
  /** v1: always link. Future: seed unlock for collections. */
  accessMode: PageAccessMode
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
  /** When redeeming one token from a collection page. */
  tokenIndex?: number
}

export type TokenProofDetail = {
  index: number
  amountSats: number
}

export type TokenInsights = {
  proofSats: number[]
}

/** How a page is unlocked. v1: link only. v2: optional BIP39 seed gate on collections. */
export type PageAccessMode = 'link' | 'seed'

/** gift = single-token page (today). collection = multi-token page from a split. */
export type PageKind = 'gift' | 'collection'

/** POST /api/pages/:id/split-collection/preview */
export type SplitCollectionPreviewRequest = {
  /** Proof index groups — one array per output token. */
  parts: number[][]
}

export type SplitCollectionPartPreview = {
  amountSats: number
  proofSats: number[]
  proofCount: number
}

export type SplitCollectionPreview = {
  sourceAmountSats: number
  parts: SplitCollectionPartPreview[]
  outputTokenCount: number
  receiveTotalSats: number
}

/** POST /api/pages/:id/split-collection */
export type SplitCollectionRequest = {
  parts: number[][]
}

export type SplitCollectionResult = {
  page: GiftPage
  previousPageId: string
  tokenCount: number
}

/** POST /api/pages/:id/merge-collection */
export type MergeCollectionResult = {
  page: GiftPage
}

/** POST /api/pages/:id/detach-token */
export type DetachCollectionTokenRequest = {
  tokenIndex: number
}

export type DetachCollectionTokenResult = {
  giftPageId: string
  collectionPage: GiftPage
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
