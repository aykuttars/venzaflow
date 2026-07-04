/** Match backend/apps/barcode/services/scan_normalize.py (+ client fallbacks for HID scanners). */

export function normalizeScanInput(raw: string): string {
  let s = raw.trim()
  if (!s) return s
  s = s.replace(/[\x00-\x1f\x7f]/g, '')
  s = s.replace(/[İıŞşĞğÜüÖöÇç]/g, (ch) => {
    const map: Record<string, string> = {
      İ: 'I',
      ı: 'i',
      Ş: 'S',
      ş: 's',
      Ğ: 'G',
      ğ: 'g',
      Ü: 'U',
      ü: 'u',
      Ö: 'O',
      ö: 'o',
      Ç: 'C',
      ç: 'c'
    }
    return map[ch] ?? ch
  })
  if (s.length > 8 && /^[@?]/.test(s)) {
    s = s.replace(/^@/, '8').replace(/^\?/, '9')
  }
  return s.replace(/\s+/g, '')
}

/** Try these in order against /barcode/lookup/ (HID wedge, GS1 prefix, extra chars). */
export function barcodeLookupCandidates(raw: string): string[] {
  const normalized = normalizeScanInput(raw)
  const out: string[] = []
  const add = (v: string) => {
    const t = v.trim()
    if (t && !out.includes(t)) out.push(t)
  }

  add(normalized)

  const digits = normalized.replace(/\D/g, '')
  add(digits)

  for (const m of normalized.matchAll(/\d{12,14}/g)) {
    add(m[0])
  }

  if (digits.length > 13) {
    add(digits.slice(-13))
    add(digits.slice(0, 13))
  }
  if (digits.length === 12) {
    add(`0${digits}`)
  }

  return out
}
