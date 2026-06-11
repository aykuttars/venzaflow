export interface PhoneCountry {
  code: string;
  dial: string;
  label: string;
  nationalLength: number;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'TR', dial: '+90', label: 'TR +90', nationalLength: 10 },
  { code: 'US', dial: '+1', label: 'US +1', nationalLength: 10 },
  { code: 'GB', dial: '+44', label: 'UK +44', nationalLength: 10 },
  { code: 'DE', dial: '+49', label: 'DE +49', nationalLength: 10 },
];

export function digitsOnly(value: string): string {
  return (value || '').replace(/\D/g, '');
}

/** Backend/storage: digits only, TR numbers without leading 0. */
export function normalizePhoneForBackend(value: string, country: PhoneCountry = PHONE_COUNTRIES[0]): string {
  let digits = digitsOnly(value);
  if (country.code === 'TR') {
    if (digits.startsWith('90') && digits.length > 10) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  }
  return digits;
}

export function formatTurkishMobileDisplay(digits: string): string {
  const d = normalizePhoneForBackend(digits);
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 8) return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)}`;
}

export function formatGenericPhoneDisplay(digits: string, country: PhoneCountry): string {
  if (country.code === 'TR') return formatTurkishMobileDisplay(digits);
  const d = digitsOnly(digits).slice(0, country.nationalLength);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}
