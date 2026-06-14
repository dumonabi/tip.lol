export function scrollSectionToTop(element: HTMLElement | null | undefined) {
  if (!element) return

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}
