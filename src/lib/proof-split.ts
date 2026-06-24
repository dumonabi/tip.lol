import type { TokenProofDetail } from '../../shared/types'

export type ProofGroup = {
  amountSats: number
  indices: number[]
}

export function initialAssignment(proofCount: number): number[] {
  return Array.from({ length: proofCount }, () => 0)
}

/** Per-token proof targets: differ by at most one when counts cannot divide evenly. */
export function balancedProofTargets(
  proofCount: number,
  partCount: number,
): number[] {
  const base = Math.floor(proofCount / partCount)
  const remainder = proofCount % partCount
  return Array.from({ length: partCount }, (_, part) =>
    base + (part < remainder ? 1 : 0),
  )
}

/**
 * Assign proofs so each token gets a similar proof count, then similar sats total.
 * Proof-count balance is a hard constraint; amounts are balanced greedily within it.
 */
export function balancedAssignment(
  proofs: TokenProofDetail[],
  partCount: number,
): number[] {
  const proofCount = proofs.length
  if (partCount < 2 || proofCount < partCount) {
    return initialAssignment(proofCount)
  }

  const targets = balancedProofTargets(proofCount, partCount)
  const sums = Array.from({ length: partCount }, () => 0)
  const counts = Array.from({ length: partCount }, () => 0)
  const assignment = Array.from({ length: proofCount }, () => 0)

  const sorted = [...proofs].sort(
    (a, b) => b.amountSats - a.amountSats || a.index - b.index,
  )

  for (const proof of sorted) {
    let bestPart = 0
    let bestSum = Infinity

    for (let part = 0; part < partCount; part++) {
      if (counts[part]! >= targets[part]!) continue
      const sum = sums[part]!
      if (sum < bestSum || (sum === bestSum && part < bestPart)) {
        bestSum = sum
        bestPart = part
      }
    }

    assignment[proof.index] = bestPart
    counts[bestPart]!++
    sums[bestPart]! += proof.amountSats
  }

  return assignment
}

export function buildPartsFromAssignment(
  assignment: number[],
  partCount: number,
): number[][] {
  const parts = Array.from({ length: partCount }, () => [] as number[])
  for (let index = 0; index < assignment.length; index++) {
    const part = assignment[index]!
    parts[part]?.push(index)
  }
  return parts
}

export function groupProofsInPart(
  proofs: TokenProofDetail[],
  assignment: number[],
  part: number,
): ProofGroup[] {
  const byAmount = new Map<number, number[]>()

  for (const proof of proofs) {
    if (assignment[proof.index] !== part) continue
    const bucket = byAmount.get(proof.amountSats) ?? []
    bucket.push(proof.index)
    byAmount.set(proof.amountSats, bucket)
  }

  return [...byAmount.entries()]
    .map(([amountSats, indices]) => ({
      amountSats,
      indices: [...indices].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.amountSats - a.amountSats)
}

export function moveProofIndices(
  assignment: number[],
  indices: number[],
  toPart: number,
): number[] {
  const next = [...assignment]
  for (const index of indices) {
    next[index] = toPart
  }
  return next
}

/** Keep `keepCount` proofs in `part`; send the rest back to part 0. */
export function setGroupCountInPart(
  assignment: number[],
  indices: number[],
  part: number,
  keepCount: number,
): number[] {
  const next = [...assignment]
  const clamped = Math.max(0, Math.min(indices.length, keepCount))
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]!
    next[index] = i < clamped ? part : 0
  }
  return next
}

export function clampAssignmentForPartCount(
  assignment: number[],
  partCount: number,
): number[] {
  const next = assignment.map((part) => (part >= partCount ? 0 : part))
  const counts = Array.from({ length: partCount }, () => 0)
  for (const part of next) counts[part] = (counts[part] ?? 0) + 1

  for (let part = 1; part < partCount; part++) {
    if (counts[part]! > 0) continue
    const donor = next.findIndex((value) => value === 0)
    if (donor === -1) break
    next[donor] = part
    counts[0]!--
    counts[part]!++
  }

  return next
}

export function pullMatchingProofs(
  assignment: number[],
  proofs: TokenProofDetail[],
  amountSats: number,
  fromPart: number,
  toPart: number,
  count: number,
): number[] {
  const next = [...assignment]
  let moved = 0
  for (const proof of proofs) {
    if (moved >= count) break
    if (next[proof.index] === fromPart && proof.amountSats === amountSats) {
      next[proof.index] = toPart
      moved++
    }
  }
  return next
}

export function countMatchingInPart(
  proofs: TokenProofDetail[],
  assignment: number[],
  part: number,
  amountSats: number,
): number {
  return proofs.reduce(
    (sum, proof) =>
      assignment[proof.index] === part && proof.amountSats === amountSats
        ? sum + 1
        : sum,
    0,
  )
}

export function splitIsReady(assignment: number[], partCount: number): boolean {
  if (partCount < 2) return false
  const counts = Array.from({ length: partCount }, () => 0)
  for (const part of assignment) {
    if (part < 0 || part >= partCount) return false
    counts[part] = (counts[part] ?? 0) + 1
  }
  return counts.every((count) => count > 0)
}

export function partTotals(
  proofs: TokenProofDetail[],
  assignment: number[],
  part: number,
): number {
  return proofs.reduce(
    (sum, proof) =>
      assignment[proof.index] === part ? sum + proof.amountSats : sum,
    0,
  )
}

export type DragProofPayload = {
  indices: number[]
  amountSats: number
  fromPart: number
}

export function parseDragPayload(raw: string): DragProofPayload | null {
  try {
    const data = JSON.parse(raw) as DragProofPayload
    if (
      !Array.isArray(data.indices) ||
      typeof data.amountSats !== 'number' ||
      typeof data.fromPart !== 'number'
    ) {
      return null
    }
    return data
  } catch {
    return null
  }
}
