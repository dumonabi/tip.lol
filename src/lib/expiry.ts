import { useEffect, useState } from 'react'
import { computeDaysRemaining } from '../../shared/types'

export function useDaysRemaining(expiresAt: number | null): number | null {
  const [days, setDays] = useState(() => computeDaysRemaining(expiresAt))

  useEffect(() => {
    setDays(computeDaysRemaining(expiresAt))

    const tick = () => setDays(computeDaysRemaining(expiresAt))
    const interval = window.setInterval(tick, 60_000)
    return () => window.clearInterval(interval)
  }, [expiresAt])

  return days
}

export function formatDaysRemaining(days: number | null): string | null {
  if (days === null) return null
  if (days <= 0) return 'Expired'
  if (days === 1) return '1 day left'
  return `${days} days left`
}

export function formatExpiryDate(expiresAt: number | null): string | null {
  if (!expiresAt) return null
  return new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
