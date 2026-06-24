import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CASHU_EMOJI_CARRIER,
  tryEncodeEmojiToken,
} from '../../shared/emoji-token'
import { fetchBtcUsdPrice } from '../lib/api'
import { formatBtcFromSats } from '../lib/btc-amount'
import { formatUsdFromSats } from '../lib/btc-usd'
import { downloadQrFromContainer } from '../lib/qr-save'
import type { GiftPage } from '../../shared/types'
import { CheckIcon, CopyIcon, DownloadIcon, QrCodeIcon } from './PanelIcons'
import { SatSymbol } from './SatSymbol'
import { TokenQr } from './TokenQr'

type Props = {
  page: GiftPage
  onCopyToken: (token: string) => void
  onCopyEmoji: (emoji: string) => void
  copiedToken: boolean
  copiedEmoji: boolean
}

export function CashuClaimHero({
  page,
  onCopyToken,
  onCopyEmoji,
  copiedToken,
  copiedEmoji,
}: Props) {
  const primaryToken = page.tokens[0]
  if (!primaryToken) return null

  const qrRef = useRef<HTMLDivElement>(null)
  const [showQr, setShowQr] = useState(false)
  const [btcUsd, setBtcUsd] = useState<number | null>(null)

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

  function saveTokenQr() {
    void downloadQrFromContainer(qrRef.current, 'cashu-token.png').catch(() => {
      /* download may be cancelled; no message */
    })
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

          {(copiedToken || copiedEmoji) && (
            <p className="token-hero-copy-hint" role="status">
              {copiedToken ? 'Copied as text' : 'Copied as emoji'}
            </p>
          )}

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
                onClick={saveTokenQr}
                aria-label="Download QR"
                title="Download QR"
              >
                <DownloadIcon />
              </button>
            </div>
          )}
        </div>
      </div>

      {page.partiallySpent && page.initialAmountSats != null && (
        <p className="partial-spend-banner">
          Part of the original gift has already been spent (
          {page.initialAmountSats.toLocaleString()} sats).{' '}
          {amountSats.toLocaleString()} sats remain on this page.
        </p>
      )}
      {page.memo && <p className="memo">“{page.memo}”</p>}
    </div>
  )
}
