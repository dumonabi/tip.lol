import { useMemo, useState } from 'react'
import type { GiftPage, TokenProofDetail } from '../../shared/types'
import { splitPageIntoCollection } from '../lib/api'
import {
  balancedAssignment,
  buildPartsFromAssignment,
  countMatchingInPart,
  groupProofsInPart,
  moveProofIndices,
  parseDragPayload,
  partTotals,
  pullMatchingProofs,
  setGroupCountInPart,
  splitIsReady,
  type ProofGroup,
} from '../lib/proof-split'
import { SatSymbol } from './SatSymbol'

type Props = {
  pageId: string
  proofs: TokenProofDetail[]
  onSuccess?: (page: GiftPage) => void
}

function ProofBill({
  amountSats,
  count,
  draggable,
  onDragStart,
}: {
  amountSats: number
  count: number
  draggable: boolean
  onDragStart?: (event: React.DragEvent) => void
}) {
  return (
    <div
      className={`proof-split-bill${draggable ? ' proof-split-bill--draggable' : ''}`}
      data-digits={String(amountSats).length}
      draggable={draggable}
      onDragStart={onDragStart}
      title={`${amountSats.toLocaleString()} sats${count > 1 ? ` × ${count}` : ''}`}
    >
      <span className="proof-split-bill-amount">{amountSats.toLocaleString()}</span>
      <SatSymbol className="proof-split-bill-sat" />
      {count > 1 && <span className="proof-split-bill-mult">×{count}</span>}
    </div>
  )
}

function ProofGroupStack({
  group,
  part,
  homePart,
  proofs,
  assignment,
  onMoveAll,
  onAdjustCount,
}: {
  group: ProofGroup
  part: number
  homePart: number
  proofs: TokenProofDetail[]
  assignment: number[]
  onMoveAll: (group: ProofGroup, toPart: number) => void
  onAdjustCount: (group: ProofGroup, part: number, delta: number) => void
}) {
  const count = group.indices.length
  const availableInHome = countMatchingInPart(
    proofs,
    assignment,
    homePart,
    group.amountSats,
  )
  const showStepper = count > 1 && part !== homePart

  function handleDragStart(event: React.DragEvent) {
    const payload = {
      indices: group.indices,
      amountSats: group.amountSats,
      fromPart: part,
    }
    event.dataTransfer.setData('application/x-cashu-proofs', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="proof-split-stack">
      <ProofBill
        amountSats={group.amountSats}
        count={count}
        draggable
        onDragStart={handleDragStart}
      />
      {showStepper && (
        <div className="proof-split-stepper" aria-label="How many proofs stay in this token">
          <button
            type="button"
            className="proof-split-stepper-btn"
            onClick={() => onAdjustCount(group, part, -1)}
            disabled={count <= 1}
            aria-label="Move one proof back to token 1"
          >
            −
          </button>
          <span className="proof-split-stepper-count">{count}</span>
          <button
            type="button"
            className="proof-split-stepper-btn"
            onClick={() => onAdjustCount(group, part, 1)}
            disabled={availableInHome <= 0}
            aria-label="Pull one more matching proof from token 1"
          >
            +
          </button>
        </div>
      )}
      {count > 1 && part === homePart && (
        <p className="hint compact proof-split-stack-hint">
          Drag the stack to another token. Use − / + there to move some back.
        </p>
      )}
      {count > 1 && part !== homePart && (
        <button
          type="button"
          className="ghost small proof-split-move-all"
          onClick={() => onMoveAll(group, homePart)}
        >
          Move all to token 1
        </button>
      )}
    </div>
  )
}

function TokenColumn({
  label,
  part,
  homePart,
  proofs,
  assignment,
  onDrop,
  onMoveAll,
  onAdjustCount,
}: {
  label: string
  part: number
  homePart: number
  proofs: TokenProofDetail[]
  assignment: number[]
  onDrop: (fromPart: number, indices: number[], toPart: number) => void
  onMoveAll: (group: ProofGroup, toPart: number) => void
  onAdjustCount: (group: ProofGroup, part: number, delta: number) => void
}) {
  const groups = useMemo(
    () => groupProofsInPart(proofs, assignment, part),
    [proofs, assignment, part],
  )
  const totalSats = partTotals(proofs, assignment, part)

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/x-cashu-proofs')
    const payload = parseDragPayload(raw)
    if (!payload || payload.fromPart === part) return
    onDrop(payload.fromPart, payload.indices, part)
  }

  return (
    <div
      className="proof-split-column"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="proof-split-column-head">
        <h4 className="proof-split-column-title">{label}</h4>
        <p className="proof-split-column-total">
          {totalSats.toLocaleString()} <SatSymbol className="proof-split-bill-sat" />
        </p>
      </div>
      <div className="proof-split-column-body">
        {groups.length === 0 ? (
          <p className="proof-split-drop-hint">Drop proofs here</p>
        ) : (
          groups.map((group) => (
            <ProofGroupStack
              key={`${part}-${group.amountSats}`}
              group={group}
              part={part}
              homePart={homePart}
              proofs={proofs}
              assignment={assignment}
              onMoveAll={onMoveAll}
              onAdjustCount={onAdjustCount}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function ProofSplitEditor({ pageId, proofs, onSuccess }: Props) {
  const maxParts = proofs.length
  const [partCount, setPartCount] = useState(2)
  const [assignment, setAssignment] = useState(() => balancedAssignment(proofs, 2))
  const [splitting, setSplitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const ready = splitIsReady(assignment, partCount)

  function handlePartCountChange(raw: string) {
    const nextCount = Number(raw)
    if (!Number.isInteger(nextCount) || nextCount < 2 || nextCount > maxParts) return
    setPartCount(nextCount)
    setAssignment(balancedAssignment(proofs, nextCount))
  }

  function handleDrop(_fromPart: number, indices: number[], toPart: number) {
    setAssignment((current) => moveProofIndices(current, indices, toPart))
  }

  function handleMoveAll(group: ProofGroup, toPart: number) {
    setAssignment((current) => moveProofIndices(current, group.indices, toPart))
  }

  function handleAdjustCount(group: ProofGroup, part: number, delta: number) {
    setAssignment((current) => {
      const count = group.indices.length
      if (delta < 0) {
        return setGroupCountInPart(current, group.indices, part, count + delta)
      }
      return pullMatchingProofs(
        current,
        proofs,
        group.amountSats,
        0,
        part,
        delta,
      )
    })
  }

  async function handleCreate() {
    if (!ready) return
    setSplitting(true)
    setActionError(null)
    try {
      const parts = buildPartsFromAssignment(assignment, partCount)
      const result = await splitPageIntoCollection(pageId, parts)
      onSuccess?.(result.page)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not create collection',
      )
    } finally {
      setSplitting(false)
    }
  }

  return (
    <div className="proof-split-editor">
      <div className="proof-split-controls">
        <label className="proof-split-count-label">
          Tokens
          <select
            className="proof-split-count-select"
            value={partCount}
            onChange={(event) => handlePartCountChange(event.target.value)}
          >
            {Array.from({ length: maxParts - 1 }, (_, i) => i + 2).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <p className="hint compact proof-split-help">
          Proofs start balanced across tokens (similar counts, then similar amounts).
          Drag to adjust — matching amounts move together; use − / + to split a stack.
        </p>
      </div>

      <div
        className="proof-split-columns"
        style={{ gridTemplateColumns: `repeat(${partCount}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: partCount }, (_, part) => (
          <TokenColumn
            key={part}
            label={`Token ${part + 1}`}
            part={part}
            homePart={0}
            proofs={proofs}
            assignment={assignment}
            onDrop={handleDrop}
            onMoveAll={handleMoveAll}
            onAdjustCount={handleAdjustCount}
          />
        ))}
      </div>

      <button
        type="button"
        className="dock-btn primary"
        disabled={!ready || splitting}
        onClick={() => void handleCreate()}
      >
        {splitting ? 'Creating collection…' : 'Create collection'}
      </button>

      {actionError && <p className="error compact">{actionError}</p>}
    </div>
  )
}
