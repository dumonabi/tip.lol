import { randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  addTokenToPage,
  cleanupStalePages,
  clearPageTokenAndClaim,
  convertCollectionToGift,
  convertGiftToCollection,
  detachCollectionTokenToNewGift,
  fundCollectionPage,
  getPage,
  getPageAccessMode,
  getPageIfActive,
  getPageKind,
  getStoredTokens,
  insertPage,
  isClaimed,
  isExpired,
  normalizeToSingleToken,
  replacePageToken,
  replaceCollectionTokens,
  syncCollectionTokenAfterRedeem,
  syncPrimaryTokenAfterRedeem,
  touchClaimCheck,
  updatePageDetails,
  vacatePageFunding,
  type GiftPageRow,
} from './db.js'
import { fetchLightningAddressInvoice } from './lnurl-pay.js'
import {
  CLAIMED_PAGE_TTL_MS,
  computeDaysRemaining,
  type CreatePageResponse,
  type GiftPage,
  type SplitCollectionResult,
  type MergeCollectionResult,
  type DetachCollectionTokenResult,
  type TokenInsights,
} from '../shared/types.js'
import { CASHU_EMOJI_CARRIER, resolveTokenFromInput } from '../shared/emoji-token.js'
import { buildTokenInsights } from './token-insights.js'
import {
  executeSplitFromContext,
  previewSplitFromContext,
  SplitCollectionError,
  validateSplitProofParts,
} from './split-collection.js'
import { TokenContextError, decodeTokenResolving, resolveTokenProofDetails } from './token-context.js'
import { mergeTokensOffline, MergeCollectionError } from './merge-collection.js'
import {
  CLAIM_CHECK_INTERVAL_MS,
  SpendabilityError,
  isSpendabilityFresh,
  requireTokenFullySpendableUnlessFresh,
  requireTokensFullySpendableUnlessFresh,
  syncCollectionTokensWithMint,
} from './claim-check.js'
import { getBtcUsdPrice } from './btc-price.js'

const SLUG_BYTES = 32

let startupDone = false

export function ensureAppStartup() {
  if (startupDone) return
  startupDone = true
  const result = cleanupStalePages()
  const total = result.unfunded + result.expired + result.empty + result.claimed
  if (total > 0) {
    console.log(`[cleanup] startup: removed ${total} page(s)`, result)
  }
}

function makeSlug(): string {
  return randomBytes(SLUG_BYTES).toString('base64url')
}

function isValidSlug(id: string): boolean {
  return /^[A-Za-z0-9_-]{32,64}$/.test(id)
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('Invalid email address')
  }
  return trimmed.slice(0, 254)
}

function normalizeWhatsapp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Invalid WhatsApp number')
  }
  return digits
}

function rowToPublicPage(row: NonNullable<ReturnType<typeof getPage>>): GiftPage {
  const tokens = getStoredTokens(row)
  const claimed = isClaimed(row)
  const expired = !claimed && isExpired(row)
  const daysRemaining = computeDaysRemaining(row.expires_at)
  const claimedDaysRemaining =
    claimed && row.claimed_at !== null
      ? computeDaysRemaining(row.claimed_at + CLAIMED_PAGE_TTL_MS)
      : null
  const amountSats = row.amount_sats
  const initialAmountSats = row.initial_amount_sats
  const partiallySpent =
    !claimed &&
    tokens.length > 0 &&
    initialAmountSats != null &&
    amountSats != null &&
    amountSats < initialAmountSats

  return {
    id: row.id,
    kind: getPageKind(row),
    accessMode: getPageAccessMode(row),
    memo: row.memo,
    funded: !claimed && tokens.length > 0,
    expired,
    claimed,
    amountSats,
    initialAmountSats,
    partiallySpent,
    unit: row.unit,
    mint: row.mint,
    tokens: claimed || expired ? [] : tokens,
    createdAt: row.created_at,
    fundedAt: row.funded_at,
    expiresAt: row.expires_at,
    daysRemaining,
    claimedAt: row.claimed_at,
    claimedDaysRemaining,
    recipientEmail: row.recipient_email,
    recipientWhatsapp: row.recipient_whatsapp,
    notifyViaWhatsapp: Boolean(row.notify_via_whatsapp),
  }
}

async function refreshTokenFromMint(
  row: GiftPageRow,
  options: { force?: boolean } = {},
): Promise<void> {
  if (row.claimed_at !== null) return

  const now = Date.now()
  if (
    !options.force &&
    row.claim_check_at !== null &&
    now - row.claim_check_at < CLAIM_CHECK_INTERVAL_MS
  ) {
    return
  }

  if (getPageKind(row) === 'collection') {
    const tokens = getStoredTokens(row)
    if (tokens.length === 0) return

    const result = await syncCollectionTokensWithMint(tokens)
    if (!result.checkedAny) return

    touchClaimCheck(row.id, now)
    if (result.changed) {
      replaceCollectionTokens(row.id, result.tokens)
    }
    return
  }

  const { syncTokenWithMint } = await import('./claim-check.js')

  normalizeToSingleToken(row.id)
  const refreshed = getPage(row.id)
  if (!refreshed) return

  const tokens = getStoredTokens(refreshed)
  const primary = tokens[0]
  if (!primary) return

  const sync = await syncTokenWithMint(primary.token)
  if (!sync.ok) return

  touchClaimCheck(refreshed.id, now)

  if (sync.status === 'claimed') {
    clearPageTokenAndClaim(refreshed.id, now)
  } else if (sync.status === 'updated') {
    replacePageToken(refreshed.id, {
      token: sync.token,
      amountSats: sync.amountSats,
      unit: sync.unit,
      mint: sync.mint,
    })
  }
}

async function parseTokenInput(raw: string) {
  const { getTokenMetadata } = await import('@cashu/cashu-ts')
  const token = resolveTokenFromInput(raw)
  if (!token) {
    throw new Error(`Invalid Cashu token (paste cashuB… or ${CASHU_EMOJI_CARRIER} emoji token)`)
  }

  let meta
  try {
    meta = getTokenMetadata(token)
  } catch {
    throw new Error('Could not decode Cashu token')
  }

  const amountSats = meta.amount.toNumber()
  if (amountSats <= 0) {
    throw new Error('Token amount must be greater than zero')
  }

  return {
    token,
    amountSats,
    unit: meta.unit,
    mint: meta.mint,
  }
}

function getFundedPageToken(id: string, options: { allowCollection?: boolean } = {}) {
  const row = getPageIfActive(id)
  if (!row) return { error: 'Page not found' as const, status: 404 as const }
  if (isClaimed(row)) {
    return { error: 'This gift was already claimed' as const, status: 410 as const }
  }
  if (isExpired(row)) {
    return { error: 'This page has expired' as const, status: 410 as const }
  }
  const tokens = getStoredTokens(row)
  if (getPageKind(row) === 'collection' && !options.allowCollection) {
    return {
      error: 'This action is only available on a single-token gift page' as const,
      status: 409 as const,
    }
  }
  const primary = tokens[0]
  if (!primary) {
    return { error: 'This page has no token yet' as const, status: 409 as const }
  }
  return { row, primary, tokens }
}

function splitCollectionErrorResponse(err: unknown) {
  const message =
    err instanceof SplitCollectionError
      ? err.message
      : err instanceof SpendabilityError
        ? err.message
        : err instanceof TokenContextError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Split collection request failed'
  const status =
    err instanceof SpendabilityError ? (err.httpStatus as 400 | 409 | 503) : (400 as const)
  return { body: { error: message }, status }
}

function mergeCollectionErrorResponse(err: unknown) {
  const message =
    err instanceof MergeCollectionError
      ? err.message
      : err instanceof SpendabilityError
        ? err.message
        : err instanceof TokenContextError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Merge collection request failed'
  const status =
    err instanceof SpendabilityError ? (err.httpStatus as 400 | 409 | 503) : (400 as const)
  return { body: { error: message }, status }
}

export function createApp() {
  ensureAppStartup()

  const app = new Hono()

  app.use('/api/*', cors())

  app.post('/api/pages', async (c) => {
    const body = await c.req.json().catch(() => ({}))

    try {
      const memo = typeof body.memo === 'string' ? body.memo.slice(0, 140) : null
      const recipientEmail = normalizeEmail(body.recipientEmail)
      const recipientWhatsapp = normalizeWhatsapp(body.recipientWhatsapp)
      const notifyViaWhatsapp = Boolean(body.notifyViaWhatsapp)
      const id = makeSlug()

      insertPage(id, {
        memo,
        recipientEmail,
        recipientWhatsapp,
        notifyViaWhatsapp,
      })

      const origin = c.req.header('origin') || `http://localhost:5173`
      const url = `${origin}/g/${id}`

      return c.json({ id, url } satisfies CreatePageResponse)
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Invalid request' },
        400,
      )
    }
  })

  app.get('/api/pages/:id', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const row = getPageIfActive(id)
    if (!row) {
      return c.json({ error: 'Page not found' }, 404)
    }

    await refreshTokenFromMint(row)

    const active = getPageIfActive(id)
    if (!active) {
      return c.json({ error: 'Page not found' }, 404)
    }

    return c.json(rowToPublicPage(active))
  })

  app.post('/api/pages/:id/fund', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const row = getPageIfActive(id)
    if (!row) {
      return c.json({ error: 'Page not found' }, 404)
    }
    if (isExpired(row)) {
      return c.json({ error: 'This page has expired' }, 410)
    }
    if (isClaimed(row)) {
      return c.json({ error: 'This gift was already claimed' }, 410)
    }

    const body = await c.req.json().catch(() => null)
    const rawToken = body && typeof body.token === 'string' ? body.token : ''

    try {
      if (body && typeof body === 'object') {
        const memo =
          body.memo === undefined
            ? undefined
            : typeof body.memo === 'string'
              ? body.memo.slice(0, 140) || null
              : null
        const recipientEmail =
          body.recipientEmail === undefined
            ? undefined
            : normalizeEmail(body.recipientEmail ?? '')
        const recipientWhatsapp =
          body.recipientWhatsapp === undefined
            ? undefined
            : normalizeWhatsapp(body.recipientWhatsapp ?? '')
        const notifyViaWhatsapp =
          body.notifyViaWhatsapp === undefined
            ? undefined
            : Boolean(body.notifyViaWhatsapp)

        updatePageDetails(id, {
          memo,
          recipientEmail,
          recipientWhatsapp,
          notifyViaWhatsapp,
        })
      }

      const parsed = await parseTokenInput(rawToken)
      const result = addTokenToPage(id, parsed)

      if (!result.ok) {
        if (result.reason === 'expired') {
          return c.json({ error: 'This page has expired' }, 410)
        }
        if (result.reason === 'already_funded') {
          return c.json({ error: 'This page already has a token' }, 409)
        }
        return c.json({ error: 'Could not fund page' }, 409)
      }

      const updated = getPageIfActive(id)
      if (!updated) {
        return c.json({ error: 'Page not found' }, 404)
      }
      return c.json(rowToPublicPage(updated))
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Invalid token' },
        400,
      )
    }
  })

  app.post('/api/pages/:id/redeem-sync', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const row = getPageIfActive(id)
    if (!row) {
      return c.json({ error: 'Page not found' }, 404)
    }
    if (isClaimed(row)) {
      return c.json({ error: 'This gift was already claimed' }, 410)
    }

    const body = await c.req.json().catch(() => ({}))
    const rawRemaining =
      body.remainingToken === undefined
        ? null
        : typeof body.remainingToken === 'string'
          ? body.remainingToken
          : null

    if (body.remainingToken !== undefined && body.remainingToken !== null && !rawRemaining) {
      return c.json({ error: 'Invalid remaining token' }, 400)
    }

    try {
      const remaining = rawRemaining ? await parseTokenInput(rawRemaining) : null
      const tokenIndex =
        typeof body.tokenIndex === 'number' && Number.isInteger(body.tokenIndex)
          ? body.tokenIndex
          : 0
      const result =
        getPageKind(row) === 'collection'
          ? syncCollectionTokenAfterRedeem(id, tokenIndex, remaining)
          : syncPrimaryTokenAfterRedeem(id, remaining)

      if (!result.ok) {
        if (result.reason === 'expired') {
          return c.json({ error: 'This page has expired' }, 410)
        }
        if (result.reason === 'claimed') {
          return c.json({ error: 'This gift was already claimed' }, 410)
        }
        if (result.reason === 'invalid_token') {
          return c.json({ error: 'Token not found in collection' }, 404)
        }
        return c.json({ error: 'Could not update gift page' }, 409)
      }

      const synced = getPage(id)
      if (synced) {
        await refreshTokenFromMint(synced)
      }

      const updated = getPageIfActive(id)
      if (!updated) {
        return c.json({ error: 'Page not found' }, 404)
      }
      return c.json(rowToPublicPage(updated))
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Invalid token' },
        400,
      )
    }
  })

  app.get('/api/pages/:id/token-proofs', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const funded = getFundedPageToken(id, { allowCollection: true })
    if ('error' in funded) {
      return c.json({ error: funded.error }, funded.status)
    }

    const tokenIndex = Number(c.req.query('tokenIndex') ?? 0)
    const tokenEntry =
      getPageKind(funded.row) === 'collection'
        ? funded.tokens[tokenIndex]
        : funded.primary
    if (!tokenEntry) {
      return c.json({ error: 'Token not found in collection' }, 404)
    }

    try {
      const proofs = await resolveTokenProofDetails(tokenEntry.token)
      return c.json({ proofs })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not read token proofs'
      return c.json({ error: message }, 400)
    }
  })

  app.post('/api/pages/:id/token-insights', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const funded = getFundedPageToken(id)
    if ('error' in funded) {
      return c.json({ error: funded.error }, funded.status)
    }

    try {
      const insights = buildTokenInsights(funded.primary.token)
      return c.json(insights satisfies TokenInsights)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not load token insights'
      return c.json({ error: message }, 400)
    }
  })

  app.post('/api/pages/:id/split-collection/preview', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const funded = getFundedPageToken(id)
    if ('error' in funded) {
      return c.json({ error: funded.error }, funded.status)
    }

    const body = await c.req.json().catch(() => ({}))
    try {
      await requireTokenFullySpendableUnlessFresh(
        funded.row.claim_check_at,
        funded.primary.token,
      )
      const ctx = await decodeTokenResolving(funded.primary.token)
      const parts = validateSplitProofParts(body.parts, ctx.proofs.length)
      const preview = previewSplitFromContext(ctx, parts)
      return c.json(preview)
    } catch (err) {
      const { body: errBody, status } = splitCollectionErrorResponse(err)
      return c.json(errBody, status)
    }
  })

  app.post('/api/pages/:id/split-collection', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const funded = getFundedPageToken(id)
    if ('error' in funded) {
      return c.json({ error: funded.error }, funded.status)
    }

    const body = await c.req.json().catch(() => ({}))
    try {
      await requireTokenFullySpendableUnlessFresh(
        funded.row.claim_check_at,
        funded.primary.token,
      )
      const ctx = await decodeTokenResolving(funded.primary.token)
      const parts = validateSplitProofParts(body.parts, ctx.proofs.length)
      const result = executeSplitFromContext(ctx, parts)

      const converted = convertGiftToCollection(
        id,
        result.tokens.map((entry) => ({
          token: entry.token,
          amountSats: entry.amountSats,
          unit: entry.unit,
          mint: entry.mint,
        })),
      )

      if (!converted.ok) {
        const message =
          converted.reason === 'already_collection'
            ? 'This page is already a collection'
            : converted.reason === 'not_funded'
              ? 'This page has no token yet'
              : 'Could not convert this page into a collection'
        return c.json({ error: message }, 500)
      }

      const updated = getPageIfActive(id)
      if (!updated) {
        return c.json({ error: 'Page not found' }, 500)
      }

      const response: SplitCollectionResult = {
        page: rowToPublicPage(updated),
        previousPageId: id,
        tokenCount: result.tokens.length,
      }
      return c.json(response)
    } catch (err) {
      const { body: errBody, status } = splitCollectionErrorResponse(err)
      return c.json(errBody, status)
    }
  })

  app.post('/api/pages/:id/merge-collection', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const funded = getFundedPageToken(id, { allowCollection: true })
    if ('error' in funded) {
      return c.json({ error: funded.error }, funded.status)
    }
    if (getPageKind(funded.row) !== 'collection') {
      return c.json({ error: 'This page is not a token collection' }, 409)
    }
    if (funded.tokens.length < 2) {
      return c.json({ error: 'Need at least two tokens to merge' }, 400)
    }

    try {
      if (!isSpendabilityFresh(funded.row.claim_check_at)) {
        await refreshTokenFromMint(funded.row)
      }

      const current = getFundedPageToken(id, { allowCollection: true })
      if ('error' in current) {
        return c.json({ error: current.error }, current.status)
      }
      if (getPageKind(current.row) !== 'collection') {
        return c.json({ error: 'This page is not a token collection' }, 409)
      }
      if (current.tokens.length < 2) {
        return c.json(
          {
            error:
              current.tokens.length === 0
                ? 'All tokens in this collection were already spent'
                : 'Need at least two tokens to merge',
          },
          409,
        )
      }

      await requireTokensFullySpendableUnlessFresh(
        current.row.claim_check_at,
        current.tokens.map((entry) => entry.token),
      )
      const merged = await mergeTokensOffline(current.tokens.map((entry) => entry.token))
      convertCollectionToGift(id, {
        token: merged.token,
        amountSats: merged.amountSats,
        unit: merged.unit,
        mint: merged.mint,
      })

      const updated = getPageIfActive(id)
      if (!updated) {
        return c.json({ error: 'Page not found' }, 500)
      }

      const response: MergeCollectionResult = {
        page: rowToPublicPage(updated),
      }
      return c.json(response)
    } catch (err) {
      const { body: errBody, status } = mergeCollectionErrorResponse(err)
      return c.json(errBody, status)
    }
  })

  app.post('/api/pages/:id/detach-token', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const funded = getFundedPageToken(id, { allowCollection: true })
    if ('error' in funded) {
      return c.json({ error: funded.error }, funded.status)
    }
    if (getPageKind(funded.row) !== 'collection') {
      return c.json({ error: 'This page is not a token collection' }, 409)
    }

    const body = await c.req.json().catch(() => ({}))
    const tokenIndex = body.tokenIndex
    if (typeof tokenIndex !== 'number' || !Number.isInteger(tokenIndex) || tokenIndex < 0) {
      return c.json({ error: 'Invalid token index' }, 400)
    }
    if (!funded.tokens[tokenIndex]) {
      return c.json({ error: 'Token not found in collection' }, 404)
    }

    try {
      const tokenEntry = funded.tokens[tokenIndex]!
      await requireTokenFullySpendableUnlessFresh(
        funded.row.claim_check_at,
        tokenEntry.token,
      )

      const newId = makeSlug()
      const detached = detachCollectionTokenToNewGift(id, newId, tokenIndex)
      if (detached.ok === false) {
        const { reason } = detached
        const message =
          reason === 'invalid_token'
            ? 'Token not found in collection'
            : reason === 'not_collection'
              ? 'This page is not a token collection'
              : reason === 'expired'
                ? 'This page has expired'
                : reason === 'claimed'
                  ? 'This gift was already claimed'
                  : 'Could not open token as its own page'
        const status = reason === 'expired' || reason === 'claimed' ? 410 : 409
        return c.json({ error: message }, status)
      }

      const collection = getPageIfActive(id)
      if (!collection) {
        return c.json({ error: 'Collection page not found' }, 500)
      }

      const response: DetachCollectionTokenResult = {
        giftPageId: newId,
        collectionPage: rowToPublicPage(collection),
      }
      return c.json(response)
    } catch (err) {
      const { body: errBody, status } = splitCollectionErrorResponse(err)
      return c.json(errBody, status)
    }
  })

  app.patch('/api/pages/:id/contact', async (c) => {
    const id = c.req.param('id')
    if (!isValidSlug(id)) {
      return c.json({ error: 'Invalid page id' }, 400)
    }

    const existing = getPageIfActive(id)
    if (!existing) {
      return c.json({ error: 'Page not found' }, 404)
    }

    const body = await c.req.json().catch(() => ({}))

    try {
      const recipientEmail =
        body.recipientEmail === undefined
          ? undefined
          : normalizeEmail(body.recipientEmail ?? '')
      const recipientWhatsapp =
        body.recipientWhatsapp === undefined
          ? undefined
          : normalizeWhatsapp(body.recipientWhatsapp ?? '')
      const notifyViaWhatsapp =
        body.notifyViaWhatsapp === undefined
          ? undefined
          : Boolean(body.notifyViaWhatsapp)
      const memo =
        body.memo === undefined
          ? undefined
          : typeof body.memo === 'string'
            ? body.memo.slice(0, 140) || null
            : null

      const ok = updatePageDetails(id, {
        memo,
        recipientEmail,
        recipientWhatsapp,
        notifyViaWhatsapp,
      })

      if (!ok) {
        return c.json({ error: 'Page not found' }, 404)
      }

      const updated = getPageIfActive(id)
      if (!updated) {
        return c.json({ error: 'Page not found' }, 404)
      }
      return c.json(rowToPublicPage(updated))
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : 'Invalid contact details' },
        400,
      )
    }
  })

  app.get('/api/btc-usd', async (c) => {
    const usd = await getBtcUsdPrice()
    if (usd == null) {
      return c.json({ error: 'BTC price unavailable' }, 503)
    }
    return c.json({ usd })
  })

  app.post('/api/lightning/invoice', async (c) => {
    try {
      const body = await c.req.json()
      const address = typeof body.address === 'string' ? body.address.trim() : ''
      const amountSats = Number(body.amountSats)

      if (!address) {
        return c.json({ error: 'Lightning Address is required' }, 400)
      }
      if (!Number.isFinite(amountSats) || amountSats <= 0) {
        return c.json({ error: 'Amount must be at least 1 sat' }, 400)
      }

      const invoice = await fetchLightningAddressInvoice(address, amountSats)
      return c.json({ invoice })
    } catch (err) {
      return c.json(
        {
          error:
            err instanceof Error
              ? err.message
              : 'Could not resolve Lightning Address',
        },
        400,
      )
    }
  })

  return app
}

export const app = createApp()
