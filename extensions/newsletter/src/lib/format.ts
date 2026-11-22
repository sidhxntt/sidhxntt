const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(ms: number | null | undefined): string {
  return ms ? dateFormat.format(new Date(ms)) : "";
}

/** "3 min ago", "2 days ago"… for comments. */
export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(1, Math.round((now - ms) / 1000));
  const steps: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = s;
  for (const [size, unit] of steps) {
    if (value < size) return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
    value = Math.floor(value / size);
  }
  return "";
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US");

/** 950, 1.2K, 3.4M for tiles and axes; exact figures go in tooltips. */
export function formatCount(n: number): string {
  return n < 10_000 ? whole.format(n) : compact.format(n);
}

export function formatExact(n: number): string {
  return whole.format(n);
}

/** Reads as a share of views: "42%", or "–" when nothing was viewed. */
export function formatRatio(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "–";
}

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Nov 22" for a "2026-11-22" day key. */
export function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}
