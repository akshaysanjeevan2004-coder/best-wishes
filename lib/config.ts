export const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const MAX_SLOTS_PER_DAY = 2;
export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Today's date (YYYY-MM-DD) in the configured timezone - NOT the browser's. */
export function todayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-IN', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  });
}
