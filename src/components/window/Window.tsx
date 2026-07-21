"use client";

import { motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import type { AppId } from "@/components/AppIcon";
import { canMaximize, useWindowManager, type WindowState } from "./WindowManager";

const MIN_WIDTH = 340;
const MIN_HEIGHT = 260;
const MENUBAR_HEIGHT = 28;

function TrafficLight({
  color,
  hoverGlyph,
  onClick,
  label,
}: {
  color: string;
  hoverGlyph: string;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="group/light relative h-3 w-3 rounded-full border border-black/10 transition-transform active:scale-90"
      style={{ backgroundColor: color }}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-bold leading-none text-black/50 opacity-0 group-hover/lights:opacity-100">
        {hoverGlyph}
      </span>
    </button>
  );
}

export function Window({
  win,
  title,
  children,
}: {
  win: WindowState;
  title: string;
  children: React.ReactNode;
}) {
  const { closeApp, minimizeApp, toggleMaximize, focusApp, moveApp, resizeApp, activeApp } =
    useWindowManager();
  const ref = useRef<HTMLDivElement>(null);
  const [zooming, setZooming] = useState(false);
  const id: AppId = win.appId;
  const isActive = activeApp === id;

  const zoomable = canMaximize(id);

  const handleZoom = useCallback(() => {
    if (!canMaximize(id)) return;
    // CSS-transition the bounds only during the zoom toggle (never during drag)
    setZooming(true);
    toggleMaximize(id);
    setTimeout(() => setZooming(false), 380);
  }, [id, toggleMaximize]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || win.maximized) return;
      focusApp(id);
      const el = ref.current;
      if (!el) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { ...win.position };
      let latest = origin;

      const onMove = (ev: PointerEvent) => {
        latest = {
          x: origin.x + (ev.clientX - startX),
          y: Math.max(MENUBAR_HEIGHT, origin.y + (ev.clientY - startY)),
        };
        el.style.left = `${latest.x}px`;
        el.style.top = `${latest.y}px`;
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        moveApp(id, latest);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [focusApp, id, moveApp, win.position, win.maximized],
  );

  const startResize = useCallback(
    (dir: string) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      focusApp(id);
      const el = ref.current;
      if (!el) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const size0 = { ...win.size };
      const pos0 = { ...win.position };
      let latestSize = size0;
      let latestPos = pos0;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let { width, height } = size0;
        let { x, y } = pos0;
        if (dir.includes("e")) width = Math.max(MIN_WIDTH, size0.width + dx);
        if (dir.includes("w")) {
          width = Math.max(MIN_WIDTH, size0.width - dx);
          x = pos0.x + (size0.width - width);
        }
        if (dir.includes("s")) height = Math.max(MIN_HEIGHT, size0.height + dy);
        if (dir.includes("n")) {
          height = Math.max(MIN_HEIGHT, size0.height - dy);
          y = Math.max(MENUBAR_HEIGHT, pos0.y + (size0.height - height));
          height = size0.height + (pos0.y - y);
        }
        latestSize = { width, height };
        latestPos = { x, y };
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        resizeApp(id, latestSize, latestPos);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [focusApp, id, resizeApp, win.size, win.position],
  );

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.85, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{
        opacity: 0,
        scale: 0.2,
        y: typeof window !== "undefined" ? window.innerHeight - win.position.y : 500,
        transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
      }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onPointerDown={() => focusApp(id)}
      className={`absolute flex flex-col overflow-hidden border bg-[rgba(242,242,247,0.92)] shadow-2xl backdrop-blur-xl dark:bg-[rgba(32,32,37,0.92)] ${
        win.maximized ? "rounded-none" : "rounded-xl"
      } ${
        zooming ? "transition-[left,top,width,height,border-radius] duration-300 ease-out" : ""
      } ${
        isActive
          ? "border-white/20 shadow-black/40"
          : "border-white/10 shadow-black/20 brightness-[0.97]"
      }`}
      style={{
        left: win.position.x,
        top: win.position.y,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
      }}
    >
      {/* Title bar */}
      <div
        onPointerDown={startDrag}
        onDoubleClick={handleZoom}
        className={`group/lights flex h-9 shrink-0 cursor-default select-none items-center gap-2 border-b border-black/5 px-3 dark:border-white/10 ${
          isActive ? "bg-white/60 dark:bg-neutral-800/70" : "bg-white/35 dark:bg-neutral-800/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <TrafficLight color={isActive ? "#ff5f57" : "#d6d6d6"} hoverGlyph="×" label={`Close ${title}`} onClick={() => closeApp(id)} />
          <TrafficLight color={isActive ? "#febc2e" : "#d6d6d6"} hoverGlyph="−" label={`Minimize ${title}`} onClick={() => minimizeApp(id)} />
          <TrafficLight
            color={zoomable && isActive ? "#28c840" : "#d6d6d6"}
            hoverGlyph={zoomable ? (win.maximized ? "⤡" : "⤢") : ""}
            label={
              !zoomable
                ? `Full screen unavailable for ${title}`
                : win.maximized
                  ? `Exit full screen ${title}`
                  : `Full screen ${title}`
            }
            onClick={zoomable ? handleZoom : undefined}
          />
        </div>
        <span className={`absolute left-1/2 -translate-x-1/2 text-[13px] font-semibold ${isActive ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"}`}>
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

      {/* Resize handles — all edges + corners, like macOS; disabled in full screen */}
      {!win.maximized && (
        <>
          <div onPointerDown={startResize("n")} className="absolute -top-0.5 left-2 right-2 z-10 h-1.5 cursor-ns-resize" aria-hidden />
          <div onPointerDown={startResize("s")} className="absolute -bottom-0.5 left-2 right-2 z-10 h-1.5 cursor-ns-resize" aria-hidden />
          <div onPointerDown={startResize("w")} className="absolute -left-0.5 bottom-2 top-2 z-10 w-1.5 cursor-ew-resize" aria-hidden />
          <div onPointerDown={startResize("e")} className="absolute -right-0.5 bottom-2 top-2 z-10 w-1.5 cursor-ew-resize" aria-hidden />
          <div onPointerDown={startResize("nw")} className="absolute -left-0.5 -top-0.5 z-10 h-3 w-3 cursor-nwse-resize" aria-hidden />
          <div onPointerDown={startResize("ne")} className="absolute -right-0.5 -top-0.5 z-10 h-3 w-3 cursor-nesw-resize" aria-hidden />
          <div onPointerDown={startResize("sw")} className="absolute -bottom-0.5 -left-0.5 z-10 h-3 w-3 cursor-nesw-resize" aria-hidden />
          <div onPointerDown={startResize("se")} className="absolute -bottom-0.5 -right-0.5 z-10 h-4 w-4 cursor-nwse-resize" aria-hidden />
        </>
      )}
    </motion.div>
  );
}
