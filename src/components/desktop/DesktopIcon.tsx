"use client";

import { playClick } from "@/lib/sounds";

// Generic desktop item: any icon + label (folders, files, apps).
export function DesktopIcon({
  label,
  icon,
  selected,
  onSelect,
  onOpen,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        playClick();
        onSelect();
        onOpen(); // single click opens, like the dock
      }}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className="flex w-28 flex-col items-center gap-1 rounded-lg p-2 outline-none"
      aria-label={`${label} (click to open)`}
    >
      <div className={`rounded-xl p-1 ${selected ? "bg-white/25 ring-1 ring-white/40" : ""}`}>
        {icon}
      </div>
      <span
        className={`max-w-full rounded px-1.5 text-center text-xs font-medium leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] ${
          selected ? "bg-blue-500" : ""
        }`}
      >
        <span className="block truncate">{label}</span>
      </span>
    </button>
  );
}
