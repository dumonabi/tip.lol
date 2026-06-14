import { URDecoder } from '@gandlaf21/bc-ur'
import { resolveTokenFromInput } from '../../shared/emoji-token'

export type UrScanProgress = {
  scanning: boolean
  percent: number
  partsReceived: number
  partsExpected: number
}

function readProgress(decoder: URDecoder, scanning: boolean): UrScanProgress {
  const partsExpected = decoder.expectedPartCount() ?? 0
  const partsReceived = decoder.receivedPartIndexes()?.length ?? 0
  const ratio = decoder.estimatedPercentComplete()
  return {
    scanning,
    percent: Math.min(100, Math.round(ratio * 100)),
    partsReceived,
    partsExpected,
  }
}

export function createUrTokenDecoder() {
  let decoder = new URDecoder()

  return {
    reset() {
      decoder = new URDecoder()
    },

    isUrPart(data: string): boolean {
      return data.trim().toLowerCase().startsWith('ur:')
    },

    addPart(part: string): {
      accepted: boolean
      complete: boolean
      token: string | null
      error: string | null
      progress: UrScanProgress
    } {
      const normalized = part.trim().toLowerCase()

      if (!normalized.startsWith('ur:')) {
        return {
          accepted: false,
          complete: false,
          token: null,
          error: null,
          progress: readProgress(decoder, false),
        }
      }

      try {
        const accepted = decoder.receivePart(normalized)

        if (decoder.isError()) {
          return {
            accepted,
            complete: false,
            token: null,
            error: decoder.resultError() || 'Could not read animated QR',
            progress: readProgress(decoder, false),
          }
        }

        if (decoder.isSuccess()) {
          const bytes = decoder.resultUR().decodeCBOR()
          const payload = new TextDecoder().decode(bytes)
          const token = resolveTokenFromInput(payload)
          return {
            accepted,
            complete: true,
            token,
            error: token ? null : 'Decoded animated QR is not a Cashu token',
            progress: readProgress(decoder, false),
          }
        }

        return {
          accepted,
          complete: false,
          token: null,
          error: null,
          progress: readProgress(decoder, true),
        }
      } catch (err) {
        return {
          accepted: false,
          complete: false,
          token: null,
          error: err instanceof Error ? err.message : 'Animated QR decode failed',
          progress: readProgress(decoder, true),
        }
      }
    },
  }
}
