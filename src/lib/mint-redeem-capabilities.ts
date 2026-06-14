import { Wallet, getTokenMetadata } from '@cashu/cashu-ts'
import {
  bolt11HasEmbeddedAmount,
  type ClassifiedPayment,
} from './payment-input'

export type MintRedeemCapabilities = {
  mintUrl: string
  unit: string
  bolt11Fixed: boolean
  bolt11Variable: boolean
  bolt12: boolean
  lightningAddress: boolean
}

export function mintRedeemCapabilitiesFromWallet(
  wallet: Wallet,
  mintUrl: string,
  unit: string,
): MintRedeemCapabilities {
  const info = wallet.getMintInfo()
  const bolt11Fixed = info.supportsMintMeltMethod('melt', 'bolt11', unit)
  const bolt11Variable = bolt11Fixed && info.supportsAmountless('bolt11', unit)
  const bolt12 = info.supportsMintMeltMethod('melt', 'bolt12', unit)

  return {
    mintUrl,
    unit,
    bolt11Fixed,
    bolt11Variable,
    bolt12,
    lightningAddress: bolt11Fixed,
  }
}

export async function fetchMintRedeemCapabilities(
  token: string,
): Promise<MintRedeemCapabilities> {
  const meta = getTokenMetadata(token)
  const wallet = new Wallet(meta.mint, { unit: meta.unit })
  await wallet.loadMint()
  return mintRedeemCapabilitiesFromWallet(wallet, meta.mint, meta.unit)
}

export function formatPaymentDestinationHint(caps: MintRedeemCapabilities): string {
  const parts: string[] = []

  if (caps.bolt11Fixed) {
    parts.push(caps.bolt11Variable ? 'lnbc…' : 'lnbc… (fixed amount)')
  }
  if (caps.bolt12) {
    parts.push('lno1…')
  }
  if (caps.lightningAddress) {
    parts.push('name@domain.com')
  }

  if (parts.length === 0) {
    return 'This mint does not support Lightning redemptions'
  }

  return `Accepted: ${parts.join(', or ')}`
}

export function validatePaymentForMint(
  classified: ClassifiedPayment,
  caps: MintRedeemCapabilities,
): string | null {
  switch (classified.kind) {
    case 'bolt12':
      if (!caps.bolt12) {
        return 'This mint does not support BOLT12 — use a BOLT11 invoice (lnbc…)'
      }
      return null
    case 'lightning_address':
      if (!caps.lightningAddress) {
        return 'This mint does not support Lightning Address payments'
      }
      return null
    case 'bolt11':
      if (!caps.bolt11Fixed) {
        return 'This mint does not support BOLT11 invoices'
      }
      if (!caps.bolt11Variable && !bolt11HasEmbeddedAmount(classified.value)) {
        return 'This mint does not support variable-amount invoices — use a fixed-amount lnbc… invoice'
      }
      return null
  }
}
