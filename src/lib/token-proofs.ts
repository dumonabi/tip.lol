export type ProofDenomination = {
  amount: number
  count: number
}

/** Group identical proof amounts, largest denominations first. */
export function groupProofDenominations(proofSats: number[]): ProofDenomination[] {
  const counts = new Map<number, number>()
  for (const amount of proofSats) {
    counts.set(amount, (counts.get(amount) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([amount, count]) => ({ amount, count }))
    .sort((a, b) => b.amount - a.amount)
}

export function describeProofGroups(groups: ProofDenomination[]): string {
  const total = groups.reduce((sum, group) => sum + group.count, 0)
  const parts = groups.map((group) =>
    group.count === 1
      ? `${group.amount.toLocaleString()} sats`
      : `${group.count} × ${group.amount.toLocaleString()} sats`,
  )
  return `${total} proofs: ${parts.join(', ')}`
}
