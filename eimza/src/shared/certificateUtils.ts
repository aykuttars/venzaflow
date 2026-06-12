/** True when notAfter is in the past (OpenSSL / Node X509 date string). */
export function isCertificateExpired(notAfter?: string): boolean {
  if (!notAfter) return false
  const expiry = new Date(notAfter)
  if (Number.isNaN(expiry.getTime())) return false
  return expiry.getTime() < Date.now()
}
