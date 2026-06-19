import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CASHU_EMOJI_CARRIER,
  tryEncodeEmojiToken,
} from '../../shared/emoji-token'
import { fetchBtcUsdPrice, fetchPageTokenProofs } from '../lib/api'
import { formatBtcFromSats } from '../lib/btc-amount'
import { formatUsdFromSats } from '../lib/btc-usd'
import { downloadQrFromContainer } from '../lib/qr-save'
import type { GiftPage } from '../../shared/types'
import { CheckIcon, CopyIcon, DownloadIcon, InfoIcon, QrCodeIcon } from './PanelIcons'
import { SatSymbol } from './SatSymbol'
import { TokenOptimize } from './TokenOptimize'
import { TokenProofBills } from './TokenProofBills'
import { TokenQr } from './TokenQr'

type Props = {
  page: GiftPage
  onCopyToken: (token: string) => void
  onCopyEmoji: (emoji: string) => void
  onOptimized: (page: GiftPage) => void
  copiedToken: boolean
  copiedEmoji: boolean
}

export function CashuClaimHero({
  page,
  onCopyToken,
  onCopyEmoji,
  onOptimized,
  copiedToken,
  copiedEmoji,
}: Props) {
  const primaryToken = page.tokens[0]
  if (!primaryToken) return null

  const qrRef = useRef<HTMLDivElement>(null)
  const [showQr, setShowQr] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [proofSats, setProofSats] = useState<number[] | null>(null)
  const [proofLoading, setProofLoading] = useState(false)
  const [proofError, setProofError] = useState(false)
  const [btcUsd, setBtcUsd] = useState<number | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const emojiToken = useMemo(
    () => tryEncodeEmojiToken(primaryToken.token),
    [primaryToken.token],
  )

  const amountSats = page.amountSats ?? primaryToken.amountSats

  useEffect(() => {
    let cancelled = false
    void fetchBtcUsdPrice().then((price) => {
      if (!cancelled) setBtcUsd(price)
    })
    return () => {
      cancelled = true
    }
  }, [page.id])

  useEffect(() => {
    setProofSats(null)
    setProofError(false)
    setProofLoading(false)
  }, [primaryToken.token])

  async function toggleInfo() {
    const next = !showInfo
    setShowInfo(next)

    if (!next || proofSats !== null || proofLoading) return

    setProofLoading(true)
    setProofError(false)
    try {
      const amounts = await fetchPageTokenProofs(page.id)
      setProofSats(amounts)
    } catch {
      setProofError(true)
      setProofSats([])
    } finally {
      setProofLoading(false)
    }
  }

  async function saveTokenQr() {
    setSaveMsg(null)
    try {
      await downloadQrFromContainer(qrRef.current, 'cashu-token.png')
      setSaveMsg('Token QR saved')
    } catch {
      setSaveMsg('Could not save token QR')
    }
  }

  return (
    <div className="claim-hero">
      <div className="claim-hero-main">
        <h1 className="gift-amount">
          <span className="gift-amount-sats">
            {amountSats.toLocaleString()}
            <SatSymbol />
          </span>
          <span className="gift-amount-btc">
            ({formatBtcFromSats(amountSats)}{' '}
            <span className="btc-mark" aria-hidden>
              ₿
            </span>
            {btcUsd != null && (
              <>
                {' · ≈ '}
                <span className="usd-mark" aria-hidden>
                  $
                </span>
                {formatUsdFromSats(amountSats, btcUsd)}
              </>
            )}
            )
          </span>
        </h1>

        <div className="share-sheet claim-hero-sheet">
          <div className="share-sheet-row share-sheet-icon-row token-hero-toolbar">
            <button
              type="button"
              className={`token-hero-icon-btn ${showQr ? 'active' : ''}`}
              onClick={() => setShowQr((visible) => !visible)}
              aria-pressed={showQr}
              aria-label={showQr ? 'Hide token QR' : 'Show token QR'}
              title={showQr ? 'Hide QR' : 'Show QR'}
            >
              <QrCodeIcon />
            </button>
            <button
              type="button"
              className={`token-hero-icon-btn ${copiedToken ? 'active' : ''}`}
              onClick={() => onCopyToken(primaryToken.token)}
              aria-label={copiedToken ? 'Token copied' : 'Copy as text'}
              title={copiedToken ? 'Copied' : 'Copy as text'}
            >
              {copiedToken ? <CheckIcon /> : <CopyIcon />}
            </button>
            {emojiToken && (
              <button
                type="button"
                className={`token-hero-icon-btn token-hero-emoji-btn ${copiedEmoji ? 'active' : ''}`}
                onClick={() => onCopyEmoji(emojiToken)}
                aria-label={copiedEmoji ? 'Emoji token copied' : 'Copy as emoji'}
                title={copiedEmoji ? 'Copied' : 'Copy as emoji'}
              >
                {copiedEmoji ? <CheckIcon /> : CASHU_EMOJI_CARRIER}
              </button>
            )}
          </div>

          {showQr && (
            <div className="share-qr-reveal">
              <div ref={qrRef}>
                <TokenQr
                  token={primaryToken.token}
                  size={300}
                  className="qr-frame hero-qr share-qr-wrap"
                />
              </div>
              <button
                type="button"
                className="share-qr-save-btn"
                onClick={() => void saveTokenQr()}
                aria-label="Download QR"
                title="Download QR"
              >
                <DownloadIcon />
              </button>
            </div>
          )}
        </div>

        <section className="claim-hero-info-section" aria-label="Token information">
          <div className="claim-hero-info-layout">
            <button
              type="button"
              className={`token-proof-info-btn ${showInfo ? 'active' : ''}`}
              onClick={() => void toggleInfo()}
              aria-expanded={showInfo}
              aria-label={
                showInfo
                  ? 'Hide token composition'
                  : 'Show token composition'
              }
            >
              <InfoIcon />
            </button>

            {showInfo && (
              <div className="claim-hero-info-panel">
                <div className="token-proof-col-align">
                  <p className="token-proof-col-align__slot token-proof-count-label">
                    Token composition
                    {!proofLoading && !proofError && proofSats && (
                      <>
                        : {proofSats.length}{' '}
                        {proofSats.length === 1 ? 'proof' : 'proofs'}
                      </>
                    )}
                  </p>
                </div>
                <TokenProofBills
                  proofSats={proofSats}
                  loading={proofLoading}
                  error={proofError}
                  align="center"
                />
                <TokenOptimize
                  pageId={page.id}
                  onOptimized={onOptimized}
                  enabled={showInfo}
                  embedded
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {page.partiallySpent && page.initialAmountSats != null && (
        <p className="partial-spend-banner">
          Part of the original gift has already been spent (
          {page.initialAmountSats.toLocaleString()} sats).{' '}
          {amountSats.toLocaleString()} sats remain on this page.
        </p>
      )}
      {page.memo && <p className="memo">“{page.memo}”</p>}

      {saveMsg && <p className="success compact">{saveMsg}</p>}
    </div>
  )
}
