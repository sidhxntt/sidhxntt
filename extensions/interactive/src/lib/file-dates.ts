// Simulated file timestamps for the Finder listings.
//
// Every "Date Modified" in this portfolio is fake, but hardcoding literal dates
// means the whole desktop quietly rots: a listing that reads "14 Jul 2026"
// looks plausible the week it was written and obviously stale six months later.
// So files carry an *offset in days* instead, and the string is rendered
// against the real current date at runtime.
//
// Hydration note: `new Date()` during render would make the server HTML and the
// first client render disagree. Callers must hold "now" in state and fill it in
// from `useEffect` (see MyFolder), then pass the timestamp down here. Until it
// arrives, render `PENDING_DATE`.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Placeholder shown on the server and the first client render. */
export const PENDING_DATE = "--";

/** Shift `now` back by whole calendar days, landing on a given wall-clock time. */
function dayBefore(now: number, daysAgo: number, hour: number, minute: number): Date {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/**
 * Day portion, macOS-style. Rows that also carry a time drop the year while
 * it's the current one ("16 Jun"), the way Finder keeps recent rows short;
 * date-only rows always spell it out ("16 Jun 2026") so a list spanning
 * several years doesn't come out half-and-half.
 */
function dayLabel(d: Date, now: number, alwaysYear = false): string {
  const stem = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return !alwaysYear && d.getFullYear() === new Date(now).getFullYear()
    ? stem
    : `${stem} ${d.getFullYear()}`;
}

/** 12-hour clock, formatted by hand so server and client can never disagree. */
function timeLabel(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/**
 * A full "Date Modified" stamp: "Today at 2:10 PM", "Yesterday at 4:44 PM",
 * "16 Jun at 4:12 PM", "2 Nov 2024 at 3:14 AM".
 *
 * @param now      current time in ms, or null before the client has mounted
 * @param daysAgo  how many calendar days back this file was touched
 * @param hour     0–23 wall clock hour to show
 */
export function fileStamp(now: number | null, daysAgo: number, hour: number, minute: number): string {
  if (now === null) return PENDING_DATE;
  const time = timeLabel(hour, minute);
  if (daysAgo === 0) return `Today at ${time}`;
  if (daysAgo === 1) return `Yesterday at ${time}`;
  return `${dayLabel(dayBefore(now, daysAgo, hour, minute), now)} at ${time}`;
}

/** Date only, for listings that show no time (the Bin): "2 Nov 2024". */
export function fileDay(now: number | null, daysAgo: number): string {
  if (now === null) return PENDING_DATE;
  return dayLabel(dayBefore(now, daysAgo, 12, 0), now, true);
}

/** The underlying Date, for filenames that embed their own timestamp. */
export function fileDate(now: number, daysAgo: number, hour = 12, minute = 0): Date {
  return dayBefore(now, daysAgo, hour, minute);
}
