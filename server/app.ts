import { randomBytes } from 'node:crypto'
import { getTokenMetadata } from '@cashu/cashu-ts'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  addTokenToPage,
  cleanupStalePages,
  clearPageTokenAndClaim,
  getPage,
  getPageIfActive,
  getStoredTokens,
  insertPage,
  isClaimed,
  isExpired,
  normalizeToSingleToken,
  replacePageToken,
  syncPrimaryTokenAfterRedeem,
  touchClaimCheck,
  updatePageDetails,
  type GiftPageRow,
} from './db.js'
import { syncTokenWithMint } from './claim-check.js'
import { fetchLightningAddressInvoice } from './lnurl-pay.js'
import {
  CLAIMED_PAGE_TTL_MS,
  computeDaysRemaining,
  type CreatePageResponse,
  type GiftPage,
} from '../shared/types.js'
import { CASHU_EMOJI_CARRIER, resolveTokenFromInput } from '../shared/emoji-token.js'

const SLUG_BYTES = 32
const CLAIM_CHECK_INTERVAL_MS = 5 * 60 * 1000

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

  return {
    id: row.id,
    memo: row.memo,
    funded: !claimed && tokens.length > 0,
    expired,
    claimed,
    amountSats: row.amount_sats,
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

async function refreshTokenFromMint(row: GiftPageRow): Promise<void> {
  if (row.claimed_at !== null) return

  normalizeToSingleToken(row.id)
  const refreshed = getPage(row.id)
  if (!refreshed) return

  const tokens = getStoredTokens(refreshed)
  const primary = tokens[0]
  if (!primary) return

  const now = Date.now()
  if (
    refreshed.claim_check_at !== null &&
    now - refreshed.claim_check_at < CLAIM_CHECK_INTERVAL_MS
  ) {
    return
  }

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

function parseTokenInput(raw: string) {
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

      const parsed = parseTokenInput(rawToken)
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
      const remaining = rawRemaining ? parseTokenInput(rawRemaining) : null
      const result = syncPrimaryTokenAfterRedeem(id, remaining)

      if (!result.ok) {
        if (result.reason === 'expired') {
          return c.json({ error: 'This page has expired' }, 410)
        }
        if (result.reason === 'claimed') {
          return c.json({ error: 'This gift was already claimed' }, 410)
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
