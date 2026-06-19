import { useEffect, useRef, useState, type Ref } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { downloadQrFromContainer } from '../lib/qr-save'
import { sharePageLink } from '../lib/share-page'
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PagePanelIcon,
  PanelTitle,
  QrCodeIcon,
  ShareLinkIcon,
} from './PanelIcons'
import { ShareChooser } from './ShareChooser'

type Props = {
  pageUrl: string
  panelTitle?: string
  iconActions?: boolean
  onCopyLink: () => void
  linkCopied: boolean
  open: boolean
  onToggle: () => void
  rootRef?: Ref<HTMLElement>
}

export function SharePanel({
  pageUrl,
  panelTitle = 'This page',
  iconActions = false,
  onCopyLink,
  linkCopied,
  open,
  onToggle,
  rootRef,
}: Props) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [showShareChooser, setShowShareChooser] = useState(false)

  useEffect(() => {
    if (!open) {
      setSaveMsg(null)
      setShareMsg(null)
      setShowQr(false)
      setShowShareChooser(false)
    }
  }, [open])

  async function downloadPageQr() {
    setSaveMsg(null)
    try {
      await downloadQrFromContainer(qrRef.current, 'cashu-gift-page.png')
      setSaveMsg('Page QR saved')
    } catch {
      setSaveMsg('Could not save page QR')
    }
  }

  async function sharePage() {
    setShareMsg(null)
    const result = await sharePageLink(pageUrl)
    if (result === 'shared' || result === 'cancelled') return
    setShowShareChooser(true)
  }

  return (
    <section
      ref={rootRef}
      className={`panel collapsible share-panel ${open ? 'collapsible-open' : ''}`}
    >
      <button
        type="button"
        className="collapsible-summary"
        onClick={onToggle}
        aria-expanded={open}
      >
        <PanelTitle>
          <PagePanelIcon />
          {panelTitle}
        </PanelTitle>
      </button>

      {open && (
        <div className="collapsible-body">
          <div className="share-sheet">
            <div className={`share-sheet-row ${iconActions ? 'share-sheet-icon-row' : ''}`}>
              {iconActions ? (
                <>
                  <button
                    type="button"
                    className={`token-hero-icon-btn ${showQr ? 'active' : ''}`}
                    onClick={() => setShowQr((visible) => !visible)}
                    aria-pressed={showQr}
                    aria-label={showQr ? 'Hide QR code' : 'Show QR code'}
                    title={showQr ? 'Hide QR' : 'Show QR'}
                  >
                    <QrCodeIcon />
                  </button>
                  <button
                    type="button"
                    className={`token-hero-icon-btn ${linkCopied ? 'active' : ''}`}
                    onClick={onCopyLink}
                    aria-label={linkCopied ? 'Link copied' : 'Copy link'}
                    title={linkCopied ? 'Copied' : 'Copy link'}
                  >
                    {linkCopied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <button
                    type="button"
                    className="token-hero-icon-btn"
                    onClick={() => void sharePage()}
                    aria-label="Share link"
                    title="Share"
                  >
                    <ShareLinkIcon />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`dock-btn secondary ${showQr ? 'active' : ''}`}
                    onClick={() => setShowQr((visible) => !visible)}
                    aria-pressed={showQr}
                  >
                    {showQr ? 'Hide QR' : 'Show QR'}
                  </button>
                  <button type="button" className="dock-btn secondary" onClick={onCopyLink}>
                    {linkCopied ? 'Link copied!' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    className="dock-btn secondary"
                    onClick={() => void sharePage()}
                  >
                    Share
                  </button>
                </>
              )}
            </div>

            {showQr && (
              <div className="share-qr-reveal">
                <div ref={qrRef} className="qr-frame link-qr share-qr-wrap">
                  <QRCodeSVG
                    value={pageUrl}
                    size={220}
                    level="M"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#0f0f12"
                  />
                </div>
                <button
                  type="button"
                  className="share-qr-save-btn"
                  onClick={() => void downloadPageQr()}
                  aria-label="Save QR"
                  title="Save QR"
                >
                  <DownloadIcon />
                </button>
              </div>
            )}
          </div>

          {saveMsg && <p className="success compact">{saveMsg}</p>}
          {shareMsg && <p className="success compact">{shareMsg}</p>}
        </div>
      )}

      {showShareChooser && (
        <ShareChooser
          pageUrl={pageUrl}
          onClose={() => setShowShareChooser(false)}
          onCopied={() => setShareMsg('Link copied')}
        />
      )}
    </section>
  )
}
