"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { BackLink } from "./BackLink";
import { OS_FRAME_ALLOW, useEmbeddedOs } from "./useEmbeddedOs";
import styles from "./Phone.module.css";
import stageStyles from "./Stage.module.css";

// The Interactive OS on phones: the iOS home screen running inside a drawn
// iPhone. It tilts in at an angle, turns to face the visitor, the screen
// wakes, and the OS boots — the phone counterpart of the laptop on desktop.
//
// As with the laptop, the OS lives in an iframe (/interactive/os) so it lays
// itself out for a real phone-sized viewport, then scales into the screen.

/** Outer body proportions (height / width) of a 6.1" phone. */
const BODY_RATIO = 2.063;
/** Titanium band + black border, as a fraction of body width. */
const INSET = 0.045;
/** Space kept for the back link above and breathing room below. */
const SPACE_TOP = 76;
const SPACE_BOTTOM = 28;
/** The OS is laid out at a real phone width, then scaled into the screen. */
const OS_MIN_WIDTH = 360;
const OS_MAX_WIDTH = 430;
/** Slices that give the body its depth while it turns (hidden once it settles). */
const DEPTH_LAYERS = 14;

type Phase = "away" | "turning" | "on";

function usePhoneSize() {
  const [size, setSize] = useState<{ width: number; osWidth: number } | null>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.floor(Math.max(200, Math.min(vw - 40, (vh - SPACE_TOP - SPACE_BOTTOM) / BODY_RATIO, 420)));
      setSize({ width, osWidth: Math.min(OS_MAX_WIDTH, Math.max(OS_MIN_WIDTH, vw)) });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return size;
}

export function Phone() {
  const size = usePhoneSize();
  const [phase, setPhase] = useState<Phase>("away");
  const frameRef = useEmbeddedOs(phase === "on");

  const sized = size !== null;
  useEffect(() => {
    if (!sized) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("on");
      return;
    }
    const t = setTimeout(() => setPhase("turning"), 350);
    return () => clearTimeout(t);
  }, [sized]);

  if (!size) return <div className={stageStyles.stage} />;

  const { width, osWidth } = size;
  const height = width * BODY_RATIO;
  const inset = width * INSET;
  const screenWidth = width - inset * 2;
  const screenHeight = height - inset * 2;
  const scale = screenWidth / osWidth;
  const depth = width * 0.11; // a phone is about a ninth as thick as it is wide

  return (
    <div className={`${stageStyles.stage} ${styles.stage}`} data-phase={phase}>
      <BackLink />

      <div
        className={styles.phone}
        style={
          {
            "--w": `${width}px`,
            "--h": `${height}px`,
            "--inset": `${inset}px`,
          } as React.CSSProperties
        }
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === "transform" && phase === "turning") setPhase("on");
        }}
      >
        {/* body depth: stacked slices behind the front, visible only while it turns */}
        {Array.from({ length: DEPTH_LAYERS }, (_, i) => (
          <div
            key={i}
            className={styles.slice}
            style={{ transform: `translateZ(${(-(i + 1) * depth) / DEPTH_LAYERS}px)` }}
            aria-hidden
          />
        ))}

        <div className={styles.body}>
          <span className={`${styles.button} ${styles.action}`} aria-hidden />
          <span className={`${styles.button} ${styles.volumeUp}`} aria-hidden />
          <span className={`${styles.button} ${styles.volumeDown}`} aria-hidden />
          <span className={`${styles.button} ${styles.power}`} aria-hidden />

          <div className={styles.screen} style={{ left: inset, top: inset, width: screenWidth, height: screenHeight }}>
            <div
              className={styles.display}
              style={{ width: osWidth, height: screenHeight / scale, transform: `scale(${scale})` }}
            >
              <iframe ref={frameRef} className={styles.frame} src="/interactive/os" title="Interactive OS" allow={OS_FRAME_ALLOW} />
            </div>
            <span className={styles.island} aria-hidden />
            <span className={styles.glare} aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
