import type { ReactNode, Ref } from 'react'

type Props = {
  title: ReactNode
  children: ReactNode
  open: boolean
  onToggle: () => void
  rootRef?: Ref<HTMLElement>
}

export function Collapsible({
  title,
  children,
  open,
  onToggle,
  rootRef,
}: Props) {
  return (
    <section
      ref={rootRef}
      className={`panel collapsible ${open ? 'collapsible-open' : ''}`}
    >
      <button
        type="button"
        className="collapsible-summary"
        onClick={onToggle}
        aria-expanded={open}
      >
        {title}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  )
}
