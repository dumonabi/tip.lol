import type {
  CreatePageResponse,
  DetachCollectionTokenResult,
  FundPageRequest,
  GiftPage,
  MergeCollectionResult,
  ResolveLightningInvoiceResponse,
  SyncRedeemRequest,
  SplitCollectionPreview,
  SplitCollectionResult,
  TokenInsights,
  TokenProofDetail,
  UpdateContactRequest,
} from '../../shared/types'

const DEFAULT_TIMEOUT_MS = 60_000

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (data && typeof data.error === 'string') return data.error
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`
}

function networkErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return 'Request timed out — try again'
  }
  if (err instanceof TypeError) {
    return 'Could not reach the server — check that the API is running'
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return 'Network request failed'
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
  } catch (err) {
    throw new Error(networkErrorMessage(err))
  }
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<T>
}

export async function createPage(): Promise<CreatePageResponse> {
  return fetchJson('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(35_000),
  })
}

export async function getPage(id: string): Promise<GiftPage> {
  return fetchJson(`/api/pages/${id}`)
}

export async function fundPage(
  id: string,
  data: FundPageRequest,
): Promise<GiftPage> {
  return fetchJson(`/api/pages/${id}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function syncRedeemResult(
  id: string,
  data: SyncRedeemRequest,
): Promise<GiftPage> {
  return fetchJson(`/api/pages/${id}/redeem-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function resolveLightningInvoice(
  address: string,
  amountSats: number,
): Promise<string> {
  const data = await fetchJson<ResolveLightningInvoiceResponse>('/api/lightning/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amountSats }),
  })
  return data.invoice
}

export async function updatePageContact(
  id: string,
  data: UpdateContactRequest,
): Promise<GiftPage> {
  return fetchJson(`/api/pages/${id}/contact`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function fetchTokenInsights(id: string): Promise<TokenInsights> {
  return fetchJson(`/api/pages/${id}/token-insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export async function previewSplitCollection(
  id: string,
  parts: number[][],
): Promise<SplitCollectionPreview> {
  return fetchJson(`/api/pages/${id}/split-collection/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts }),
  })
}

export async function splitPageIntoCollection(
  id: string,
  parts: number[][],
): Promise<SplitCollectionResult> {
  return fetchJson(`/api/pages/${id}/split-collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts }),
    signal: AbortSignal.timeout(90_000),
  })
}

export async function mergeCollection(id: string): Promise<MergeCollectionResult> {
  return fetchJson(`/api/pages/${id}/merge-collection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(90_000),
  })
}

export async function detachCollectionToken(
  id: string,
  tokenIndex: number,
): Promise<DetachCollectionTokenResult> {
  return fetchJson(`/api/pages/${id}/detach-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenIndex }),
    signal: AbortSignal.timeout(90_000),
  })
}

export async function fetchPageTokenProofs(
  id: string,
  tokenIndex?: number,
): Promise<TokenProofDetail[]> {
  const query =
    tokenIndex !== undefined && Number.isInteger(tokenIndex) && tokenIndex >= 0
      ? `?tokenIndex=${encodeURIComponent(String(tokenIndex))}`
      : ''
  const data = await fetchJson<{ proofs: TokenProofDetail[] }>(
    `/api/pages/${id}/token-proofs${query}`,
  )
  return data.proofs
}

export async function fetchBtcUsdPrice(): Promise<number | null> {
  try {
    const res = await fetch('/api/btc-usd', { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const data = (await res.json()) as { usd?: number }
    return typeof data.usd === 'number' && Number.isFinite(data.usd) ? data.usd : null
  } catch {
    return null
  }
}
