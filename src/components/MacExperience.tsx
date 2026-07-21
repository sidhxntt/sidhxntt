"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Coords } from "./desktop/Widgets";
import { BootScreen } from "./boot/BootScreen";
import { LoginScreen } from "./boot/LoginScreen";
import { PowerButton } from "./boot/PowerButton";
import { Desktop } from "./desktop/Desktop";
import { IOSHome } from "./mobile/IOSHome";
import { WindowManagerProvider } from "./window/WindowManager";
import { useIsMobile } from "@/lib/useIsMobile";
import { getStartupChime, playChime } from "@/lib/sounds";
import { setCoords as publishCoords } from "@/lib/geo";

type Stage = "off" | "booting" | "login" | "desktop";

export function MacExperience() {
  const [stage, setStage] = useState<Stage>("off");
  const [coords, setCoords] = useState<Coords>(null);
  const [geoDone, setGeoDone] = useState(false);
  const geoRequested = useRef(false);
  const isMobile = useIsMobile();

  // Ask for location during boot — the weather widget uses it; on deny/timeout
  // it falls back to a default city.
  useEffect(() => {
    if (stage !== "booting" || geoRequested.current) return;
    geoRequested.current = true;
    if (!navigator.geolocation) {
      setGeoDone(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        publishCoords(c);
        setCoords(c);
        setGeoDone(true);
      },
      () => setGeoDone(true),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }, [stage]);

  // stable ref — BootScreen's animation effect depends on onDone; an inline
  // closure would restart the progress bar when geolocation state lands mid-boot
  const bootDone = useCallback(() => setStage("login"), []);

  const restart = useCallback(() => {
    setStage("off");
    // brief black screen, then auto power-on with chime
    setTimeout(() => {
      if (getStartupChime()) playChime();
      setStage("booting");
    }, 900);
  }, []);

  const shutDown = useCallback(() => setStage("off"), []);

  /** Back to the lock screen without tearing down the session — open windows
   *  are still there when you log back in, like a real Mac. */
  const lock = useCallback(() => setStage("login"), []);

  // Terminal's `restart` / `shutdown`, the Apple menu, and Settings all dispatch
  // this event
  useEffect(() => {
    const onPower = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "restart") restart();
      if (detail === "shutdown") shutDown();
      if (detail === "lock") lock();
    };
    window.addEventListener("portfolio-power", onPower);
    return () => window.removeEventListener("portfolio-power", onPower);
  }, [restart, shutDown, lock]);

  return (
    // The window manager sits ABOVE the stage switch so locking doesn't unmount
    // it — open apps are still there when you log back in. (IOSHome mounts its
    // own provider, which shadows this one on phones.)
    <WindowManagerProvider>
      <div className="fixed inset-0 overflow-hidden bg-black">
        <AnimatePresence mode="wait">
        {stage === "off" && (
          <motion.div key="off" className="h-full" exit={{ opacity: 0 }}>
            <PowerButton onPowerOn={() => setStage("booting")} />
          </motion.div>
        )}
        {stage === "booting" && (
          <motion.div key="boot" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BootScreen onDone={bootDone} />
          </motion.div>
        )}
        {stage === "login" && (
          <motion.div key="login" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <LoginScreen onUnlock={() => setStage("desktop")} />
          </motion.div>
        )}
        {stage === "desktop" && (
          <motion.div
            key="desktop"
            className="h-full"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {isMobile ? (
              <IOSHome coords={coords} />
            ) : (
              <Desktop onRestart={restart} onShutDown={shutDown} coords={coords} geoDone={geoDone} />
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </WindowManagerProvider>
  );
}
