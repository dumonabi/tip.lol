import { Mint } from '@cashu/cashu-ts'

export function formatMintHostname(mintUrl: string): string {
  try {
    return new URL(mintUrl).hostname.replace(/^www\./i, '')
  } catch {
    return mintUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  }
}

export async function fetchMintLabel(mintUrl: string): Promise<string> {
  try {
    const mint = new Mint(mintUrl)
    const info = await mint.getInfo()
    const name = info.name?.trim()
    if (name) return name
  } catch {
    // fall back to hostname
  }

  return formatMintHostname(mintUrl)
}

/** Short mint name — drops a trailing "Mint" if the API already includes it. */
export function formatMintDisplayName(label: string): string {
  const trimmed = label.trim()
  const withoutSuffix = trimmed.replace(/\s+mint$/i, '').trim()
  return withoutSuffix || trimmed
}

/** Title label, e.g. "Minibits Mint". */
export function formatMintTitleName(label: string): string {
  return `${formatMintDisplayName(label)} Mint`
}
