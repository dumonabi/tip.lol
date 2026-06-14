const SATS_PER_BTC = 100_000_000

export function formatBtcFromSats(sats: number): string {
  const btc = sats / SATS_PER_BTC
  if (btc >= 1) {
    return btc.toLocaleString(undefined, { maximumFractionDigits: 8 })
  }

  const trimmed = btc
    .toFixed(8)
    .replace(/(\.\d*?[1-9])0+$/, '$1')
    .replace(/\.0+$/, '')

  return trimmed || '0'
}
