import { useEffect, useRef, useState, type Ref } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { downloadQrFromContainer, svgToPngBlob } from '../lib/qr-save'
import { PagePanelIcon, PanelTitle } from './PanelIcons'

type Props = {
  pageUrl: string
  onCopyLink: () => void
  linkCopied: boolean
  open: boolean
  onToggle: () => void
  rootRef?: Ref<HTMLElement>
}

export function SharePanel({
  pageUrl,
  onCopyLink,
  linkCopied,
  open,
  onToggle,
  rootRef,
}: Props) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setSaveMsg(null)
  }, [open])

  async function savePageQr() {
    setSaveMsg(null)
    try {
      await downloadQrFromContainer(qrRef.current, 'cashu-gift-page.png')
      setSaveMsg('Page QR saved')
    } catch {
      setSaveMsg('Could not save page QR')
    }
  }

  async function shareNative() {
    setSaveMsg(null)
    try {
      const svg = qrRef.current?.querySelector('svg')
      if (!svg) return

      const blob = await svgToPngBlob(svg)
      const file = new File([blob], 'cashu-gift-page.png', { type: 'image/png' })

      if (navigator.share) {
        const withFile =
          !navigator.canShare || navigator.canShare({ files: [file] })
        if (withFile) {
          await navigator.share({
            title: 'Cashu gift',
            text: 'Open this link to claim your Cashu',
            url: pageUrl,
            files: [file],
          })
          return
        }

        await navigator.share({
          title: 'Cashu gift',
          url: pageUrl,
          text: 'Open this link to claim your Cashu',
        })
        return
      }

      setSaveMsg('Sharing not supported — use Save QR or Copy link')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setSaveMsg('Could not share')
    }
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
          This page
        </PanelTitle>
      </button>

      {open && (
        <div className="collapsible-body">
          <div className="qr-frame link-qr share-qr-wrap" ref={qrRef}>
            <QRCodeSVG
              value={pageUrl}
              size={220}
              level="M"
              includeMargin
              bgColor="#ffffff"
              fgColor="#0f0f12"
            />
          </div>

          <div className="share-sheet">
            <button type="button" className="dock-btn secondary" onClick={savePageQr}>
              Save QR
            </button>
            <button type="button" className="dock-btn secondary" onClick={onCopyLink}>
              {linkCopied ? 'Link copied!' : 'Copy link'}
            </button>
            <button type="button" className="dock-btn secondary" onClick={shareNative}>
              Share
            </button>
          </div>

          {saveMsg && <p className="success compact">{saveMsg}</p>}
        </div>
      )}
    </section>
  )
}
