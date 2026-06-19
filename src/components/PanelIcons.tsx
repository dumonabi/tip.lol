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

export function ExchangePanelIcon({ className = 'panel-icon' }: IconProps) {
  return (
    <span className={`${className} panel-emoji`} aria-hidden>
      ⇄
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

function ShareIcon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg className={className ?? 'share-action-icon'} viewBox="0 0 16 16" aria-hidden>
      {children}
    </svg>
  )
}

export function QrCodeIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <rect x="2" y="2" width="5" height="5" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M11 9h1.5v1.5M13.5 11v1.5M11 13.5h1.5M13.5 13.5h1.5v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </ShareIcon>
  )
}

export function CopyIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <rect x="5.2" y="5.2" width="7.3" height="8.3" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M4.5 10.8V4.5a1 1 0 0 1 1-1H10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </ShareIcon>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <path d="M8 2.5v7.2M5.4 7.1 8 9.7l2.6-2.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 12.5h9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </ShareIcon>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <path d="M3.5 8.2 6.4 11l6.1-6.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </ShareIcon>
  )
}

export function InfoIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7.1V11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.75" fill="currentColor" />
    </ShareIcon>
  )
}

export function MagicWandIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'share-action-icon'}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
    >
      <path
        d="M4.2 18.8 14.2 8.8"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="15.2" cy="7.8" r="1.65" fill="currentColor" />
      <path
        d="M18.1 2.6 19.2 6.2 22.8 7.3 19.2 8.4 18.1 12 17 8.4 13.4 7.3 17 6.2Z"
        fill="currentColor"
      />
      <path
        d="M2.8 6.8 3.45 8.55 5.2 9.2 3.45 9.85 2.8 11.6 2.15 9.85 0.4 9.2 2.15 8.55Z"
        fill="currentColor"
      />
      <path
        d="M7.8 2.2 8.25 4.2 10.25 4.65 8.25 5.1 7.8 7.1 7.35 5.1 5.35 4.65 7.35 4.2Z"
        fill="currentColor"
      />
      <path
        d="M20.4 12.2 20.95 14.1 22.85 14.65 20.95 15.2 20.4 17.1 19.85 15.2 17.95 14.65 19.85 14.1Z"
        fill="currentColor"
      />
      <path
        d="M5.6 13.8 6 15.35 7.55 15.75 6 16.15 5.6 17.7 5.2 16.15 3.65 15.75 5.2 15.35Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function ShareLinkIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <path
        d="M8 2.6v6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M5.4 5.2 8 2.6l2.6 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3.5"
        y="7.6"
        width="9"
        height="5.8"
        rx="1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </ShareIcon>
  )
}
