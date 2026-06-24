import {
  describeProofGroups,
  groupProofDenominations,
} from '../lib/token-proofs'
import { SatSymbol } from './SatSymbol'

type Props = {
  proofSats: number[] | null
  loading: boolean
  error: boolean
  errorMessage?: string
  align?: 'start' | 'end' | 'center'
  showTotalCount?: boolean
}

export function TokenProofBills({
  proofSats,
  loading,
  error,
  errorMessage,
  align = 'start',
  showTotalCount = false,
}: Props) {
  if (loading) {
    return <p className="token-proof-status">Loading proof details…</p>
  }

  if (error || !proofSats || proofSats.length === 0) {
    return (
      <p className="token-proof-status">
        {errorMessage ?? 'Proof details unavailable'}
      </p>
    )
  }

  const groups = groupProofDenominations(proofSats)
  const totalProofs = proofSats.length

  return (
    <div
      className={`token-proof-bills token-proof-bills-align-${align}`}
      aria-label={describeProofGroups(groups)}
    >
      {showTotalCount && (
        <p className="token-proof-total">
          {totalProofs} {totalProofs === 1 ? 'proof' : 'proofs'}
        </p>
      )}
      <ul className="token-proof-bills-col">
        {groups.map(({ amount, count }) => (
          <li key={amount} className="token-proof-bill-row">
            <div className="token-proof-bill-anchor">
              <div
                className="token-proof-bill"
                data-digits={String(amount).length}
                title={`${amount.toLocaleString()} sats`}
              >
                <span className="token-proof-bill-amount">
                  {amount.toLocaleString()}
                </span>
                <SatSymbol className="token-proof-bill-sat" />
              </div>
              <span
                className={`token-proof-bill-mult${count > 1 ? '' : ' token-proof-bill-mult--empty'}`}
                aria-hidden={count <= 1}
                aria-label={count > 1 ? `times ${count}` : undefined}
              >
                {count > 1 ? `×${count}` : '×'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
