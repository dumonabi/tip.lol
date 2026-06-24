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

export function formatPageValidUntil(expiresAt: number | null): string | null {
  const date = formatExpiryDate(expiresAt)
  if (!date) return null
  return `page valid until ${date}`
}

export function formatExpiryDate(expiresAt: number | null): string | null {
  if (!expiresAt) return null
  return new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
