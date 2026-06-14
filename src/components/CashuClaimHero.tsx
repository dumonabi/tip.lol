import { useRef, useState } from 'react'
import { formatBtcFromSats } from '../lib/btc-amount'
import type { GiftPage } from '../../shared/types'
import { downloadQrFromContainer } from '../lib/qr-save'
import { canShowStaticTokenQr } from '../lib/qr-token'
import { TokenCopyActions } from './TokenCopyActions'
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

  const staticQr = canShowStaticTokenQr(primaryToken.token)
  const qrRef = useRef<HTMLDivElement>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  async function saveTokenQr() {
    setSaveMsg(null)
    try {
      await downloadQrFromContainer(qrRef.current, 'cashu-token.png')
      setSaveMsg('Token QR saved')
    } catch {
      setSaveMsg('Could not save token QR')
    }
  }

  const amountSats = page.amountSats ?? primaryToken.amountSats

  return (
    <div className="claim-hero">
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
          )
        </span>
      </h1>
      {page.memo && <p className="memo">“{page.memo}”</p>}

      <div ref={qrRef}>
        <TokenQr
          token={primaryToken.token}
          size={300}
          className="qr-frame hero-qr"
        />
      </div>

      <TokenCopyActions
        token={primaryToken.token}
        onCopyToken={() => onCopyToken(primaryToken.token)}
        onCopyEmoji={onCopyEmoji}
        copiedToken={copiedToken}
        copiedEmoji={copiedEmoji}
        emojiCopy={staticQr}
      />

      {staticQr && (
        <button
          type="button"
          className="dock-btn secondary token-save-qr"
          onClick={saveTokenQr}
        >
          Save QR of the token
        </button>
      )}

      {saveMsg && <p className="success compact">{saveMsg}</p>}
    </div>
  )
}
