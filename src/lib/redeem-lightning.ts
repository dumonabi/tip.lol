import {
  Wallet,
  getEncodedToken,
  getTokenMetadata,
  type MeltQuoteBolt11Response,
  type MeltQuoteBolt12Response,
} from '@cashu/cashu-ts'
import { resolveLightningInvoice } from './api'
import {
  mintRedeemCapabilitiesFromWallet,
  validatePaymentForMint,
} from './mint-redeem-capabilities'
import {
  classifyPaymentInput,
  paymentKindLabel,
  bolt11HasEmbeddedAmount,
  type PaymentInputKind,
} from './payment-input'

export class RedeemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RedeemError'
  }
}

export type RedeemQuote = {
  kind: 'bolt11' | 'bolt12'
  paymentLabel: string
  invoiceSats: number
  feeReserveSats: number
  totalRequiredSats: number
  giftBalanceSats: number
  meltQuote: MeltQuoteBolt11Response | MeltQuoteBolt12Response
  mintUrl: string
  unit: string
}

export type RedeemResult = {
  invoiceSats: number
  remainingSats: number
  remainingToken: string | null
  fullySpent: boolean
}

async function loadTokenContext(token: string) {
  const meta = getTokenMetadata(token)
  const wallet = new Wallet(meta.mint, { unit: meta.unit })
  await wallet.loadMint()
  const decoded = wallet.decodeToken(token)
  if (decoded.proofs.length === 0) {
    throw new RedeemError('This token has no spendable proofs')
  }
  return { wallet, meta, proofs: decoded.proofs }
}

function mapRedeemError(err: unknown, fallback: string): RedeemError {
  if (err instanceof RedeemError) return err
  const message = err instanceof Error ? err.message : fallback
  if (/bolt12|method.*bolt12|not support/i.test(message)) {
    return new RedeemError(
      'This mint does not support BOLT12 payments yet — try a BOLT11 invoice instead',
    )
  }
  if (/expired|timeout|network|fetch/i.test(message)) {
    return new RedeemError(`${message} — try previewing the payment again`)
  }
  return new RedeemError(message || fallback)
}

function buildQuote(
  meltQuote: MeltQuoteBolt11Response | MeltQuoteBolt12Response,
  giftBalanceSats: number,
  mintUrl: string,
  unit: string,
  kind: 'bolt11' | 'bolt12',
  paymentLabel: string,
): RedeemQuote {
  const invoiceSats = meltQuote.amount.toNumber()
  const feeReserveSats = meltQuote.fee_reserve.toNumber()
  const totalRequiredSats = invoiceSats + feeReserveSats

  if (giftBalanceSats < totalRequiredSats) {
    throw new RedeemError(
      `Gift has ${giftBalanceSats.toLocaleString()} sats but this payment needs about ${totalRequiredSats.toLocaleString()} sats (amount + fees)`,
    )
  }

  return {
    kind,
    paymentLabel,
    invoiceSats,
    feeReserveSats,
    totalRequiredSats,
    giftBalanceSats,
    meltQuote,
    mintUrl,
    unit,
  }
}

async function fetchBolt11Quote(
  token: string,
  invoice: string,
  paymentLabel: string,
  amountSats?: number | null,
): Promise<RedeemQuote> {
  let wallet
  let meta
  try {
    ;({ wallet, meta } = await loadTokenContext(token))
  } catch (err) {
    throw mapRedeemError(err, 'Could not connect to the Cashu mint')
  }

  const hasEmbeddedAmount = bolt11HasEmbeddedAmount(invoice)

  if (hasEmbeddedAmount && amountSats != null && amountSats > 0) {
    throw new RedeemError('This invoice already has a fixed amount')
  }

  if (!hasEmbeddedAmount) {
    const supportsAmountless =
      wallet.getMintInfo().supportsAmountless('bolt11', meta.unit) ?? false
    if (!supportsAmountless) {
      throw new RedeemError(
        'This mint does not support variable-amount invoices — use an invoice with a fixed amount',
      )
    }
    if (amountSats == null || amountSats <= 0) {
      throw new RedeemError('Enter an amount in sats — this invoice has no fixed amount')
    }
  }

  let meltQuote: MeltQuoteBolt11Response
  try {
    if (!hasEmbeddedAmount && amountSats != null) {
      meltQuote = await wallet.createMeltQuoteBolt11(invoice, amountSats * 1000)
    } else {
      meltQuote = await wallet.createMeltQuoteBolt11(invoice)
    }
  } catch (err) {
    throw mapRedeemError(err, 'Could not read that invoice — check it or try another')
  }

  return buildQuote(
    meltQuote,
    meta.amount.toNumber(),
    meta.mint,
    meta.unit,
    'bolt11',
    paymentLabel,
  )
}

async function fetchBolt12Quote(
  token: string,
  offer: string,
  amountSats?: number | null,
): Promise<RedeemQuote> {
  let wallet
  let meta
  try {
    ;({ wallet, meta } = await loadTokenContext(token))
  } catch (err) {
    throw mapRedeemError(err, 'Could not connect to the Cashu mint')
  }

  let meltQuote: MeltQuoteBolt12Response
  try {
    if (amountSats != null && amountSats > 0) {
      meltQuote = await wallet.createMeltQuoteBolt12(offer, amountSats * 1000)
    } else {
      meltQuote = await wallet.createMeltQuoteBolt12(offer)
    }
  } catch (err) {
    if (!amountSats) {
      throw new RedeemError(
        'This BOLT12 offer needs an amount — enter sats in the amount field',
      )
    }
    throw mapRedeemError(err, 'Could not read that BOLT12 offer — check it or try another')
  }

  return buildQuote(
    meltQuote,
    meta.amount.toNumber(),
    meta.mint,
    meta.unit,
    'bolt12',
    paymentKindLabel('bolt12'),
  )
}

export async function fetchRedeemQuote(
  token: string,
  paymentRaw: string,
  amountSats?: number | null,
): Promise<RedeemQuote> {
  let classified
  try {
    classified = classifyPaymentInput(paymentRaw)
  } catch (err) {
    throw new RedeemError(err instanceof Error ? err.message : 'Invalid payment')
  }

  let wallet
  let meta
  try {
    ;({ wallet, meta } = await loadTokenContext(token))
  } catch (err) {
    throw mapRedeemError(err, 'Could not connect to the Cashu mint')
  }

  const caps = mintRedeemCapabilitiesFromWallet(wallet, meta.mint, meta.unit)
  const validationError = validatePaymentForMint(classified, caps)
  if (validationError) {
    throw new RedeemError(validationError)
  }

  if (classified.kind === 'lightning_address') {
    if (amountSats == null || amountSats <= 0) {
      throw new RedeemError('Enter an amount in sats for Lightning Address payments')
    }

    let invoice: string
    try {
      invoice = await resolveLightningInvoice(classified.value, amountSats)
    } catch (err) {
      throw new RedeemError(
        err instanceof Error ? err.message : 'Could not resolve Lightning Address',
      )
    }

    return fetchBolt11Quote(token, invoice, paymentKindLabel('lightning_address'), amountSats)
  }

  if (classified.kind === 'bolt11') {
    return fetchBolt11Quote(
      token,
      classified.value,
      paymentKindLabel('bolt11'),
      amountSats,
    )
  }

  return fetchBolt12Quote(token, classified.value, amountSats)
}

export async function executeRedeem(
  token: string,
  quote: RedeemQuote,
): Promise<RedeemResult> {
  let wallet
  let proofs
  try {
    ;({ wallet, proofs } = await loadTokenContext(token))
  } catch (err) {
    throw mapRedeemError(err, 'Could not connect to the Cashu mint')
  }

  const amountToSend = quote.meltQuote.amount.add(quote.meltQuote.fee_reserve)

  let keep
  let proofsToSend
  try {
    ;({ keep, send: proofsToSend } = await wallet.send(amountToSend, proofs, {
      includeFees: true,
    }))
  } catch (err) {
    throw mapRedeemError(
      err,
      'Could not select proofs for this payment — try a smaller amount',
    )
  }

  let result
  try {
    if (quote.kind === 'bolt12') {
      result = await wallet.meltProofsBolt12(
        quote.meltQuote as MeltQuoteBolt12Response,
        proofsToSend,
      )
    } else {
      result = await wallet.meltProofsBolt11(
        quote.meltQuote as MeltQuoteBolt11Response,
        proofsToSend,
      )
    }
  } catch (err) {
    throw mapRedeemError(
      err,
      'Payment failed — the invoice may have expired. Preview it again.',
    )
  }

  const remainingProofs = [...keep, ...result.change]
  const remainingSats = remainingProofs.reduce(
    (sum, proof) => sum + proof.amount.toNumber(),
    0,
  )

  const remainingToken =
    remainingProofs.length > 0
      ? getEncodedToken({
          mint: quote.mintUrl,
          proofs: remainingProofs,
          unit: quote.unit,
        })
      : null

  return {
    invoiceSats: quote.invoiceSats,
    remainingSats,
    remainingToken,
    fullySpent: remainingProofs.length === 0,
  }
}

export { classifyPaymentInput, paymentKindLabel, type PaymentInputKind }
