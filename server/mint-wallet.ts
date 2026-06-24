import { Wallet } from '@cashu/cashu-ts'

const walletCache = new Map<string, Wallet>()

export function mintWalletCacheKey(mintUrl: string, unit: string): string {
  return `${mintUrl}\0${unit}`
}

export function isMintWalletCached(mintUrl: string, unit: string): boolean {
  return walletCache.has(mintWalletCacheKey(mintUrl, unit))
}

/** Load mint keysets once per process and reuse across sync, split, and merge. */
export async function getMintWallet(mintUrl: string, unit: string): Promise<Wallet> {
  const key = mintWalletCacheKey(mintUrl, unit)
  let wallet = walletCache.get(key)
  if (!wallet) {
    wallet = new Wallet(mintUrl, { unit })
    await wallet.loadMint()
    walletCache.set(key, wallet)
  }
  return wallet
}
