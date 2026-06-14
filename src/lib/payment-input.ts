export type PaymentInputKind = 'bolt11' | 'bolt12' | 'lightning_address'

export type ClassifiedPayment = {
  kind: PaymentInputKind
  value: string
}

const LIGHTNING_ADDRESS_RE =
  /^[a-z0-9_+.-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

export function stripLightningPrefix(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase().startsWith('lightning:')) {
    return trimmed.slice('lightning:'.length).trim()
  }
  return trimmed
}

export function classifyPaymentInput(raw: string): ClassifiedPayment {
  const value = stripLightningPrefix(raw).replace(/\s+/g, '')

  if (!value) {
    throw new Error('Paste a BOLT11 invoice, BOLT12 offer, or Lightning Address')
  }

  const lower = value.toLowerCase()

  if (lower.startsWith('lnbc')) {
    if (lower.length < 20) throw new Error('That BOLT11 invoice looks too short')
    return { kind: 'bolt11', value: lower }
  }

  if (lower.startsWith('lno1')) {
    return { kind: 'bolt12', value: lower }
  }

  if (LIGHTNING_ADDRESS_RE.test(value)) {
    return { kind: 'lightning_address', value: value.toLowerCase() }
  }

  throw new Error(
    'Use a BOLT11 invoice (lnbc…), BOLT12 offer (lno1…), or Lightning Address (name@domain.com)',
  )
}

export function paymentKindLabel(kind: PaymentInputKind): string {
  switch (kind) {
    case 'bolt11':
      return 'BOLT11 invoice'
    case 'bolt12':
      return 'BOLT12 offer'
    case 'lightning_address':
      return 'Lightning Address'
  }
}

export function bolt11HasEmbeddedAmount(invoice: string): boolean {
  const value = stripLightningPrefix(invoice).replace(/\s+/g, '')
  // Matches cashu-ts invoiceHasAmountInHRP — amount encoded in the BOLT11 prefix.
  return /^ln[a-z]{2,}[1-9][0-9]*(?:[mun]|0p)?1/i.test(value)
}

export function paymentAmountRequired(classified: ClassifiedPayment): boolean {
  switch (classified.kind) {
    case 'lightning_address':
      return true
    case 'bolt11':
      return !bolt11HasEmbeddedAmount(classified.value)
    case 'bolt12':
      return false
  }
}

export function redeemNeedsAmountRetry(message: string): boolean {
  return /needs an amount|enter an amount|amountless|no fixed amount|amount_msat|does not have the amount|amountless invoice/i.test(
    message,
  )
}
