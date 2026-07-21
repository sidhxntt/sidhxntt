/**
 * The banner that slides in shortly after you reach the desktop — the OS's one
 * "hey, look at this" channel. Edit the copy here; the component is generic.
 *
 * Bump `id` whenever the announcement changes: dismissals are remembered per
 * id, so a new id shows the banner again to people who closed the last one.
 */
export type Announcement = {
  id: string;
  /** Small caps label above the title, like the app name in a real banner. */
  app: string;
  title: string;
  body: string;
  url: string;
  /** Seconds on screen before it slides away on its own. */
  autoDismissSeconds: number;
  /** Delay after the desktop appears, in milliseconds. */
  delayMs: number;
};

export const ANNOUNCEMENT: Announcement = {
  id: "invytt-2026-07",
  app: "Invytt",
  title: "Something major is happening",
  body: "We're building something big at Invytt. Tap to see it.",
  url: "https://invytt.com",
  autoDismissSeconds: 10,
  delayMs: 1600,
};
