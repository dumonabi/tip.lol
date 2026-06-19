import { useCallback, useEffect, useState } from 'react'
import {
  optimizePageToken,
  previewTokenOptimize,
} from '../lib/api'
import type { GiftPage, TokenOptimizePreview } from '../../shared/types'
import { MagicWandIcon } from './PanelIcons'
import { SatSymbol } from './SatSymbol'
import { TokenProofBills } from './TokenProofBills'

type Props = {
  pageId: string
  onOptimized: (page: GiftPage) => void
  enabled?: boolean
  embedded?: boolean
}

function MintFeeLine({ feeSats }: { feeSats: number }) {
  return (
    <div className="token-proof-col-align">
      <p className="token-proof-col-align__slot optimize-mint-cost-line">
        Mint fee:{' '}
        {feeSats === 0 ? (
          <>
            0 <SatSymbol className="optimize-mint-sat" /> (free)
          </>
        ) : (
          <>
            {feeSats.toLocaleString()} <SatSymbol className="optimize-mint-sat" />
          </>
        )}
      </p>
    </div>
  )
}

function OptimizeProofCompare({
  preview,
  embedded = false,
}: {
  preview: TokenOptimizePreview
  embedded?: boolean
}) {
  if (embedded) {
    return (
      <div className="optimize-proof-compare optimize-proof-compare--embedded">
        <div className="token-proof-col-align">
          <p className="token-proof-col-align__slot token-proof-count-label token-proof-count-label--accent">
            Convert to {preview.estimatedProofCount}{' '}
            {preview.estimatedProofCount === 1 ? 'proof' : 'proofs'}
          </p>
        </div>
        <TokenProofBills
          proofSats={preview.estimatedProofSats}
          loading={false}
          error={false}
          align="center"
        />
        <MintFeeLine feeSats={preview.feeSats} />
      </div>
    )
  }

  return (
    <div className="optimize-proof-compare">
      <p className="optimize-proof-summary">
        <span className="optimize-proof-summary-count optimize-proof-summary-count--now">
          {preview.currentProofCount} proofs
        </span>
        <span className="optimize-proof-summary-count optimize-proof-summary-count--after">
          {preview.estimatedProofCount} proofs
        </span>
      </p>
      <div className="optimize-proof-grid">
        <p className="optimize-proof-column-label optimize-proof-column-label--now">Now</p>
        <p className="optimize-proof-column-label optimize-proof-column-label--after">After</p>
        <div className="optimize-proof-bills optimize-proof-bills--now">
          <TokenProofBills
            proofSats={preview.currentProofSats}
            loading={false}
            error={false}
            align="start"
          />
          <div className="optimize-proof-flow" aria-hidden>
            <span className="optimize-proof-flow-arrow" />
          </div>
        </div>
        <div className="optimize-proof-bills optimize-proof-bills--after">
          <TokenProofBills
            proofSats={preview.estimatedProofSats}
            loading={false}
            error={false}
            align="end"
          />
        </div>
      </div>
      <MintFeeLine feeSats={preview.feeSats} />
    </div>
  )
}

export function TokenOptimize({
  pageId,
  onOptimized,
  enabled = true,
  embedded = false,
}: Props) {
  const [preview, setPreview] = useState<TokenOptimizePreview | null>(null)
  const [previewing, setPreviewing] = useState(enabled)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeError, setOptimizeError] = useState<string | null>(null)
  const [checkKey, setCheckKey] = useState(0)

  const runPreview = useCallback(async () => {
    setPreviewing(true)
    setOptimizeError(null)
    try {
      const data = await previewTokenOptimize(pageId)
      setPreview(data)
    } catch {
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }, [pageId])

  useEffect(() => {
    if (!enabled) {
      setPreview(null)
      setPreviewing(false)
      setOptimizeError(null)
      return
    }
    void runPreview()
  }, [runPreview, checkKey, enabled])

  async function handleOptimize() {
    if (!preview?.worthOptimizing) return
    setOptimizing(true)
    setOptimizeError(null)
    try {
      const result = await optimizePageToken(pageId)
      onOptimized(result.page)
      setCheckKey((n) => n + 1)
    } catch (err) {
      setOptimizeError(
        err instanceof Error ? err.message : 'Could not optimize token',
      )
    } finally {
      setOptimizing(false)
    }
  }

  const reducesProofs =
    preview != null && preview.estimatedProofCount < preview.currentProofCount

  const showOffer = !previewing && reducesProofs && preview?.worthOptimizing === true

  const showAlreadyOptimal =
    !previewing && !optimizing && preview != null && !reducesProofs

  if (!showOffer && !showAlreadyOptimal && !optimizing) {
    return null
  }

  if (showAlreadyOptimal) {
    return (
      <div className="token-optimize token-optimize--embedded token-optimize--already">
        <div className="token-proof-col-align">
          <p className="token-proof-col-align__slot token-proof-count-label token-proof-count-label--accent">
            Already optimized
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`token-optimize ${embedded ? 'token-optimize--embedded' : ''}`}>
      {!embedded && <p className="token-optimize-heading">Fewer proofs possible</p>}

      {preview && (
        <div className="token-optimize-quote">
          <OptimizeProofCompare preview={preview} embedded={embedded} />

          <div className="token-proof-col-align">
            <div className="token-proof-col-align__slot token-optimize-actions">
              <button
                type="button"
                className="dock-btn primary token-optimize-confirm"
                onClick={() => void handleOptimize()}
                disabled={optimizing}
              >
                {optimizing ? (
                  'Optimizing…'
                ) : (
                  <>
                    <MagicWandIcon className="token-optimize-icon" />
                    <span>Optimize</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {optimizeError && <p className="error compact">{optimizeError}</p>}
    </div>
  )
}
