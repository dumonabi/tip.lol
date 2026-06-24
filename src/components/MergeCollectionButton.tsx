import { useState } from 'react'
import { mergeCollection } from '../lib/api'
import type { GiftPage } from '../../shared/types'

type Props = {
  pageId: string
  onMerged: (page: GiftPage) => void
}

export function MergeCollectionButton({ pageId, onMerged }: Props) {
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMerge() {
    setMerging(true)
    setError(null)
    try {
      const result = await mergeCollection(pageId)
      onMerged(result.page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not merge collection')
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="merge-collection-wrap">
      <button
        type="button"
        className="dock-btn primary merge-collection-btn"
        onClick={() => void handleMerge()}
        disabled={merging}
      >
        {merging ? 'Merging…' : 'Merge collection'}
      </button>
      {error && <p className="error compact">{error}</p>}
    </div>
  )
}
