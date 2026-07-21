import type { AppId } from "@/components/AppIcon";

// Component-free app metadata — safe to import from anywhere (breaks the
// MyFolder ↔ registry import cycle). registry.tsx zips this with components.

export type AppMeta = {
  id: AppId;
  name: string;
  /** shown as a desktop icon (only My Folder lives on the desktop) */
  onDesktop: boolean;
  /** shown in the dock */
  inDock: boolean;
  /** desktop icon label when it differs from the app name */
  desktopName?: string;
};

// Array order = dock order.
export const APP_META: AppMeta[] = [
  { id: "myfolder", name: "Finder", onDesktop: false, inDock: true },
  { id: "calendar", name: "Calendar", onDesktop: false, inDock: true },
  { id: "about", name: "About Me", onDesktop: false, inDock: true },
  { id: "projects", name: "Projects", onDesktop: false, inDock: false },
  { id: "resume", name: "Resume", onDesktop: false, inDock: false },
  { id: "contact", name: "Contact", onDesktop: false, inDock: true },
  { id: "pictures", name: "Pictures", onDesktop: false, inDock: true },
  { id: "music", name: "Music", onDesktop: false, inDock: true },
  { id: "game-snake", name: "Snake", onDesktop: false, inDock: false },
  { id: "game-pacman", name: "Pac-Man", onDesktop: false, inDock: false },
  { id: "game-2048", name: "2048", onDesktop: false, inDock: false },
  { id: "game-mines", name: "Minesweeper", onDesktop: false, inDock: false },
  { id: "game-breakout", name: "Breakout", onDesktop: false, inDock: false },
  { id: "game-dino", name: "Dino Run", onDesktop: false, inDock: false },
  { id: "game-vault", name: "The Vault", onDesktop: false, inDock: false },
  { id: "game-quest", name: "Tiny Quest", onDesktop: false, inDock: false },
  { id: "settings", name: "Settings", onDesktop: false, inDock: true },
  { id: "terminal", name: "Terminal", onDesktop: false, inDock: true },
  { id: "messages", name: "Messages", onDesktop: false, inDock: true },
  { id: "safari", name: "Safari", onDesktop: false, inDock: true },
  { id: "code", name: "Code", onDesktop: false, inDock: false },
  { id: "photobooth", name: "Photo Booth", onDesktop: false, inDock: false },
  { id: "activity", name: "Activity Monitor", onDesktop: false, inDock: false },
  { id: "weather", name: "Weather", onDesktop: false, inDock: false },
];
