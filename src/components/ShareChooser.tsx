import { useEffect, useRef } from 'react'
import {
  copyPageLink,
  emailShareUrl,
  smsShareUrl,
  telegramShareUrl,
  whatsAppShareUrl,
} from '../lib/share-page'

type Props = {
  pageUrl: string
  onClose: () => void
  onCopied: () => void
}

export function ShareChooser({ pageUrl, onClose, onCopied }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  async function handleCopy() {
    const ok = await copyPageLink(pageUrl)
    if (ok) onCopied()
    onClose()
  }

  function openExternal(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <dialog ref={dialogRef} className="share-chooser" onClose={onClose}>
      <div className="share-chooser-panel">
        <p className="share-chooser-title">Share this page</p>
        <div className="share-chooser-options">
          <button
            type="button"
            className="share-chooser-option"
            onClick={() => openExternal(whatsAppShareUrl(pageUrl))}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className="share-chooser-option"
            onClick={() => {
              window.location.href = emailShareUrl(pageUrl)
              onClose()
            }}
          >
            Email
          </button>
          <button
            type="button"
            className="share-chooser-option"
            onClick={() => openExternal(telegramShareUrl(pageUrl))}
          >
            Telegram
          </button>
          <button
            type="button"
            className="share-chooser-option"
            onClick={() => {
              window.location.href = smsShareUrl(pageUrl)
              onClose()
            }}
          >
            Messages
          </button>
          <button type="button" className="share-chooser-option" onClick={() => void handleCopy()}>
            Copy link
          </button>
        </div>
        <button type="button" className="share-chooser-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  )
}
