/** Normalize Turkish keyboard wedge misreads (Q/W layout, common TR chars). */
export function normalizeTrScanInput(raw: string): string {
  let s = raw.trim();
  if (!s) return s;

  const trMap: Record<string, string> = {
    'İ': 'I',
    'ı': 'i',
    'Ş': 'S',
    'ş': 's',
    'Ğ': 'G',
    'ğ': 'g',
    'Ü': 'U',
    'ü': 'u',
    'Ö': 'O',
    'ö': 'o',
    'Ç': 'C',
    'ç': 'c',
  };
  s = s.replace(/[İıŞşĞğÜüÖöÇç]/g, (ch) => trMap[ch] ?? ch);

  // Common US-layout wedge on TR keyboard: Q→@, W→?
  if (/^[@?]/.test(s) && s.length > 8) {
    s = s.replace(/^@/, '8').replace(/^\?/, '9');
  }

  return s.replace(/\s+/g, '');
}
