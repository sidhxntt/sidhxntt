"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  DEFAULT_WALLPAPER,
  getWallpaper,
  subscribeWallpaper,
  WALLPAPERS,
  type WallpaperId,
} from "@/lib/wallpaper";

// `preview` renders a lightweight version for the Settings picker: the live
// wallpaper never autoplays there, and thumbnails load lazily instead of eagerly.
export function WallpaperArt({ id, preview = false }: { id: WallpaperId; preview?: boolean }) {
  const preset = WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS.find((w) => w.id === DEFAULT_WALLPAPER)!;
  const isLiveVideo = preset.kind === "video" && !preview;

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900">
      {isLiveVideo ? (
        <video
          key={preset.src}
          src={preset.src}
          poster={preset.poster}
          className="h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <Image
          src={preset.kind === "video" ? preset.poster! : preset.src}
          alt=""
          fill
          sizes={preview ? "240px" : "100vw"}
          priority={!preview}
          loading={preview ? "lazy" : undefined}
          className="object-cover"
        />
      )}
    </div>
  );
}

export function Wallpaper() {
  const [id, setId] = useState<WallpaperId>(getWallpaper());
  useEffect(() => subscribeWallpaper(setId), []);
  return <WallpaperArt id={id} />;
}
