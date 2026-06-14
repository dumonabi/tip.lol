import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import {
  createTokenUrEncoder,
  UR_FRAME_INTERVAL_MS,
} from '../lib/ur-token-encode'

type Props = {
  token: string
  size: number
  className?: string
}

export function AnimatedTokenQr({ token, size, className }: Props) {
  const [part, setPart] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    setPart(null)
    setError(null)

    try {
      const encoder = createTokenUrEncoder(token)
      setPart(encoder.nextPart())

      timer = setInterval(() => {
        if (cancelled) return
        setPart(encoder.nextPart())
      }, UR_FRAME_INTERVAL_MS)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not build animated QR',
      )
    }

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [token])

  if (error) {
    return (
      <div className={`qr-fallback ${className ?? ''}`.trim()}>
        <p className="qr-fallback-title">QR unavailable</p>
        <p className="hint compact">{error}</p>
        <p className="hint compact">Use <strong>Copy as text</strong> below.</p>
      </div>
    )
  }

  if (!part) {
    return (
      <div className={`animated-qr ${className ?? ''}`.trim()}>
        <p className="hint compact">Preparing QR…</p>
      </div>
    )
  }

  return (
    <div className={`animated-qr ${className ?? ''}`.trim()}>
      <div className="animated-qr-frame" aria-live="polite">
        <QRCodeSVG
          value={part}
          size={size}
          level="M"
          includeMargin
          bgColor="#ffffff"
          fgColor="#0f0f12"
        />
      </div>
    </div>
  )
}
