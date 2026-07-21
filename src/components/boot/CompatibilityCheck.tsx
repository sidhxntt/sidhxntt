"use client";

import { useEffect, useRef, useState } from "react";

// A package-manager-style capability probe, reached from the lock screen.
// The checks are REAL — every line reads something off the visitor's browser —
// which is what makes the closing verdict land instead of feeling like a gag.

type Line = { text: string; kind: "step" | "ok" | "warn" | "info" | "head" };

const MACOS_SCORE = 100;
const IOS_SCORE = 80;

/** Probe the browser once, on the client, and turn it into a printable script. */
function buildScript(): { lines: Line[]; isPhone: boolean } {
  const mq = (q: string) => window.matchMedia(q).matches;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPhone = width < 768;
  const finePointer = mq("(pointer: fine)");
  const canHover = mq("(hover: hover)");
  const touch = navigator.maxTouchPoints > 0;
  const dpr = window.devicePixelRatio || 1;
  const reduced = mq("(prefers-reduced-motion: reduce)");
  const glass =
    typeof CSS !== "undefined" &&
    (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));
  const audio = typeof window.AudioContext !== "undefined";
  let storage = false;
  try {
    window.localStorage.setItem("__probe", "1");
    window.localStorage.removeItem("__probe");
    storage = true;
  } catch {
    storage = false;
  }

  const yes = (label: string, detail: string): Line => ({ text: `  ✔ ${label} ${detail}`, kind: "ok" });
  const no = (label: string, detail: string): Line => ({ text: `  ⚠ ${label} ${detail}`, kind: "warn" });

  const lines: Line[] = [
    { text: "$ portfolio-os check-compatibility", kind: "head" },
    { text: "==> Resolving dependencies", kind: "step" },
    yes("react", "19.2.0"),
    yes("next", "16.2.10"),
    yes("framer-motion", "12.x"),
    { text: "==> Probing display", kind: "step" },
    yes("viewport", `${width}×${height}`),
    yes("pixel ratio", `${dpr}x`),
    isPhone
      ? no("form factor", "phone — desktop shell unavailable")
      : yes("form factor", "desktop — full window manager"),
    { text: "==> Probing input", kind: "step" },
    finePointer ? yes("pointer", "fine (mouse/trackpad)") : no("pointer", "coarse — drag & resize degraded"),
    canHover ? yes("hover", "supported") : no("hover", "unsupported — dock magnification off"),
    yes("touch points", String(navigator.maxTouchPoints)),
    { text: "==> Probing renderer", kind: "step" },
    glass ? yes("backdrop-filter", "supported") : no("backdrop-filter", "missing — glass falls back to solid"),
    reduced ? no("motion", "reduced — animations trimmed") : yes("motion", "full"),
    { text: "==> Probing system services", kind: "step" },
    audio ? yes("web audio", "available") : no("web audio", "unavailable — UI sounds off"),
    storage ? yes("persistence", "localStorage writable") : no("persistence", "blocked — settings won't survive"),
    { text: "==> Linking", kind: "step" },
    { text: "  ✔ 14 apps · 6 games · 1 assistant", kind: "ok" },
  ];

  // touch is only worth calling out on a device that also lacks a real pointer
  if (touch && !finePointer) lines.splice(13, 0, { text: "  ℹ touch input detected", kind: "info" });

  return { lines, isPhone };
}

function Bar({ pct, tone }: { pct: number; tone: "good" | "warn" }) {
  const filled = Math.round((pct / 100) * 24);
  return (
    <span className={tone === "good" ? "text-emerald-400" : "text-amber-400"}>
      [{"█".repeat(filled)}
      <span className="text-white/20">{"░".repeat(24 - filled)}</span>] {pct}%
    </span>
  );
}

export function CompatibilityCheck({ onBack }: { onBack: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { lines: script, isPhone: phone } = buildScript();
    setIsPhone(phone);

    // honour reduced-motion by skipping the typewriter entirely
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLines(script);
      setDone(true);
      return;
    }

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setLines(script.slice(0, i + 1));
      i++;
      if (i >= script.length) {
        timer = setTimeout(() => setDone(true), 420);
        return;
      }
      // section headers pause a beat longer, like a real install log
      timer = setTimeout(tick, script[i]?.kind === "step" ? 260 : 70);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines, done]);

  const colour = (kind: Line["kind"]) =>
    kind === "head"
      ? "text-white"
      : kind === "step"
        ? "text-sky-400"
        : kind === "ok"
          ? "text-white/70"
          : kind === "warn"
            ? "text-amber-400"
            : "text-white/40";

  return (
    <div className="h-full w-full overflow-auto bg-[#0b0b0e] px-5 py-6 font-mono text-[12.5px] leading-relaxed md:px-10 md:text-[13.5px]">
      <div className="mx-auto max-w-3xl">
        {lines.map((l, i) => (
          <p key={i} className={`whitespace-pre-wrap ${colour(l.kind)}`}>
            {l.text}
          </p>
        ))}

        {!done && <p className="animate-pulse text-white/40">▍</p>}

        {done && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="text-white">{"==> Compatibility"}</p>
            <p className="mt-2 flex flex-wrap gap-x-2 text-white/80">
              <span className="w-40 shrink-0">macOS desktop</span>
              <Bar pct={MACOS_SCORE} tone="good" />
            </p>
            <p className="mt-1 flex flex-wrap gap-x-2 text-white/80">
              <span className="w-40 shrink-0">iOS phone</span>
              <Bar pct={IOS_SCORE} tone="warn" />
            </p>

            <p className="mt-5 max-w-xl text-white/50">
              {isPhone
                ? "The phone build ships the springboard, all 14 apps and Siri — but no window manager, no dock magnification, and no drag-and-resize. That's the missing 20%."
                : "You're on a desktop, so you get the full window manager, dock magnification, drag-and-resize and every app at full size."}
            </p>

            <p className={`mt-4 font-semibold ${isPhone ? "text-amber-400" : "text-emerald-400"}`}>
              {isPhone
                ? "→ Open this on a desktop for the full macOS experience."
                : "→ You're on the optimal setup. Go ahead and log in."}
            </p>

            <button
              onClick={onBack}
              className="mt-7 rounded-full border border-white/15 bg-white/10 px-5 py-1.5 text-[13px] text-white transition hover:bg-white/20"
            >
              ← Back to login
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
