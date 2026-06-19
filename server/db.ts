import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLAIMED_PAGE_TTL_MS,
  PAGE_TTL_MS,
  UNFUNDED_PAGE_TTL_MS,
  computeExpiresAt,
  type StoredToken,
} from '../shared/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATABASE_PATH
  ? dirname(process.env.DATABASE_PATH)
  : process.env.VERCEL
    ? '/tmp'
    : join(__dirname, '..', 'data')
const dbPath = process.env.DATABASE_PATH ?? join(dataDir, 'gift.db')

mkdirSync(dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS gift_pages (
    id TEXT PRIMARY KEY,
    memo TEXT,
    token TEXT,
    amount_sats INTEGER,
    unit TEXT,
    mint TEXT,
    created_at INTEGER NOT NULL,
    funded_at INTEGER,
    tokens_json TEXT,
    expires_at INTEGER,
    recipient_email TEXT,
    recipient_whatsapp TEXT,
    notify_via_whatsapp INTEGER DEFAULT 0
  );
`)

function ensureColumn(name: string, ddl: string): void {
  const cols = db.prepare(`PRAGMA table_info(gift_pages)`).all() as Array<{
    name: string
  }>
  if (!cols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE gift_pages ADD COLUMN ${ddl}`)
  }
}

ensureColumn('tokens_json', 'tokens_json TEXT')
ensureColumn('expires_at', 'expires_at INTEGER')
ensureColumn('recipient_email', 'recipient_email TEXT')
ensureColumn('recipient_whatsapp', 'recipient_whatsapp TEXT')
ensureColumn('notify_via_whatsapp', 'notify_via_whatsapp INTEGER DEFAULT 0')
ensureColumn('claimed_at', 'claimed_at INTEGER')
ensureColumn('claim_check_at', 'claim_check_at INTEGER')
ensureColumn('initial_amount_sats', 'initial_amount_sats INTEGER')

db.exec(
  `UPDATE gift_pages
   SET initial_amount_sats = amount_sats
   WHERE initial_amount_sats IS NULL
     AND amount_sats IS NOT NULL
     AND amount_sats > 0`,
)

export type GiftPageRow = {
  id: string
  memo: string | null
  token: string | null
  amount_sats: number | null
  unit: string | null
  mint: string | null
  created_at: number
  funded_at: number | null
  tokens_json: string | null
  expires_at: number | null
  recipient_email: string | null
  recipient_whatsapp: string | null
  notify_via_whatsapp: number | null
  claimed_at: number | null
  claim_check_at: number | null
  initial_amount_sats: number | null
}

function parseTokens(row: GiftPageRow): StoredToken[] {
  if (row.tokens_json) {
    try {
      return JSON.parse(row.tokens_json) as StoredToken[]
    } catch {
      return []
    }
  }
  if (row.token) {
    return [
      {
        token: row.token,
        amountSats: row.amount_sats ?? 0,
        unit: row.unit ?? 'sat',
        mint: row.mint ?? '',
        addedAt: row.funded_at ?? row.created_at,
      },
    ]
  }
  return []
}

function persistTokens(id: string, tokens: StoredToken[]): void {
  const single = tokens.slice(0, 1)
  const entry = single[0]
  db.prepare(
    `UPDATE gift_pages
     SET tokens_json = ?, token = ?, amount_sats = ?, unit = ?, mint = ?
     WHERE id = ?`,
  ).run(
    JSON.stringify(single),
    entry?.token ?? null,
    entry?.amountSats ?? 0,
    entry?.unit ?? 'sat',
    entry?.mint ?? null,
    id,
  )
}

export function insertPage(
  id: string,
  data: {
    memo: string | null
    recipientEmail: string | null
    recipientWhatsapp: string | null
    notifyViaWhatsapp: boolean
  },
): void {
  db.prepare(
    `INSERT INTO gift_pages (
      id, memo, created_at, recipient_email, recipient_whatsapp, notify_via_whatsapp
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.memo,
    Date.now(),
    data.recipientEmail,
    data.recipientWhatsapp,
    data.notifyViaWhatsapp ? 1 : 0,
  )
}

export function getPage(id: string): GiftPageRow | undefined {
  return db.prepare(`SELECT * FROM gift_pages WHERE id = ?`).get(id) as
    | GiftPageRow
    | undefined
}

export function getStoredTokens(row: GiftPageRow): StoredToken[] {
  const tokens = parseTokens(row)
  return tokens.length > 0 ? [tokens[0]] : []
}

export function normalizeToSingleToken(id: string): void {
  const row = getPage(id)
  if (!row) return
  const tokens = parseTokens(row)
  if (tokens.length <= 1) return
  persistTokens(id, [tokens[0]])
}

export function replacePageToken(
  id: string,
  entry: Omit<StoredToken, 'addedAt'>,
): void {
  const row = getPage(id)
  const addedAt = row ? parseTokens(row)[0]?.addedAt ?? Date.now() : Date.now()
  persistTokens(id, [{ ...entry, addedAt }])
}

export function clearPageTokenAndClaim(id: string, claimedAt = Date.now()): void {
  markPageClaimed(id, claimedAt)
  db.prepare(
    `UPDATE gift_pages
     SET tokens_json = '[]', token = NULL, amount_sats = 0
     WHERE id = ?`,
  ).run(id)
}

export function isExpired(row: GiftPageRow, now = Date.now()): boolean {
  if (!row.expires_at) return false
  return row.expires_at <= now
}

function isUnfunded(row: GiftPageRow): boolean {
  return parseTokens(row).length === 0
}

export function isClaimed(row: GiftPageRow): boolean {
  return row.claimed_at !== null
}

export function shouldDeletePage(row: GiftPageRow, now = Date.now()): boolean {
  if (row.claimed_at !== null) {
    return row.claimed_at < now - CLAIMED_PAGE_TTL_MS
  }
  if (isExpired(row)) return true
  if (isUnfunded(row)) {
    if (row.funded_at !== null) return true
    if (row.created_at < now - UNFUNDED_PAGE_TTL_MS) return true
  }
  return false
}

export function deletePage(id: string): void {
  db.prepare(`DELETE FROM gift_pages WHERE id = ?`).run(id)
}

export type CleanupResult = {
  unfunded: number
  expired: number
  empty: number
  claimed: number
}

export function cleanupStalePages(now = Date.now()): CleanupResult {
  const unfundedCutoff = now - UNFUNDED_PAGE_TTL_MS
  const claimedCutoff = now - CLAIMED_PAGE_TTL_MS

  const unfunded = db
    .prepare(
      `DELETE FROM gift_pages
       WHERE funded_at IS NULL
         AND token IS NULL
         AND (tokens_json IS NULL OR tokens_json = '[]')
         AND created_at < ?`,
    )
    .run(unfundedCutoff).changes

  const expired = db
    .prepare(
      `DELETE FROM gift_pages
       WHERE expires_at IS NOT NULL AND expires_at < ?`,
    )
    .run(now).changes

  const empty = db
    .prepare(
      `DELETE FROM gift_pages
       WHERE funded_at IS NOT NULL
         AND token IS NULL
         AND (tokens_json IS NULL OR tokens_json = '[]')
         AND claimed_at IS NULL`,
    )
    .run().changes

  const claimed = db
    .prepare(
      `DELETE FROM gift_pages
       WHERE claimed_at IS NOT NULL AND claimed_at < ?`,
    )
    .run(claimedCutoff).changes

  return { unfunded, expired, empty, claimed }
}

export function getPageIfActive(id: string): GiftPageRow | undefined {
  const row = getPage(id)
  if (!row) return undefined
  if (shouldDeletePage(row)) {
    deletePage(id)
    return undefined
  }
  return row
}

export function touchClaimCheck(id: string, checkedAt = Date.now()): void {
  db.prepare(`UPDATE gift_pages SET claim_check_at = ? WHERE id = ?`).run(
    checkedAt,
    id,
  )
}

export function markPageClaimed(id: string, claimedAt = Date.now()): void {
  db.prepare(`UPDATE gift_pages SET claimed_at = ? WHERE id = ?`).run(
    claimedAt,
    id,
  )
}

export function syncPrimaryTokenAfterRedeem(
  id: string,
  remaining: Omit<StoredToken, 'addedAt'> | null,
): { ok: boolean; reason?: string } {
  const row = getPage(id)
  if (!row) return { ok: false, reason: 'not_found' }
  if (isExpired(row)) return { ok: false, reason: 'expired' }
  if (isClaimed(row)) return { ok: false, reason: 'claimed' }

  const tokens = parseTokens(row)
  if (tokens.length === 0) return { ok: false, reason: 'empty' }

  const now = Date.now()

  if (remaining) {
    persistTokens(id, [
      { ...remaining, addedAt: tokens[0]?.addedAt ?? now },
    ])
    return { ok: true }
  }

  clearPageTokenAndClaim(id, now)
  return { ok: true }
}

export function addTokenToPage(
  id: string,
  entry: Omit<StoredToken, 'addedAt'>,
): { ok: boolean; reason?: string } {
  const row = getPage(id)
  if (!row) return { ok: false, reason: 'not_found' }
  if (isExpired(row)) return { ok: false, reason: 'expired' }

  const tokens = parseTokens(row)
  if (tokens.length > 0) {
    return { ok: false, reason: 'already_funded' }
  }

  const now = Date.now()
  persistTokens(id, [{ ...entry, addedAt: now }])

  const expiresAt = computeExpiresAt(now)
  db.prepare(
    `UPDATE gift_pages
     SET funded_at = COALESCE(funded_at, ?),
         expires_at = ?,
         initial_amount_sats = COALESCE(initial_amount_sats, ?)
     WHERE id = ?`,
  ).run(now, expiresAt, entry.amountSats, id)

  return { ok: true }
}

export function updatePageDetails(
  id: string,
  data: {
    memo?: string | null
    recipientEmail?: string | null
    recipientWhatsapp?: string | null
    notifyViaWhatsapp?: boolean
  },
): boolean {
  const row = getPage(id)
  if (!row) return false

  const memo =
    data.memo === undefined ? row.memo : data.memo?.slice(0, 140) ?? null
  const email =
    data.recipientEmail === undefined
      ? row.recipient_email
      : data.recipientEmail
  const whatsapp =
    data.recipientWhatsapp === undefined
      ? row.recipient_whatsapp
      : data.recipientWhatsapp
  const notify =
    data.notifyViaWhatsapp === undefined
      ? Boolean(row.notify_via_whatsapp)
      : data.notifyViaWhatsapp

  const result = db
    .prepare(
      `UPDATE gift_pages
       SET memo = ?, recipient_email = ?, recipient_whatsapp = ?, notify_via_whatsapp = ?
       WHERE id = ?`,
    )
    .run(memo, email, whatsapp, notify ? 1 : 0, id)

  return result.changes > 0
}

/** @deprecated use updatePageDetails */
export function updateContact(
  id: string,
  data: {
    recipientEmail?: string | null
    recipientWhatsapp?: string | null
    notifyViaWhatsapp?: boolean
  },
): boolean {
  return updatePageDetails(id, data)
}

export { PAGE_TTL_MS, UNFUNDED_PAGE_TTL_MS, CLAIMED_PAGE_TTL_MS }
