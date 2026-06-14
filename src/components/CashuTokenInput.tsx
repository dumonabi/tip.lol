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
    const [showScanner, setShowScanner] = useState(false)
    const [scanError, setScanError] = useState<string | null>(null)
    const [pasteError, setPasteError] = useState<string | null>(null)
    const [canScan, setCanScan] = useState(false)
    const [urProgress, setUrProgress] = useState<UrScanProgress>(idleUrProgress)

    const emojiPreview = value ? tryEncodeEmojiToken(value) : null

    const clearReaderElement = useCallback(() => {
      const el = document.getElementById(readerId)
      if (el) el.innerHTML = ''
    }, [readerId])

    const stopScanner = useCallback(async () => {
      const scanner = scannerRef.current
      scannerRef.current = null
      setShowScanner(false)
      setUrProgress(idleUrProgress)
      urActiveRef.current = false
      urDecoderRef.current?.reset()

      if (scanner) {
        try {
          if (scanner.isScanning) await scanner.stop()
        } catch {
          // ignore
        }
        try {
          scanner.clear()
        } catch {
          // ignore
        }
      }

      clearReaderElement()
      document.getElementById('qr-shaded-region')?.remove()
    }, [clearReaderElement])

    useImperativeHandle(ref, () => ({ stopScanning: stopScanner }), [
      stopScanner,
    ])

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
      urActiveRef.current = false
      setUrProgress(idleUrProgress)

      void loadUrDecoder().then((decoder) => {
        if (cancelled) return
        urDecoderRef.current = decoder
      })

      const scanner = new Html5Qrcode(readerId)
      scannerRef.current = scanner

      void scanner
        .start(
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
        .catch((err: unknown) => {
          if (cancelled) return
          setScanError(
            err instanceof Error ? err.message : 'Could not access camera',
          )
          void stopScanner()
        })

      return () => {
        cancelled = true
        void stopScanner()
      }
    }, [showScanner, readerId, handleScanPayload, stopScanner])

    async function handlePaste() {
      await stopScanner()
      setPasteError(null)
      setScanError(null)
      try {
        const text = await navigator.clipboard.readText()
        const token = resolveTokenFromInput(text)
        if (!token) {
          setPasteError('No Cashu token in clipboard')
          return
        }
        onChange(token)
      } catch {
        setPasteError('Could not read clipboard')
      }
    }

    async function startScanner() {
      setScanError(null)
      setPasteError(null)
      setUrProgress(idleUrProgress)
      urActiveRef.current = false
      clearReaderElement()
      urDecoderRef.current = await loadUrDecoder()
      setShowScanner(true)
    }

    return (
      <div className="token-input">
        <div className="token-actions">
          <button type="button" className="secondary" onClick={handlePaste}>
            Paste
          </button>
          <button
            type="button"
            className="secondary"
            onClick={startScanner}
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
            <div id={readerId} className="qr-reader" />
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
