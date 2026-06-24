import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CASHU_EMOJI_CARRIER,
  tryEncodeEmojiToken,
} from '../../shared/emoji-token'
import { detachCollectionToken, fetchBtcUsdPrice } from '../lib/api'
import { formatBtcFromSats } from '../lib/btc-amount'
import { formatUsdFromSats } from '../lib/btc-usd'
import { downloadQrFromContainer } from '../lib/qr-save'
import type { GiftPage, StoredToken } from '../../shared/types'
import { CheckIcon, CopyIcon, DownloadIcon, OpenInNewWindowIcon, QrCodeIcon } from './PanelIcons'
import { SatSymbol } from './SatSymbol'
import { TokenQr } from './TokenQr'

type Props = {
  collectionId: string
  entry: StoredToken
  index: number
  onCopyToken: (token: string, index: number) => void
  onCopyEmoji: (emoji: string, index: number) => void
  copiedToken: boolean
  copiedEmoji: boolean
  onCollectionUpdated?: (page: GiftPage) => void
}

export function CollectionTokenCard({
  collectionId,
  entry,
  index,
  onCopyToken,
  onCopyEmoji,
  copiedToken,
  copiedEmoji,
  onCollectionUpdated,
}: Props) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [showQr, setShowQr] = useState(false)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const [btcUsd, setBtcUsd] = useState<number | null>(null)

  const emojiToken = useMemo(
    () => tryEncodeEmojiToken(entry.token),
    [entry.token],
  )

  useEffect(() => {
    let cancelled = false
    void fetchBtcUsdPrice().then((price) => {
      if (!cancelled) setBtcUsd(price)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function openTokenWindow() {
    setOpening(true)
    setOpenError(null)
    try {
      const result = await detachCollectionToken(collectionId, index)
      onCollectionUpdated?.(result.collectionPage)
      const url = `${window.location.origin}/g/${result.giftPageId}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setOpenError(
        err instanceof Error ? err.message : 'Could not open token in a new page',
      )
    } finally {
      setOpening(false)
    }
  }

  function saveTokenQr() {
    void downloadQrFromContainer(qrRef.current, `cashu-token-${index + 1}.png`).catch(
      () => {},
    )
  }

  return (
    <article className="collection-token-card">
      <button
        type="button"
        className="token-hero-icon-btn collection-token-open-btn"
        onClick={() => void openTokenWindow()}
        disabled={opening}
        aria-label="Open token in its own page"
        title="Open token in its own page"
      >
        <OpenInNewWindowIcon />
      </button>

      <h2 className="gift-amount collection-token-card-amount">
        <span className="gift-amount-sats">
          {entry.amountSats.toLocaleString()}
          <SatSymbol />
        </span>
        <span className="gift-amount-btc">
          ({formatBtcFromSats(entry.amountSats)}{' '}
          <span className="btc-mark" aria-hidden>
            ₿
          </span>
          {btcUsd != null && (
            <>
              {' · ≈ '}
              <span className="usd-mark" aria-hidden>
                $
              </span>
              {formatUsdFromSats(entry.amountSats, btcUsd)}
            </>
          )}
          )
        </span>
      </h2>

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
            onClick={() => onCopyToken(entry.token, index)}
            aria-label={copiedToken ? 'Token copied' : 'Copy as text'}
            title={copiedToken ? 'Copied' : 'Copy as text'}
          >
            {copiedToken ? <CheckIcon /> : <CopyIcon />}
          </button>
          {emojiToken && (
            <button
              type="button"
              className={`token-hero-icon-btn token-hero-emoji-btn ${copiedEmoji ? 'active' : ''}`}
              onClick={() => onCopyEmoji(emojiToken, index)}
              aria-label={copiedEmoji ? 'Emoji token copied' : 'Copy as emoji'}
              title={copiedEmoji ? 'Copied' : 'Copy as emoji'}
            >
              {copiedEmoji ? <CheckIcon /> : CASHU_EMOJI_CARRIER}
            </button>
          )}
        </div>

        {openError && (
          <p className="error compact" role="status">
            {openError}
          </p>
        )}

        {(copiedToken || copiedEmoji) && (
          <p className="token-hero-copy-hint" role="status">
            {copiedToken ? 'Copied as text' : 'Copied as emoji'}
          </p>
        )}

        {showQr && (
          <div className="share-qr-reveal">
            <div ref={qrRef}>
              <TokenQr
                token={entry.token}
                size={220}
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
    </article>
  )
}
