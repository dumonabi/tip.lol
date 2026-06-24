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

export function SplitCollectionPanelIcon({ className = 'panel-icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5.5" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
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

export function OpenInNewWindowIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <rect
        x="2.6"
        y="5.4"
        width="7.8"
        height="7.8"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5.6 2.6h7.8v7.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.4 2.6 5.4 8.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </ShareIcon>
  )
}

export function ExternalLinkIcon({ className }: IconProps) {
  return <OpenInNewWindowIcon className={className} />
}

export function CheckIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <path d="M3.5 8.2 6.4 11l6.1-6.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </ShareIcon>
  )
}

export function WarningIcon({ className }: IconProps) {
  return (
    <ShareIcon className={className}>
      <path
        d="M8 2.8 13.9 12.8H2.1L8 2.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M8 6.1v3.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.7" fill="currentColor" />
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

/** Circular swap — bold refresh arrows */
export function SwapIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'share-action-icon'}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
    >
      <path
        d="M17.8 9.2a7 7 0 0 0-12.1-2.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M16.2 9.2h3.1V6.1"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 14.8a7 7 0 0 0 12.1 2.2"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M7.8 14.8H4.7v3.1"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Padlock — secure balance toggle */
export function SecureLockIcon({ className }: IconProps) {
  return (
    <svg
      className={className ?? 'share-action-icon'}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
    >
      <path
        d="M7.25 11V8.75a4.75 4.75 0 0 1 9.5 0V11"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5.25"
        y="11"
        width="13.5"
        height="9.75"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="2.35"
      />
      <circle cx="12" cy="14.5" r="1.05" fill="currentColor" />
      <path
        d="M12 15.45v1.2"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** @deprecated use SecureLockIcon */
export function SecureVaultIcon({ className }: IconProps) {
  return <SecureLockIcon className={className} />
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
