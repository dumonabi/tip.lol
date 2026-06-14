/** Conservative limit for QRCodeSVG level M — animated/large tokens exceed this */
export const MAX_STATIC_QR_TOKEN_LENGTH = 1400

export function canShowStaticTokenQr(token: string): boolean {
  return token.length <= MAX_STATIC_QR_TOKEN_LENGTH
}
