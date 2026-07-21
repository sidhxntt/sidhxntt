"use client";

import { useState } from "react";
import Image from "next/image";
import { profile } from "@/data/portfolio";

// Profile picture with a monogram fallback. The initials render whenever the
// image 404s or fails to decode, so the UI never shows an empty circle.

export function Avatar({
  size,
  className = "",
  textClassName = "",
}: {
  size: number;
  className?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 font-bold text-white ${className}`}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span className={textClassName}>{profile.avatarInitials}</span>
      ) : (
        <Image
          src={profile.avatar}
          alt={profile.name}
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
