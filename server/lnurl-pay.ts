const LIGHTNING_ADDRESS_RE =
  /^[a-z0-9_+.-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

type LnurlPayMetadata = {
  callback: string
  minSendable: number
  maxSendable: number
  metadata?: string
  tag?: string
}

type LnurlPayInvoice = {
  pr?: string
  status?: string
  reason?: string
}

export async function fetchLightningAddressInvoice(
  address: string,
  amountSats: number,
): Promise<string> {
  const normalized = address.trim().toLowerCase()
  if (!LIGHTNING_ADDRESS_RE.test(normalized)) {
    throw new Error('Invalid Lightning Address')
  }
  if (!Number.isFinite(amountSats) || amountSats <= 0) {
    throw new Error('Amount must be at least 1 sat')
  }

  const at = normalized.indexOf('@')
  const username = normalized.slice(0, at)
  const domain = normalized.slice(at + 1)
  const msats = Math.round(amountSats * 1000)

  const metaUrl = `https://${domain}/.well-known/lnurlp/${encodeURIComponent(username)}`
  const metaRes = await fetch(metaUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })

  if (!metaRes.ok) {
    throw new Error('Could not look up that Lightning Address')
  }

  const meta = (await metaRes.json()) as LnurlPayMetadata
  if (meta.tag && meta.tag !== 'payRequest') {
    throw new Error('That address does not accept payments')
  }
  if (!meta.callback) {
    throw new Error('Invalid response from Lightning Address host')
  }

  if (msats < meta.minSendable || msats > meta.maxSendable) {
    const minSats = Math.ceil(meta.minSendable / 1000)
    const maxSats = Math.floor(meta.maxSendable / 1000)
    throw new Error(
      `Amount must be between ${minSats.toLocaleString()} and ${maxSats.toLocaleString()} sats for this address`,
    )
  }

  const callbackUrl = new URL(meta.callback)
  callbackUrl.searchParams.set('amount', String(msats))

  const invoiceRes = await fetch(callbackUrl.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })

  if (!invoiceRes.ok) {
    throw new Error('Could not request an invoice from that Lightning Address')
  }

  const invoiceData = (await invoiceRes.json()) as LnurlPayInvoice
  if (invoiceData.status === 'ERROR') {
    throw new Error(invoiceData.reason || 'Could not create invoice for that address')
  }

  const invoice = invoiceData.pr?.trim().toLowerCase()
  if (!invoice?.startsWith('lnbc')) {
    throw new Error('Lightning Address did not return a valid invoice')
  }

  return invoice
}
