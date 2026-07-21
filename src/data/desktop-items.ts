import type { AppId } from "@/components/AppIcon";

// The loose files and folders sitting on the desktop — the single source of
// truth for their names. Component-free on purpose (data only, no JSX): both
// Desktop.tsx and Spotlight.tsx import it, and each renders its own icons at
// its own size, so keeping React out of here avoids an import cycle.

export type DesktopItem = {
  /** stable identity for selection state and React keys */
  key: string;
  /** the name shown under the icon and in Spotlight */
  label: string;
  kind: "file" | "folder";
  /** app the desktop icon opens */
  appId: AppId;
  /** Finder location to jump to first (folders) */
  finderLoc?: string;
  /** glyph badge for file icons — label + colour, rendered by the consumer */
  badge?: { label: string; color: string };
  /** app Spotlight opens for this item; omit to keep it out of Spotlight */
  spotlightAppId?: AppId;
};

// Array order = desktop icon order.
export const DESKTOP_ITEMS: DesktopItem[] = [
  { key: "projects", label: "Projects", kind: "folder", appId: "myfolder", finderLoc: "projects", spotlightAppId: "projects" },
  { key: "pictures", label: "Pictures", kind: "folder", appId: "myfolder", finderLoc: "pictures", spotlightAppId: "pictures" },
  { key: "games", label: "Games", kind: "folder", appId: "myfolder", finderLoc: "games" },
  { key: "about", label: "about-me.txt", kind: "file", appId: "about", badge: { label: "TXT", color: "#f59e0b" }, spotlightAppId: "about" },
  { key: "resume", label: "resume.pdf", kind: "file", appId: "resume", badge: { label: "PDF", color: "#dc2626" }, spotlightAppId: "resume" },
  { key: "contact", label: "contact.mail", kind: "file", appId: "contact", badge: { label: "@", color: "#0284c7" }, spotlightAppId: "contact" },
];
