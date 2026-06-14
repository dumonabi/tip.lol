export async function svgToPngBlob(svg: SVGElement): Promise<Blob> {
  const svgData = new XMLSerializer().serializeToString(svg)
  const svgUrl = URL.createObjectURL(
    new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }),
  )

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = svgUrl
    })

    const scale = 3
    const canvas = document.createElement('canvas')
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create image')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Export failed'))),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export async function downloadQrFromContainer(
  container: HTMLElement | null,
  filename: string,
): Promise<void> {
  const svg = container?.querySelector('svg')
  if (!svg) throw new Error('QR not found')

  const blob = await svgToPngBlob(svg)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
