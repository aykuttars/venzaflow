/** Parse API / datetime-local string to Date (local). */
export function parseDateTimeLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format Date to YYYY-MM-DD for API date fields. */
export function formatDateOnly(date: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Format Date to datetime-local string YYYY-MM-DDTHH:mm. */
export function formatDateTimeLocal(date: Date | null): string {
  if (!date) return '';
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

/** Normalize ISO or date string from API for date-field (YYYY-MM-DD). */
export function normalizeDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed.slice(0, 10);
}

/** Normalize ISO datetime from API for date-time-field. */
export function normalizeDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = parseDateTimeLocal(value);
  return d ? formatDateTimeLocal(d) : '';
}
