import { getEncodedToken } from '@cashu/cashu-ts'
import { decodeTokenOffline, decodeTokenResolving } from './token-context.js'

export class MergeCollectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MergeCollectionError'
  }
}

export async function mergeTokensOffline(tokenStrings: string[]) {
  if (tokenStrings.length < 2) {
    throw new MergeCollectionError('Need at least two tokens to merge')
  }

  const first = await decodeTokenResolving(tokenStrings[0]!)
  const allProofs = [...first.proofs]

  for (const tokenString of tokenStrings.slice(1)) {
    const decoded = await decodeTokenResolving(tokenString)
    if (decoded.meta.mint !== first.meta.mint || decoded.meta.unit !== first.meta.unit) {
      throw new MergeCollectionError('All tokens must use the same mint and unit')
    }
    if (decoded.proofs.length === 0) {
      throw new MergeCollectionError('One of the tokens has no proofs')
    }
    allProofs.push(...decoded.proofs)
  }

  const mergedToken = getEncodedToken({
    mint: first.meta.mint,
    unit: first.meta.unit,
    proofs: allProofs,
  })
  const amountSats = allProofs.reduce(
    (sum, proof) => sum + proof.amount.toNumber(),
    0,
  )

  if (amountSats <= 0) {
    throw new MergeCollectionError('Merged token amount must be greater than zero')
  }

  return {
    token: mergedToken,
    amountSats,
    unit: first.meta.unit,
    mint: first.meta.mint,
  }
}
