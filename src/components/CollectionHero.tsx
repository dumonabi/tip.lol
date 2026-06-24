import type { GiftPage } from '../../shared/types'
import { SatSymbol } from './SatSymbol'
import { CollectionTokenCard } from './CollectionTokenCard'

type Props = {
  page: GiftPage
  onCopyToken: (token: string, index: number) => void
  onCopyEmoji: (emoji: string, index: number) => void
  copiedTokenIndex: number | null
  copiedEmojiIndex: number | null
  onCollectionUpdated?: (page: GiftPage) => void
}

export function CollectionHero({
  page,
  onCopyToken,
  onCopyEmoji,
  copiedTokenIndex,
  copiedEmojiIndex,
  onCollectionUpdated,
}: Props) {
  if (page.tokens.length === 0) return null

  const totalSats = page.amountSats ?? 0

  return (
    <div className="collection-hero">
      <p className="collection-hero-summary">
        <strong>{page.tokens.length}</strong> tokens ·{' '}
        <span className="gift-amount-sats inline-amount">
          {totalSats.toLocaleString()}
          <SatSymbol />
        </span>{' '}
        total
      </p>

      <div className="collection-token-stack">
        {page.tokens.map((entry, index) => (
          <CollectionTokenCard
            key={`${entry.addedAt}:${index}`}
            collectionId={page.id}
            entry={entry}
            index={index}
            onCopyToken={onCopyToken}
            onCopyEmoji={onCopyEmoji}
            copiedToken={copiedTokenIndex === index}
            copiedEmoji={copiedEmojiIndex === index}
            onCollectionUpdated={onCollectionUpdated}
          />
        ))}
      </div>
    </div>
  )
}
