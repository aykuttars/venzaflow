/** Hour values 00–23 for mat-select. */
export const HOUR_OPTIONS: string[] = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, '0')
);

/** Minute values in 5-minute steps. */
export const MINUTE_OPTIONS: string[] = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, '0')
);

export function snapMinuteToStep(minute: number, step = 5): string {
  const snapped = Math.round(minute / step) * step;
  const clamped = Math.min(55, Math.max(0, snapped));
  return String(clamped).padStart(2, '0');
}

export function parseHourMinute(value: string | null | undefined): { hour: string; minute: string } {
  if (!value || !value.includes(':')) {
    return { hour: '09', minute: '00' };
  }
  const [h, m] = value.split(':');
  const hour = String(Math.min(23, Math.max(0, Number(h) || 0))).padStart(2, '0');
  const minute = snapMinuteToStep(Number(m) || 0);
  return { hour, minute };
}

export function combineHourMinute(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}
