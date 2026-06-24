import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import {
  resolveTokenFromInput,
  tryEncodeEmojiToken,
} from '../../shared/emoji-token'
import type { UrScanProgress } from '../lib/ur-token-decode'
import { releaseQrScanner } from '../lib/qr-scanner-release'
import { scrollSectionToTop } from '../lib/scroll-section'

type Props = {
  value: string
  onChange: (value: string) => void
}

export type CashuTokenInputHandle = {
  stopScanning: () => Promise<void>
}

const idleUrProgress: UrScanProgress = {
  scanning: false,
  percent: 0,
  partsReceived: 0,
  partsExpected: 0,
}

async function loadUrDecoder() {
  const { createUrTokenDecoder } = await import('../lib/ur-token-decode')
  return createUrTokenDecoder()
}

export const CashuTokenInput = forwardRef<CashuTokenInputHandle, Props>(
  function CashuTokenInput({ value, onChange }, ref) {
    const readerId = useId().replace(/:/g, '')
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const urDecoderRef = useRef<
      Awaited<ReturnType<typeof loadUrDecoder>> | null
    >(null)
    const urActiveRef = useRef(false)
    const cameraRef = useRef<HTMLDivElement>(null)
    const pasteInputRef = useRef<HTMLTextAreaElement>(null)
    const [showScanner, setShowScanner] = useState(false)
    const [scanError, setScanError] = useState<string | null>(null)
    const [pasteError, setPasteError] = useState<string | null>(null)
    const [canScan, setCanScan] = useState(false)
    const [urProgress, setUrProgress] = useState<UrScanProgress>(idleUrProgress)

    const emojiPreview = value ? tryEncodeEmojiToken(value) : null

    const stopScanner = useCallback(async () => {
      const scanner = scannerRef.current
      scannerRef.current = null
      setShowScanner(false)
      setUrProgress(idleUrProgress)
      urActiveRef.current = false
      urDecoderRef.current?.reset()
      await releaseQrScanner(scanner, readerId)
    }, [readerId])

    useImperativeHandle(ref, () => ({ stopScanning: stopScanner }), [
      stopScanner,
    ])

    useEffect(() => {
      return () => {
        const scanner = scannerRef.current
        scannerRef.current = null
        void releaseQrScanner(scanner, readerId)
      }
    }, [readerId])

    useEffect(() => {
      setCanScan(
        typeof window !== 'undefined' &&
          Boolean(navigator.mediaDevices?.getUserMedia),
      )
    }, [])

    const handleScanPayload = useCallback(
      (decoded: string) => {
        const urDecoder = urDecoderRef.current

        if (urDecoder?.isUrPart(decoded)) {
          urActiveRef.current = true
          const result = urDecoder.addPart(decoded)
          setUrProgress(result.progress)
          if (result.error) {
            setScanError(result.error)
          }
          if (result.complete && result.token) {
            urActiveRef.current = false
            onChange(result.token)
            void stopScanner()
          }
          return
        }

        if (urActiveRef.current) {
          return
        }

        const token = resolveTokenFromInput(decoded)
        if (!token) return
        onChange(token)
        void stopScanner()
      },
      [onChange, stopScanner],
    )

    useEffect(() => {
      if (!showScanner) return

      let cancelled = false
      let activeScanner: Html5Qrcode | null = null

      urActiveRef.current = false
      setUrProgress(idleUrProgress)
      scrollSectionToTop(cameraRef.current)

      void (async () => {
        urDecoderRef.current = await loadUrDecoder()
        if (cancelled) return

        const scanner = new Html5Qrcode(readerId)
        activeScanner = scanner
        scannerRef.current = scanner

        try {
          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 20,
              qrbox: (width, height) => {
                const edge = Math.min(width, height)
                const size = Math.floor(edge * 0.88)
                return { width: size, height: size }
              },
              aspectRatio: 1,
            },
            (decoded) => {
              if (cancelled) return
              handleScanPayload(decoded)
            },
            () => {},
          )

          if (cancelled) {
            await releaseQrScanner(scanner, readerId)
            return
          }

          scrollSectionToTop(cameraRef.current)
        } catch (err: unknown) {
          if (!cancelled) {
            setScanError(
              err instanceof Error ? err.message : 'Could not access camera',
            )
            setShowScanner(false)
          }
          await releaseQrScanner(scanner, readerId)
          if (!cancelled) scannerRef.current = null
        }
      })()

      return () => {
        cancelled = true
        scannerRef.current = null
        urActiveRef.current = false
        urDecoderRef.current?.reset()
        void releaseQrScanner(activeScanner, readerId)
      }
    }, [showScanner, readerId, handleScanPayload])

    useEffect(() => {
      if (!showScanner) return

      function handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
          void stopScanner()
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }, [showScanner, stopScanner])

    async function applyPastedText(text: string) {
      const token = resolveTokenFromInput(text)
      if (!token) {
        setPasteError('No Cashu token in clipboard')
        return
      }
      onChange(token)
    }

    async function handlePaste() {
      setPasteError(null)
      setScanError(null)

      // Read clipboard in the same tap — any await before this breaks mobile Safari.
      const clipboardRead = navigator.clipboard.readText()

      try {
        const text = await clipboardRead
        if (showScanner) await stopScanner()
        await applyPastedText(text)
      } catch {
        const pasteInput = pasteInputRef.current
        if (!pasteInput) {
          setPasteError('Could not read clipboard')
          return
        }
        pasteInput.value = ''
        pasteInput.focus({ preventScroll: true })
      }
    }

    async function handlePasteInput(event: React.ClipboardEvent<HTMLTextAreaElement>) {
      event.preventDefault()
      setPasteError(null)
      setScanError(null)
      const text = event.clipboardData.getData('text/plain')
      event.currentTarget.blur()
      if (showScanner) await stopScanner()
      await applyPastedText(text)
    }

    async function startScanner() {
      setScanError(null)
      setPasteError(null)
      setUrProgress(idleUrProgress)
      urActiveRef.current = false
      await releaseQrScanner(scannerRef.current, readerId)
      scannerRef.current = null
      urDecoderRef.current = await loadUrDecoder()
      setShowScanner(true)
    }

    return (
      <div className="token-input">
        <textarea
          ref={pasteInputRef}
          className="token-paste-input"
          aria-hidden
          tabIndex={-1}
          onPaste={(event) => void handlePasteInput(event)}
        />

        <div className="token-actions">
          <button type="button" className="load-token-action" onClick={() => void handlePaste()}>
            Paste
          </button>
          <button
            type="button"
            className="load-token-action"
            onClick={() => void startScanner()}
            disabled={!canScan || showScanner}
          >
            Scan Cashu QR
          </button>
        </div>

        {value && (
          <p className="token-ready">
            {emojiPreview && (
              <span className="token-emoji-preview" aria-hidden>
                {emojiPreview}
              </span>
            )}
            Cashu loaded
            <button
              type="button"
              className="ghost small inline"
              onClick={() => onChange('')}
            >
              Clear
            </button>
          </p>
        )}

        {showScanner && (
          <div className="scan-block">
            <p className="hint compact scan-hint">
              {urProgress.scanning
                ? `Keep the camera steady (${urProgress.percent}% · ${urProgress.partsReceived} parts)`
                : 'Point at a Cashu QR'}
            </p>
            {urProgress.scanning && (
              <div
                className="ur-progress"
                role="progressbar"
                aria-valuenow={urProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="ur-progress-fill"
                  style={{ width: `${urProgress.percent}%` }}
                />
              </div>
            )}
            <div id={readerId} ref={cameraRef} className="qr-reader" />
            <button
              type="button"
              className="ghost small"
              onClick={() => void stopScanner()}
            >
              Cancel scan
            </button>
          </div>
        )}

        {pasteError && <p className="error compact">{pasteError}</p>}
        {scanError && <p className="error compact">{scanError}</p>}
      </div>
    )
  },
)
