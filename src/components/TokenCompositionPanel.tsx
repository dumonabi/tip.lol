import { useEffect, useState } from 'react'
import { fetchPageTokenProofs } from '../lib/api'
import type { GiftPage, TokenProofDetail } from '../../shared/types'
import { ProofSplitEditor } from './ProofSplitEditor'
import { TokenProofBills } from './TokenProofBills'

type Props = {
  page: GiftPage
  tokenIndex?: number
  allowSplit?: boolean
  onPageUpdated?: (page: GiftPage) => void
}

export function TokenCompositionPanel({
  page,
  tokenIndex,
  allowSplit = true,
  onPageUpdated,
}: Props) {
  const primaryToken = page.tokens[0]
  const [loading, setLoading] = useState(true)
  const [proofs, setProofs] = useState<TokenProofDetail[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [splitOpen, setSplitOpen] = useState(false)

  useEffect(() => {
    if (!primaryToken) return

    let cancelled = false
    setLoading(true)
    setProofs(null)
    setLoadError(null)
    setSplitOpen(false)

    void fetchPageTokenProofs(page.id, tokenIndex)
      .then((data) => {
        if (!cancelled) setProofs(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setProofs([])
          setLoadError(
            err instanceof Error ? err.message : 'Could not load token composition',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [page.id, primaryToken?.token, tokenIndex])

  if (!primaryToken) return null

  const proofSats = proofs?.map((proof) => proof.amountSats) ?? null
  const canSplit = allowSplit && (proofs?.length ?? 0) >= 2

  return (
    <div className="token-composition-panel">
      {loading ? (
        <p className="hint compact">Loading token composition…</p>
      ) : (
        <>
          <div className="token-proof-col-align">
            <p className="token-proof-col-align__slot token-proof-count-label">
              {proofs && proofs.length > 0 ? (
                <>
                  {proofs.length}{' '}
                  {proofs.length === 1 ? 'proof' : 'proofs'}
                </>
              ) : (
                'No proofs'
              )}
            </p>
          </div>
          <TokenProofBills
            proofSats={proofSats}
            loading={false}
            error={Boolean(loadError) || !proofSats || proofSats.length === 0}
            errorMessage={loadError ?? undefined}
            align="center"
          />

          {canSplit && (
            <div className="token-composition-split">
              <button
                type="button"
                className={`dock-btn secondary token-composition-split-btn${splitOpen ? ' active' : ''}`}
                onClick={() => setSplitOpen((open) => !open)}
                aria-expanded={splitOpen}
              >
                Split
              </button>

              {splitOpen && proofs && (
                <ProofSplitEditor
                  pageId={page.id}
                  proofs={proofs}
                  onSuccess={onPageUpdated}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
