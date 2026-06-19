import type {
  CreatePageResponse,
  FundPageRequest,
  GiftPage,
  ResolveLightningInvoiceResponse,
  SyncRedeemRequest,
  TokenOptimizePreview,
  TokenOptimizeResult,
  UpdateContactRequest,
} from '../../shared/types'

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (data && typeof data.error === 'string') return data.error
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`
}

export async function createPage(): Promise<CreatePageResponse> {
  const res = await fetch('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(35_000),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getPage(id: string): Promise<GiftPage> {
  const res = await fetch(`/api/pages/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fundPage(
  id: string,
  data: FundPageRequest,
): Promise<GiftPage> {
  const res = await fetch(`/api/pages/${id}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function syncRedeemResult(
  id: string,
  data: SyncRedeemRequest,
): Promise<GiftPage> {
  const res = await fetch(`/api/pages/${id}/redeem-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function resolveLightningInvoice(
  address: string,
  amountSats: number,
): Promise<string> {
  const res = await fetch('/api/lightning/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amountSats }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as ResolveLightningInvoiceResponse
  return data.invoice
}

export async function updatePageContact(
  id: string,
  data: UpdateContactRequest,
): Promise<GiftPage> {
  const res = await fetch(`/api/pages/${id}/contact`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function previewTokenOptimize(
  id: string,
): Promise<TokenOptimizePreview> {
  const res = await fetch(`/api/pages/${id}/optimize-token/preview`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function optimizePageToken(id: string): Promise<TokenOptimizeResult> {
  const res = await fetch(`/api/pages/${id}/optimize-token`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchPageTokenProofs(id: string): Promise<number[]> {
  const res = await fetch(`/api/pages/${id}/token-proofs`)
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as { proofSats: number[] }
  return data.proofSats
}

export async function fetchBtcUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch('/api/btc-usd')
    if (!res.ok) return null
    const data = (await res.json()) as { usd?: number }
    return typeof data.usd === 'number' && Number.isFinite(data.usd) ? data.usd : null
  } catch {
    return null
  }
}
