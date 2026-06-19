const SATS_PER_BTC = 100_000_000

export function formatUsdFromSats(sats: number, btcUsd: number): string {
  const usd = (sats / SATS_PER_BTC) * btcUsd

  if (usd >= 1_000) {
    return usd.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
  if (usd >= 1) {
    return usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (usd >= 0.01) {
    return usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return usd.toLocaleString(undefined, { maximumFractionDigits: 4 })
}
