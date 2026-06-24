import type {
  SplitCollectionPartPreview,
  SplitCollectionPreview,
} from '../shared/types.js'
import {
  decodeTokenResolving,
  encodeProofs,
  proofAmountsFromProofs,
  sumProofSats,
  type DecodedTokenContext,
} from './token-context.js'

export const SPLIT_MIN_PARTS = 2

export class SplitCollectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SplitCollectionError'
  }
}

export function validateSplitProofParts(parts: unknown, proofCount: number): number[][] {
  if (!Array.isArray(parts)) {
    throw new SplitCollectionError('parts must be an array of proof index groups')
  }
  if (parts.length < SPLIT_MIN_PARTS) {
    throw new SplitCollectionError(`Split into at least ${SPLIT_MIN_PARTS} tokens`)
  }
  if (parts.length > proofCount) {
    throw new SplitCollectionError(
      `Cannot split into more tokens (${parts.length}) than proofs (${proofCount})`,
    )
  }

  const seen = new Set<number>()
  const normalized: number[][] = []

  for (const part of parts) {
    if (!Array.isArray(part) || part.length === 0) {
      throw new SplitCollectionError('Each token needs at least one proof')
    }

    const indices: number[] = []
    for (const idx of part) {
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= proofCount) {
        throw new SplitCollectionError('Invalid proof index in split assignment')
      }
      if (seen.has(idx)) {
        throw new SplitCollectionError('Each proof can only belong to one token')
      }
      seen.add(idx)
      indices.push(idx)
    }
    normalized.push(indices)
  }

  if (seen.size !== proofCount) {
    throw new SplitCollectionError('Assign every proof to a token before splitting')
  }

  return normalized
}

function buildPartPreviews(
  parts: number[][],
  proofs: DecodedTokenContext['proofs'],
): SplitCollectionPartPreview[] {
  return parts.map((indices) => {
    const subset = indices.map((index) => proofs[index]!)
    const proofSats = proofAmountsFromProofs(subset)
    const amountSats = sumProofSats(subset)
    return {
      amountSats,
      proofSats,
      proofCount: proofSats.length,
    }
  })
}

export function previewSplitFromContext(
  ctx: DecodedTokenContext,
  parts: number[][],
): SplitCollectionPreview {
  const validated = validateSplitProofParts(parts, ctx.proofs.length)
  const partPreviews = buildPartPreviews(validated, ctx.proofs)

  return {
    sourceAmountSats: ctx.totalSats,
    parts: partPreviews,
    outputTokenCount: validated.length,
    receiveTotalSats: ctx.totalSats,
  }
}

export function executeSplitFromContext(
  ctx: DecodedTokenContext,
  parts: number[][],
) {
  const validated = validateSplitProofParts(parts, ctx.proofs.length)
  const partPreviews = buildPartPreviews(validated, ctx.proofs)

  const tokens = validated.map((indices, i) => {
    const subset = indices.map((index) => ctx.proofs[index]!)
    const preview = partPreviews[i]!
    return {
      token: encodeProofs(ctx.meta, subset),
      amountSats: preview.amountSats,
      unit: ctx.meta.unit,
      mint: ctx.meta.mint,
      proofSats: preview.proofSats,
    }
  })

  return {
    tokens,
    receiveTotalSats: ctx.totalSats,
  }
}

export async function previewSplitCollection(
  token: string,
  parts: number[][],
): Promise<SplitCollectionPreview> {
  const ctx = await decodeTokenResolving(token)
  return previewSplitFromContext(ctx, parts)
}

export async function executeSplitCollection(token: string, parts: number[][]) {
  const ctx = await decodeTokenResolving(token)
  return executeSplitFromContext(ctx, parts)
}
