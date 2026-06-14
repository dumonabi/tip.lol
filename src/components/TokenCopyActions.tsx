import { useMemo } from 'react'
import {
  CASHU_EMOJI_CARRIER,
  tryEncodeEmojiToken,
} from '../../shared/emoji-token'

type Props = {
  token: string
  onCopyToken: () => void
  onCopyEmoji: (encoded: string) => void
  copiedToken: boolean
  copiedEmoji: boolean
  /** When false (e.g. animated QR), hide emoji copy and center the text button */
  emojiCopy?: boolean
}

export function TokenCopyActions({
  token,
  onCopyToken,
  onCopyEmoji,
  copiedToken,
  copiedEmoji,
  emojiCopy = true,
}: Props) {
  const encoded = useMemo(() => tryEncodeEmojiToken(token), [token])
  const emojiAvailable = encoded !== null
  const showEmoji = emojiCopy && emojiAvailable

  return (
    <div className="token-copy-actions compact">
      <div className={`token-copy-row ${showEmoji ? '' : 'centered'}`}>
        <button type="button" className="dock-btn primary" onClick={onCopyToken}>
          {copiedToken ? 'Text copied!' : 'Copy as text'}
        </button>
        {showEmoji && (
          <button
            type="button"
            className="dock-btn secondary"
            onClick={() => {
              if (encoded) onCopyEmoji(encoded)
            }}
            aria-label={`Copy as ${CASHU_EMOJI_CARRIER} emoji token`}
          >
            {copiedEmoji ? (
              `${CASHU_EMOJI_CARRIER} copied!`
            ) : (
              <>
                Copy as{' '}
                <span className="copy-emoji-char">{CASHU_EMOJI_CARRIER}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
