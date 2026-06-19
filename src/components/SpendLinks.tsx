import type { SpendOption } from '../../shared/types'
import { RedeemMenuHint } from './RedeemMenuHint'

type Props = {
  options: SpendOption[]
}

export function SpendLinks({ options }: Props) {
  if (options.length === 0) return null

  return (
    <ul className="spend-list">
      {options.map((item) => (
        <li key={item.url}>
          <div className="spend-card">
            <a href={item.url} target="_blank" rel="noreferrer" className="spend-card-title">
              <strong>{item.name}</strong>
            </a>
            <p className="spend-desc">
              {item.description} <RedeemMenuHint />
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
