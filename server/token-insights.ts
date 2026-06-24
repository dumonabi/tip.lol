import { listTokenProofSats } from './claim-check.js'
import type { TokenInsights } from '../shared/types.js'

export function buildTokenInsights(token: string): TokenInsights {
  const proofSats = listTokenProofSats(token)
  return { proofSats }
}
