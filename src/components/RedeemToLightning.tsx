import { useEffect, useMemo, useState } from 'react'
import { syncRedeemResult } from '../lib/api'
import {
  fetchMintRedeemCapabilities,
  formatPaymentDestinationHint,
  type MintRedeemCapabilities,
  validatePaymentForMint,
} from '../lib/mint-redeem-capabilities'
import { PartialBalanceNote } from './PartialBalanceNote'
import {
  classifyPaymentInput,
  paymentAmountRequired,
  redeemNeedsAmountRetry,
} from '../lib/payment-input'
import {
  executeRedeem,
  fetchRedeemQuote,
  type RedeemQuote,
  type RedeemResult,
  RedeemError,
} from '../lib/redeem-lightning'

type Props = {
  pageId: string
  token: string
  giftBalanceSats: number
  onRedeemed?: (page: Awaited<ReturnType<typeof syncRedeemResult>>) => void
  onReady?: () => void
}

type Step = 'idle' | 'quoted'

function parseAmountSats(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    return null
  }
  return value
}

export function RedeemToLightning({
  pageId,
  token,
  giftBalanceSats,
  onRedeemed,
  onReady,
}: Props) {
  const [destination, setDestination] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [forceAmount, setForceAmount] = useState(false)
  const [mintCaps, setMintCaps] = useState<MintRedeemCapabilities | null>(null)
  const [capsLoading, setCapsLoading] = useState(true)
  const [capsError, setCapsError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [quote, setQuote] = useState<RedeemQuote | null>(null)
  const [busy, setBusy] = useState<'quote' | 'pay' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const classifiedPayment = useMemo(() => {
    try {
      return classifyPaymentInput(destination)
    } catch {
      return null
    }
  }, [destination])

  const destinationError = useMemo(() => {
    if (!classifiedPayment || !mintCaps) return null
    return validatePaymentForMint(classifiedPayment, mintCaps)
  }, [classifiedPayment, mintCaps])

  const needsAmount =
    classifiedPayment != null &&
    mintCaps != null &&
    destinationError == null &&
    (paymentAmountRequired(classifiedPayment) || forceAmount)

  const canPreview =
    classifiedPayment != null &&
    mintCaps != null &&
    destinationError == null &&
    (!needsAmount || parseAmountSats(amountInput) != null)

  const displayError = destinationError ?? capsError ?? error

  useEffect(() => {
    setForceAmount(false)
    setAmountInput('')
    setError(null)
  }, [destination])

  useEffect(() => {
    let cancelled = false
    setCapsLoading(true)
    setCapsError(null)
    setMintCaps(null)

    fetchMintRedeemCapabilities(token)
      .then((caps) => {
        if (!cancelled) setMintCaps(caps)
      })
      .catch((err) => {
        if (!cancelled) {
          setCapsError(
            err instanceof Error
              ? err.message
              : 'Could not check what this mint supports',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setCapsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    setDestination('')
    setAmountInput('')
    setStep('idle')
    setQuote(null)
    setError(null)
    setNotice(null)
    setForceAmount(false)
  }, [token])

  useEffect(() => {
    onReady?.()
  }, [onReady])

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    if (!canPreview) return

    setBusy('quote')
    setError(null)
    setNotice(null)
    setQuote(null)
    setStep('idle')

    const amountSats = parseAmountSats(amountInput)

    try {
      const nextQuote = await fetchRedeemQuote(token, destination, amountSats)
      setQuote(nextQuote)
      setStep('quoted')
    } catch (err) {
      const message =
        err instanceof RedeemError ? err.message : 'Could not preview payment'
      if (redeemNeedsAmountRetry(message)) {
        setForceAmount(true)
      }
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  async function handlePay() {
    if (!quote) return
    setBusy('pay')
    setError(null)
    setNotice(null)

    try {
      const payment = await executeRedeem(token, quote)
      await syncAfterPayment(payment)
    } catch (err) {
      setError(err instanceof RedeemError ? err.message : 'Payment failed')
    } finally {
      setBusy(null)
    }
  }

  async function syncAfterPayment(payment: RedeemResult) {
    const updated = await syncRedeemResult(pageId, {
      remainingToken: payment.remainingToken,
    })
    onRedeemed?.(updated)

    if (payment.fullySpent) {
      return
    }

    setNotice(
      `Paid ${payment.invoiceSats.toLocaleString()} sats — ${payment.remainingSats.toLocaleString()} sats left on this page.`,
    )
    setDestination('')
    setAmountInput('')
    setStep('idle')
    setQuote(null)
  }

  function handleChangePayment() {
    setStep('idle')
    setQuote(null)
    setError(null)
  }

  const destinationPlaceholder = mintCaps
    ? formatPaymentDestinationHint(mintCaps).replace(/^Accepted: /, '')
    : 'lnbc…'

  return (
    <section className="redeem-panel">
      <p className="redeem-balance">
        {giftBalanceSats.toLocaleString()} sats available
      </p>

      <PartialBalanceNote />

      {notice && <p className="success compact">{notice}</p>}

      <form onSubmit={handlePreview} className="stack">
        <label className="field">
          <span>Payment destination</span>
          {capsLoading && <span className="field-note">Checking mint…</span>}
          {!capsLoading && mintCaps && (
            <span className="field-note">{formatPaymentDestinationHint(mintCaps)}</span>
          )}
          <textarea
            rows={3}
            placeholder={destinationPlaceholder}
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value)
              if (step === 'quoted') {
                handleChangePayment()
              }
            }}
            disabled={busy !== null || capsLoading}
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        {needsAmount && (
          <label className="field">
            <span>Amount (sats)</span>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Required"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value)
                if (step === 'quoted') {
                  handleChangePayment()
                }
              }}
              disabled={busy !== null}
            />
          </label>
        )}

        {displayError && <p className="error">{displayError}</p>}

        {quote && step === 'quoted' && (
          <div className="redeem-quote">
            <p>
              <strong>Type:</strong> {quote.paymentLabel}
            </p>
            <p>
              <strong>Amount:</strong> {quote.invoiceSats.toLocaleString()} sats
            </p>
            <p>
              <strong>Mint fee reserve:</strong>{' '}
              {quote.feeReserveSats.toLocaleString()} sats
            </p>
            <p>
              <strong>From gift:</strong>{' '}
              {quote.totalRequiredSats.toLocaleString()} sats total
            </p>
          </div>
        )}

        <div className="redeem-actions">
          {step === 'idle' ? (
            canPreview && (
              <button type="submit" className="secondary" disabled={busy !== null}>
                {busy === 'quote' ? 'Checking payment…' : 'Preview payment'}
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                className="primary"
                disabled={busy !== null}
                onClick={handlePay}
              >
                {busy === 'pay' ? 'Paying…' : 'Pay'}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={busy !== null}
                onClick={handleChangePayment}
              >
                Change payment
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  )
}
