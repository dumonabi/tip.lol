type Props = {
  email: string
  onEmailChange: (value: string) => void
  disabled?: boolean
}

export function NotifyFields({ email, onEmailChange, disabled }: Props) {
  return (
    <div className="notify-block">
      <label className="field">
        <span className="notify-label-row">
          <span>Your email (optional)</span>
          <span className="badge-soon">Coming soon</span>
        </span>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={disabled}
        />
      </label>
    </div>
  )
}
