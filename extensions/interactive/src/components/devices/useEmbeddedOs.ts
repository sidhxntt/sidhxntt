"use client";

import { useEffect, useRef, useState } from "react";
import { LAPTOP_SOURCE, OS_SOURCE } from "@os/lib/laptop-messages";

/**
 * Boot handshake with the OS running in a device's screen (an iframe on
 * /interactive/os). The OS posts "ready" once it can listen; we post "boot"
 * once the device has finished its intro (`screenOn`). Returns the ref to
 * attach to the iframe.
 */
export function useEmbeddedOs(screenOn: boolean) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [osReady, setOsReady] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { source?: string; type?: string } | null;
      if (data?.source === OS_SOURCE && data.type === "ready") setOsReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!screenOn || !osReady || booted) return;
    frameRef.current?.contentWindow?.postMessage({ source: LAPTOP_SOURCE, type: "boot" }, window.location.origin);
    frameRef.current?.focus();
    setBooted(true);
  }, [screenOn, osReady, booted]);

  return frameRef;
}

/** Permissions the OS's apps use (weather location, Photo Booth camera…). */
export const OS_FRAME_ALLOW = "geolocation; camera; microphone; autoplay; clipboard-read; clipboard-write; fullscreen";
