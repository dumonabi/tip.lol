import {
  Amount,
  Wallet,
  getEncodedToken,
  getTokenMetadata,
  type OutputDataLike,
  type Proof,
} from '@cashu/cashu-ts'
import { MAX_EMOJI_TOKEN_BYTES } from '../shared/emoji-token.js'
import {
  MAX_STATIC_QR_TOKEN_LENGTH,
  type TokenOptimizePreview,
} from '../shared/types.js'

export class OptimizeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OptimizeError'
  }
}

type TokenShape = {
  length: number
  bytes: number
  staticQr: boolean
  emoji: boolean
}

type TokenContext = {
  wallet: Wallet
  meta: ReturnType<typeof getTokenMetadata>
  proofs: Proof[]
  totalSats: number
}

async function loadTokenContext(token: string): Promise<TokenContext> {
  const meta = getTokenMetadata(token)
  const wallet = new Wallet(meta.mint, { unit: meta.unit })
  await wallet.loadMint()
  const decoded = wallet.decodeToken(token)
  const proofs = decoded.proofs
  if (proofs.length === 0) {
    throw new OptimizeError('This token has no spendable proofs')
  }
  const totalSats = proofs.reduce((sum, proof) => sum + proof.amount.toNumber(), 0)
  if (totalSats <= 0) {
    throw new OptimizeError('Token amount must be greater than zero')
  }
  return { wallet, meta, proofs, totalSats }
}

function encodeProofs(
  meta: ReturnType<typeof getTokenMetadata>,
  proofs: Proof[],
): string {
  return getEncodedToken({
    mint: meta.mint,
    proofs,
    unit: meta.unit,
  })
}

function evaluateToken(token: string): TokenShape {
  const length = token.length
  const bytes = new TextEncoder().encode(token).length
  return {
    length,
    bytes,
    staticQr: length <= MAX_STATIC_QR_TOKEN_LENGTH,
    emoji: bytes <= MAX_EMOJI_TOKEN_BYTES,
  }
}

function reductionPercent(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.max(0, Math.round((1 - after / before) * 100))
}

function proofAmountsFromProofs(proofs: Proof[]): number[] {
  return proofs.map((proof) => proof.amount.toNumber()).sort((a, b) => b - a)
}

function proofAmountsFromOutputs(outputs: OutputDataLike[] | undefined): number[] {
  if (!outputs?.length) return []
  return outputs
    .map((output) => output.blindedMessage.amount.toNumber())
    .sort((a, b) => b - a)
}

function worthOptimizing(
  currentProofCount: number,
  estimatedProofCount: number,
): boolean {
  return estimatedProofCount < currentProofCount
}

function benefitSummary(
  currentProofCount: number,
  estimatedProofCount: number,
): string | null {
  if (estimatedProofCount < currentProofCount) {
    return `fewer proofs (${currentProofCount} → ${estimatedProofCount})`
  }
  return null
}

function estimateLength(currentLength: number, currentProofs: number, newProofs: number) {
  if (newProofs <= 0) return currentLength
  return Math.max(
    Math.round((currentLength / currentProofs) * newProofs),
    newProofs * 180,
  )
}

function formatMintFeeLabel(feeSats: number): string {
  if (feeSats === 0) {
    return 'Mint fee: 0 sats (free)'
  }
  return `Mint fee: ${feeSats.toLocaleString()} sats`
}

function buildPreview(
  before: TokenShape,
  currentProofCount: number,
  estimatedLength: number,
  estimatedProofCount: number,
  feeSats: number,
  swapRequired: boolean,
  currentProofSats: number[],
  estimatedProofSats: number[],
): TokenOptimizePreview {
  const afterEst: TokenShape = {
    length: estimatedLength,
    bytes: estimatedLength,
    staticQr: estimatedLength <= MAX_STATIC_QR_TOKEN_LENGTH,
    emoji: estimatedLength <= MAX_EMOJI_TOKEN_BYTES,
  }
  const percent = reductionPercent(before.length, estimatedLength)
  const worth = worthOptimizing(currentProofCount, estimatedProofCount)

  return {
    currentLength: before.length,
    currentProofCount,
    currentProofSats,
    estimatedLength,
    estimatedProofCount,
    estimatedProofSats,
    feeSats,
    costLabel: formatMintFeeLabel(feeSats),
    swapRequired,
    currentlyStaticQr: before.staticQr,
    currentlyEmoji: before.emoji,
    canReachStaticQr: afterEst.staticQr,
    canReachEmoji: afterEst.emoji,
    estimatedReductionPercent: percent,
    worthOptimizing: worth,
    benefitSummary: benefitSummary(currentProofCount, estimatedProofCount),
    alreadyOptimal: !worth,
  }
}

export async function previewTokenOptimize(token: string): Promise<TokenOptimizePreview> {
  const { wallet, meta, proofs, totalSats } = await loadTokenContext(token)
  const before = evaluateToken(token)
  const currentProofCount = proofs.length
  const currentProofSats = proofAmountsFromProofs(proofs)

  if (before.staticQr && before.emoji && currentProofCount === 1) {
    return {
      ...buildPreview(
        before,
        currentProofCount,
        before.length,
        1,
        0,
        false,
        currentProofSats,
        currentProofSats,
      ),
      alreadyOptimal: true,
      worthOptimizing: false,
      benefitSummary: null,
    }
  }

  try {
    const offline = wallet.sendOffline(Amount.from(totalSats), proofs, {
      exactMatch: true,
      includeFees: false,
    })
    const offlineProofs = [...offline.keep, ...offline.send]
    const offlineToken = encodeProofs(meta, offlineProofs)
    const afterOffline = evaluateToken(offlineToken)
    const estimatedProofSats = proofAmountsFromProofs(offlineProofs)

    if (worthOptimizing(currentProofCount, offlineProofs.length)) {
      return buildPreview(
        before,
        currentProofCount,
        afterOffline.length,
        offlineProofs.length,
        0,
        false,
        currentProofSats,
        estimatedProofSats,
      )
    }
  } catch {
    // Fall through to online swap preview.
  }

  let preview
  try {
    preview = await wallet.prepareSwapToSend(Amount.from(totalSats), proofs, {
      includeFees: true,
      proofsWeHave: proofs,
    })
  } catch (err) {
    throw new OptimizeError(
      err instanceof Error ? err.message : 'Could not check optimization with the mint',
    )
  }

  const feeSats = preview.fees.toNumber()
  const estimatedProofSats = proofAmountsFromOutputs([
    ...(preview.sendOutputs ?? []),
    ...(preview.keepOutputs ?? []),
  ])
  const estimatedProofCount = estimatedProofSats.length
  const estimatedLength = estimateLength(
    before.length,
    currentProofCount,
    estimatedProofCount,
  )

  return buildPreview(
    before,
    currentProofCount,
    estimatedLength,
    estimatedProofCount,
    feeSats,
    true,
    currentProofSats,
    estimatedProofSats,
  )
}

export async function executeTokenOptimize(token: string) {
  const preview = await previewTokenOptimize(token)
  if (preview.alreadyOptimal || !preview.worthOptimizing) {
    throw new OptimizeError(
      'This token is already as compact as the mint can make it.',
    )
  }

  const { wallet, meta, proofs, totalSats } = await loadTokenContext(token)
  const before = evaluateToken(token)
  const beforeProofCount = proofs.length

  if (!preview.swapRequired) {
    const offline = wallet.sendOffline(Amount.from(totalSats), proofs, {
      exactMatch: true,
      includeFees: false,
    })
    const optimizedProofs = [...offline.keep, ...offline.send]
    const newToken = encodeProofs(meta, optimizedProofs)
    const after = evaluateToken(newToken)
    const newAmountSats = optimizedProofs.reduce(
      (sum, proof) => sum + proof.amount.toNumber(),
      0,
    )
    const percent = reductionPercent(before.length, after.length)

    return {
      token: newToken,
      amountSats: newAmountSats,
      unit: meta.unit,
      mint: meta.mint,
      previousLength: before.length,
      newLength: after.length,
      previousProofCount: beforeProofCount,
      newProofCount: optimizedProofs.length,
      feeSats: 0,
      reachedStaticQr: !before.staticQr && after.staticQr,
      reachedEmoji: !before.emoji && after.emoji,
      reductionPercent: percent,
      benefitSummary: benefitSummary(beforeProofCount, optimizedProofs.length),
    }
  }

  let swapPreview
  try {
    swapPreview = await wallet.prepareSwapToSend(Amount.from(totalSats), proofs, {
      includeFees: true,
      proofsWeHave: proofs,
    })
  } catch (err) {
    throw new OptimizeError(
      err instanceof Error ? err.message : 'Could not prepare swap with the mint',
    )
  }

  let keep: Proof[]
  let send: Proof[]
  try {
    ;({ keep, send } = await wallet.completeSwap(swapPreview))
  } catch (err) {
    throw new OptimizeError(
      err instanceof Error ? err.message : 'Mint swap failed — try again in a moment',
    )
  }

  const optimizedProofs = [...keep, ...send]
  const newToken = encodeProofs(meta, optimizedProofs)
  const after = evaluateToken(newToken)
  const newAmountSats = optimizedProofs.reduce(
    (sum, proof) => sum + proof.amount.toNumber(),
    0,
  )
  const feeSats = Math.max(0, totalSats - newAmountSats)
  const percent = reductionPercent(before.length, after.length)

  return {
    token: newToken,
    amountSats: newAmountSats,
    unit: meta.unit,
    mint: meta.mint,
    previousLength: before.length,
    newLength: after.length,
    previousProofCount: beforeProofCount,
    newProofCount: optimizedProofs.length,
    feeSats,
    reachedStaticQr: !before.staticQr && after.staticQr,
    reachedEmoji: !before.emoji && after.emoji,
    reductionPercent: percent,
    benefitSummary: benefitSummary(beforeProofCount, optimizedProofs.length),
  }
}
