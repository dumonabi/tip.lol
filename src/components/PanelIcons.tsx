import type { ReactNode } from 'react'

type IconProps = {
  className?: string
}

export function SpendPanelIcon({ className = 'panel-icon' }: IconProps) {
  return (
    <span className={`${className} panel-emoji`} aria-hidden>
      🛒
    </span>
  )
}

export function NotifyPanelIcon({ className = 'panel-icon' }: IconProps) {
  return (
    <span className={`${className} panel-emoji`} aria-hidden>
      🔔
    </span>
  )
}

export function PagePanelIcon({ className = 'panel-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden>
      <path
        d="M4 2.5h5.2L12.5 5.7V13.5H4V2.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M9 2.8V6h3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <span className="panel-title">{children}</span>
}
