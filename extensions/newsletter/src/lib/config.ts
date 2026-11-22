// Where the newsletter's Convex deployment lives. Set NEXT_PUBLIC_CONVEX_URL
// in .env.local (npx convex dev writes it) and in the hosting provider.
// Without it the pages still build and say the newsletter isn't connected.
export const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
export const convexConfigured = CONVEX_URL.length > 0;

export const BASE = "/newsletter";

/** The page for an entry, from its slug path. */
export function href(path: readonly string[]): string {
  return `${BASE}/${path.map(encodeURIComponent).join("/")}`;
}
