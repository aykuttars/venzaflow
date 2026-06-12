/** True when notAfter is in the past (OpenSSL / Node X509 date string). */
export function isCertificateExpired(notAfter?: string): boolean {
  if (!notAfter) return false
  const expiry = new Date(notAfter)
  if (Number.isNaN(expiry.getTime())) return false
  return expiry.getTime() < Date.now()
}

function normalizePersonName(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ')
}

/** Extract CN from an X.509 subject string (comma- or space-separated RDNs). */
export function extractCertificateCommonName(subject: string): string | null {
  const match = subject.match(/\bCN=([^]+?)(?=\s+[A-Za-z][\w.-]*=|$)/)
  return match?.[1]?.trim() || null
}

export function getCertificateHolderName(
  cert: { label: string; subject: string }
): string | null {
  const name = (extractCertificateCommonName(cert.subject) || cert.label)?.trim()
  return name || null
}

/** Compare certificate holder name with the logged-in user's display name. */
export function certificateHolderMatchesUser(
  cert: { label: string; subject: string },
  userDisplayName: string | null
): boolean {
  const certName = normalizePersonName(getCertificateHolderName(cert) ?? '')
  const accountName = normalizePersonName(userDisplayName ?? '')
  if (!certName || !accountName) return true
  return certName === accountName
}
