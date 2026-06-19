import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPage } from '../lib/api'

export function Home() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    createPage()
      .then((page) => {
        if (!cancelled) {
          navigate(`/g/${page.id}`, { replace: true })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof Error && err.name === 'TimeoutError') {
            setError('The server took too long to respond. Please try again.')
            return
          }
          setError(
            err instanceof Error ? err.message : 'Could not open a gift page',
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <section className="panel">
        <h1>Something went wrong</h1>
        <p className="error">{error}</p>
        <button
          type="button"
          className="primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
    )
  }

  return <p className="status">Opening your gift page…</p>
}
