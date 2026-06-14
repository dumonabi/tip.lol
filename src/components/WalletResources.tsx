const RESOURCE_GROUPS = [
  {
    label: 'Cashu wallets',
    links: [
      { name: 'cashu.me', url: 'https://cashu.me' },
      { name: 'Minibits', url: 'https://minibits.cash' },
    ],
  },
  {
    label: 'Lightning wallets',
    links: [{ name: 'Phoenix', url: 'https://phoenix.acinq.co' }],
  },
  {
    label: 'Bitcoin & fiat wallets',
    links: [{ name: 'Strike', url: 'https://strike.me' }],
  },
] as const

export function WalletResources() {
  return (
    <aside className="page-resources" aria-label="Recommended resources">
      <p className="page-resources-title">Recommended resources</p>
      <ul className="page-resources-list">
        {RESOURCE_GROUPS.map((group) => (
          <li key={group.label} className="page-resources-row">
            <span className="page-resources-label">{group.label}</span>
            <div className="page-resources-links">
              {group.links.map((link, index) => (
                <span key={link.url} className="page-resources-item">
                  {index > 0 && <span className="page-resources-sep" aria-hidden>·</span>}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="page-resource-link"
                  >
                    {link.name}
                  </a>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
