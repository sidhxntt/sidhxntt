"use client";

import "@fontsource/instrument-serif/400.css";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { BackLink } from "./BackLink";
import { KEY_ROWS, type Key } from "./keyboard";
import { OS_FRAME_ALLOW, useEmbeddedOs } from "./useEmbeddedOs";
import styles from "./Laptop.module.css";
import stageStyles from "./Stage.module.css";

// The Interactive OS, running inside a laptop. On arrival the laptop sits
// closed, seen a little from above; the lid swings open as the view comes
// round to the front, the screen powers on, and the OS boots inside it.
//
// The OS lives in an iframe (/interactive/os) so it keeps its own viewport:
// windows, the dock and full-screen mode all size themselves to the laptop's
// screen exactly as they would to a browser window.

/** Outer lid proportions (width / height). The deck is as deep as the lid is tall. */
const LID_RATIO = 1.5;
/** Bezel sizes as fractions of the lid width. */
const BEZEL_SIDE = 0.016;
const BEZEL_TOP = 0.026;
const BEZEL_BOTTOM = 0.03;
/** Narrowest viewport the OS is laid out at; smaller screens are scaled down. */
const MIN_OS_WIDTH = 1100;

/** Camera. Shared with the CSS through custom properties so the fit maths matches. */
const PERSPECTIVE = 3200;
const ORIGIN_Y = 0.42; // fraction of viewport height
const LIFT = 0.07; // open laptop is raised by this fraction of the lid height
const LIP = 0.016; // base front edge, fraction of lid width
const DECK_WIDEN = 1; // the base is exactly as wide as the lid, as on a real laptop

type Phase = "closed" | "opening" | "open";

/**
 * Largest lid width whose open laptop — lid, and the deck projected toward
 * the viewer by the perspective — fits inside the viewport.
 */
function fitWidth(vw: number, vh: number): number {
  const oy = vh * ORIGIN_Y;
  const fits = (w: number) => {
    const h = w / LID_RATIO;
    const lift = h * LIFT;
    const top = vh / 2 - h / 2 - lift;
    const hinge = vh / 2 + h / 2 - lift;
    const k = PERSPECTIVE / (PERSPECTIVE - h); // magnification at the deck's front edge
    const front = oy + (hinge + w * LIP + 14 - oy) * k;
    const frontWidth = w * DECK_WIDEN * k;
    return top >= 60 && front <= vh - 10 && frontWidth <= vw - 32;
  };
  let lo = 320;
  let hi = 1680;
  if (!fits(lo)) return lo;
  while (hi - lo > 2) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

function useLaptopSize() {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const fit = () => setWidth(fitWidth(window.innerWidth, window.innerHeight));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return width;
}

export function Laptop() {
  const width = useLaptopSize();
  const [phase, setPhase] = useState<Phase>("closed");
  const frameRef = useEmbeddedOs(phase === "open");

  // Open the lid shortly after arrival (immediately with reduced motion).
  const sized = width !== null;
  useEffect(() => {
    if (!sized) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("open");
      return;
    }
    const t = setTimeout(() => setPhase("opening"), 450);
    return () => clearTimeout(t);
  }, [sized]);

  const onLidTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.target === e.currentTarget && e.propertyName === "transform" && phase === "opening") setPhase("open");
    },
    [phase],
  );

  const stageVars = {
    perspective: `${PERSPECTIVE}px`,
    perspectiveOrigin: `50% ${ORIGIN_Y * 100}%`,
  } as React.CSSProperties;

  if (width === null) return <div className={stageStyles.stage} style={stageVars} />;

  const height = width / LID_RATIO;
  const screen = {
    left: width * BEZEL_SIDE,
    top: width * BEZEL_TOP,
    width: width * (1 - BEZEL_SIDE * 2),
    height: height - width * (BEZEL_TOP + BEZEL_BOTTOM),
  };
  // Lay the OS out at no less than MIN_OS_WIDTH, then scale it into the screen.
  const scale = Math.min(1, screen.width / MIN_OS_WIDTH);

  return (
    <div className={stageStyles.stage} style={stageVars} data-phase={phase}>
      <BackLink />

      <div
        className={styles.laptop}
        style={
          {
            "--w": `${width}px`,
            "--h": `${height}px`,
            "--lift": `${-height * LIFT}px`,
            "--lip": `${width * LIP}px`,
            "--widen": DECK_WIDEN,
          } as React.CSSProperties
        }
      >
        <div className={styles.shadow} aria-hidden />

        {/* base: the deck lies flat in front of the hinge, the lip faces the viewer */}
        <div className={styles.deck} aria-hidden>
          <div className={`${styles.speaker} ${styles.speakerLeft}`} />
          <div className={styles.keyboard}>
            {KEY_ROWS.map((row, r) => (
              <div key={r} className={`${styles.keyRow} ${row.short ? styles.keyRowShort : ""}`}>
                {row.keys.map((k, i) => (
                  <Keycap key={i} k={k} />
                ))}
              </div>
            ))}
          </div>
          <div className={`${styles.speaker} ${styles.speakerRight}`} />
          <div className={styles.trackpad} />
        </div>
        <div className={styles.lip} aria-hidden />

        <div className={styles.lid} onTransitionEnd={onLidTransitionEnd}>
          <div className={styles.lidEdge} aria-hidden />
          <div className={styles.lidBack} aria-hidden>
            <span className={styles.badge}>SG</span>
          </div>
          <div className={styles.lidFront}>
            <span className={styles.camera} aria-hidden />
            <div
              className={styles.screen}
              style={{ left: screen.left, top: screen.top, width: screen.width, height: screen.height }}
            >
              <div
                className={styles.display}
                style={{
                  width: screen.width / scale,
                  height: screen.height / scale,
                  transform: `scale(${scale})`,
                }}
              >
                <iframe
                  ref={frameRef}
                  className={styles.frame}
                  src="/interactive/os"
                  title="Interactive OS"
                  allow={OS_FRAME_ALLOW}
                />
              </div>
              <div className={styles.glare} aria-hidden />
            </div>
            <div className={styles.hinge} aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

function Keycap({ k }: { k: Key }) {
  const style = { flexGrow: k.w ?? 1 } as React.CSSProperties;
  if (k.power) {
    return (
      <span className={`${styles.key} ${styles.keyPower}`} style={style}>
        <span className={styles.touchId} />
      </span>
    );
  }
  if (k.arrows) {
    return (
      <span className={styles.arrowStack} style={style}>
        <span className={`${styles.key} ${styles.keyHalf}`}>▲</span>
        <span className={`${styles.key} ${styles.keyHalf}`}>▼</span>
      </span>
    );
  }
  const alignClass = k.align === "left" ? styles.keyLeft : k.align === "right" ? styles.keyRight : "";
  return (
    <span className={`${styles.key} ${alignClass}`} style={style}>
      {k.sub && <span className={styles.keySub}>{k.sub}</span>}
      {k.label && <span className={styles.keyLabel}>{k.label}</span>}
    </span>
  );
}
