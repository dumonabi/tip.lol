type Props = {
  partiallySpent?: boolean
}

export function PartialBalanceNote({ partiallySpent = false }: Props) {
  return (
    <p className="partial-balance-note">
      {partiallySpent
        ? 'Only the remaining balance on this page can be used here.'
        : 'Change remains usable on this page.'}
    </p>
  )
}
