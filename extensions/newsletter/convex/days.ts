// Calendar days for the stats, in the author's time zone (India, UTC+5:30),
// so "today" in Insights ends at the author's midnight, not UTC's. Plain
// functions with no Convex imports: the admin page uses them too.

export const TZ_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// "2026-11-22" for a moment in time
export function dayKey(ms: number): string {
  return new Date(ms + TZ_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

// The moment the given day starts
export function dayStart(day: string): number {
  if (!DAY.test(day)) throw new Error(`Not a day: ${day}`);
  return Date.parse(`${day}T00:00:00Z`) - TZ_OFFSET_MINUTES * 60_000;
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

// The `count` days ending with `last`, oldest first
export function dayRange(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(last, i - count + 1));
}

export function isDay(value: string): boolean {
  return DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
