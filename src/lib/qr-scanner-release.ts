import type { Html5Qrcode } from 'html5-qrcode'

export function stopCameraTracks(container: ParentNode | null | undefined) {
  container?.querySelectorAll('video').forEach((video) => {
    const stream = video.srcObject
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    video.srcObject = null
  })
}

export async function releaseQrScanner(
  scanner: Html5Qrcode | null,
  readerId: string,
) {
  const readerEl = document.getElementById(readerId)
  stopCameraTracks(readerEl)

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

  stopCameraTracks(readerEl)
  if (readerEl) readerEl.innerHTML = ''
  document.getElementById('qr-shaded-region')?.remove()
}
