// Wallpaper catalog, importable from both client components and server code.
// The reactive store lives in wallpaper.ts ("use client") — importing that from
// a route handler hands back client-reference proxies instead of the array, so
// the data itself must live in a directive-free module.

export type WallpaperId =
  | "abstract-orange"
  | "abstract-red"
  | "abstract-teal"
  | "abstract-blue"
  | "waves-purple"
  | "canyon"
  | "alpenglow-peaks"
  | "green-field"
  | "turquoise-coast"
  | "teal-coast";

// Every wallpaper is a real file in /public/os_background.
export const WALLPAPERS: {
  id: WallpaperId;
  name: string;
  src: string;
  kind: "image" | "video";
  poster?: string; // video only — used for picker thumbnails so the clip stays unfetched
}[] = [
  { id: "abstract-orange", name: "Bloom", src: "/os_background/abstract-orange.jpg", kind: "image" },
  { id: "abstract-red", name: "Ember", src: "/os_background/abstract-red.jpg", kind: "image" },
  { id: "abstract-teal", name: "Jade", src: "/os_background/abstract-teal.jpg", kind: "image" },
  { id: "abstract-blue", name: "Glass", src: "/os_background/abstract-blue.jpg", kind: "image" },
  { id: "waves-purple", name: "Ripple", src: "/os_background/waves-purple.jpg", kind: "image" },
  { id: "canyon", name: "Canyon", src: "/os_background/canyon.jpg", kind: "image" },
  { id: "alpenglow-peaks", name: "Alpenglow", src: "/os_background/alpenglow-peaks.jpg", kind: "image" },
  { id: "green-field", name: "Meadow", src: "/os_background/green-field.jpg", kind: "image" },
  { id: "turquoise-coast", name: "Shoreline", src: "/os_background/turquoise-coast.jpg", kind: "image" },
  {
    id: "teal-coast",
    name: "Tide (Live)",
    src: "/os_background/teal-coast.mp4",
    kind: "video",
    poster: "/os_background/teal-coast-poster.jpg",
  },
];

export const DEFAULT_WALLPAPER: WallpaperId = "canyon";
