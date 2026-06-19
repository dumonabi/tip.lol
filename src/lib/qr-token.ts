/** Conservative limit for QRCodeSVG level M — animated/large tokens exceed this */
import { MAX_STATIC_QR_TOKEN_LENGTH } from '../../shared/types'

export { MAX_STATIC_QR_TOKEN_LENGTH }

export function canShowStaticTokenQr(token: string): boolean {
  return token.length <= MAX_STATIC_QR_TOKEN_LENGTH
}
