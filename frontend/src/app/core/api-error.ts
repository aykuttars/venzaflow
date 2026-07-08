/** Extract a human-readable message from a DRF-style HTTP error body. */
export function apiErrorMessage(err: unknown, field?: string, fallback = 'Error'): string {
  const body = (err as { error?: Record<string, unknown> })?.error;
  if (!body) return fallback;

  if (field) {
    const value = body[field];
    if (Array.isArray(value) && value.length) return String(value[0]);
    if (typeof value === 'string') return value;
  }

  const detail = body['detail'];
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return String(detail[0]);

  const nonField = body['non_field_errors'];
  if (Array.isArray(nonField) && nonField.length) return String(nonField[0]);

  return fallback;
}
