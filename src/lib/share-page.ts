export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed'

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

export function canUseNativeShare(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    window.isSecureContext
  )
}

/** Try the system share sheet (WhatsApp, Mail, Messages, etc.). */
export async function sharePageLink(pageUrl: string): Promise<ShareResult> {
  if (!canUseNativeShare()) {
    return 'failed'
  }

  const attempts: ShareData[] = [
    { url: pageUrl },
    { title: 'Cashu gift', url: pageUrl },
    { text: `Cashu gift page\n${pageUrl}` },
  ]

  for (const data of attempts) {
    try {
      if (typeof navigator.canShare === 'function' && !navigator.canShare(data)) {
        continue
      }
      await navigator.share(data)
      return 'shared'
    } catch (err) {
      if (isAbortError(err)) return 'cancelled'
    }
  }

  return 'failed'
}

export async function copyPageLink(pageUrl: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(pageUrl)
    return true
  } catch {
    return false
  }
}

export function whatsAppShareUrl(pageUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`Cashu gift: ${pageUrl}`)}`
}

export function emailShareUrl(pageUrl: string): string {
  const subject = encodeURIComponent('Cashu gift')
  const body = encodeURIComponent(`Open this gift page:\n\n${pageUrl}`)
  return `mailto:?subject=${subject}&body=${body}`
}

export function telegramShareUrl(pageUrl: string): string {
  const url = encodeURIComponent(pageUrl)
  const text = encodeURIComponent('Cashu gift')
  return `https://t.me/share/url?url=${url}&text=${text}`
}

export function smsShareUrl(pageUrl: string): string {
  return `sms:?body=${encodeURIComponent(`Cashu gift: ${pageUrl}`)}`
}
