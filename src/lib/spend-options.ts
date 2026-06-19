import type { SpendOption } from '../../shared/types'

export const SHOP_OPTIONS: SpendOption[] = [
  {
    name: 'Bitrefill',
    description:
      'Select pay with Lightning on Bitrefill, then redeem that invoice on this page',
    url: 'https://www.bitrefill.com/invite/15efocms',
    category: 'shop',
  },
]

export const EXCHANGE_OPTIONS: SpendOption[] = [
  {
    name: 'Boltz',
    description:
      'Select pay with Lightning on Boltz, then redeem that invoice on this page',
    url: 'https://boltz.exchange/',
    category: 'redeem',
  },
]
