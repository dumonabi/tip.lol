import { lazy, Suspense } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { canShowStaticTokenQr } from '../lib/qr-token'

const AnimatedTokenQr = lazy(() =>
  import('./AnimatedTokenQr').then((m) => ({ default: m.AnimatedTokenQr })),
)

type Props = {
  token: string
  size: number
  className?: string
}

export function TokenQr({ token, size, className }: Props) {
  if (!canShowStaticTokenQr(token)) {
    return (
      <Suspense
        fallback={
          <div className={`animated-qr ${className ?? ''}`.trim()}>
            <p className="hint compact">Loading QR…</p>
          </div>
        }
      >
        <AnimatedTokenQr token={token} size={size} className={className} />
      </Suspense>
    )
  }

  return (
    <div className={className}>
      <QRCodeSVG
        value={token}
        size={size}
        level="M"
        includeMargin
        bgColor="#ffffff"
        fgColor="#0f0f12"
      />
    </div>
  )
}
