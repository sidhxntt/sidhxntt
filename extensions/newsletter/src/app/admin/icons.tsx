// Line icons for the editor: 24×24, drawn in currentColor.

const PATHS = {
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7z M7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M10 5h7 M7 19h7 M14 5l-4 14",
  underline: "M7 4v7a5 5 0 0 0 10 0V4 M5 20h14",
  strike: "M4 12h16 M16 7c-.7-1.5-2.2-2.5-4.2-2.5-2.5 0-4.3 1.4-4.3 3.4 0 1.4.8 2.4 2.3 3.1 M8 17c.8 1.6 2.4 2.5 4.3 2.5 2.6 0 4.2-1.4 4.2-3.4 0-.6-.1-1.2-.4-1.6",
  code: "M9 8l-4 4 4 4 M15 8l4 4-4 4",
  highlight: "M14.5 4.5l5 5-8 8H6.5v-5z M4 21h16",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  bullets: "M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01",
  numbers: "M10 6h10 M10 12h10 M10 18h10 M4 4.5l1.5-1V9 M3.5 14.5a1.5 1.5 0 0 1 3 .2c0 1.3-3 2.1-3 3.8h3",
  checklist: "M3.5 6l1.5 1.5L8 4.5 M3.5 16l1.5 1.5L8 14.5 M11 6h9 M11 12h9 M11 18h9",
  quote: "M5 5v14 M9 7h10 M9 12h10 M9 17h6",
  codeBlock: "M4 5h16v14H4z M10 10l-2 2 2 2 M14 10l2 2-2 2",
  divider: "M3 12h18 M8 6h8 M8 18h8",
  center: "M4 6h16 M7 12h10 M5 18h14",
  table: "M4 5h16v14H4z M4 10h16 M10 5v14",
  image: "M4 5h16v14H4z M4 16l5-5 4 4 2-2 5 5 M15.5 9.5h.01",
  undo: "M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H12",
  redo: "M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H12",
  back: "M19 12H5 M11 18l-6-6 6-6",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v5H5V6h5",
  post: "M6 3.5h8l4 4v13H6z M14 3.5v4h4 M9 12h6 M9 16h6",
  series: "M8 3.5h11v13 M5 7h11v13.5H5z M8 11.5h5 M8 15.5h5",
  folder: "M3.5 6.5a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z",
  settings: "M4 7h10 M18 7h2 M4 17h4 M12 17h8 M14 5v4 M8 15v4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
