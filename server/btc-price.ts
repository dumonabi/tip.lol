const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
const CACHE_TTL_MS = 15 * 60 * 1000

let cache: { usd: number; fetchedAt: number } | null = null

export async function getBtcUsdPrice(): Promise<number | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.usd
  }

  try {
    const res = await fetch(COINGECKO_URL, {
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return cache?.usd ?? null

    const data = (await res.json()) as { bitcoin?: { usd?: number } }
    const usd = data.bitcoin?.usd
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) {
      return cache?.usd ?? null
    }

    cache = { usd, fetchedAt: Date.now() }
    return usd
  } catch {
    return cache?.usd ?? null
  }
}
