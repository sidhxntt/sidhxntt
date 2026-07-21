"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AppleLogo } from "@/components/desktop/MenuBar";

const BOOT_DURATION_MS = 3800;

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / BOOT_DURATION_MS);
      // ease: fast start, pause in the middle, rush at the end — like a real boot
      const eased = t < 0.6 ? t * 0.9 : 0.54 + ((t - 0.6) / 0.4) * 0.46;
      setProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setTimeout(onDone, 250);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-16 bg-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="text-white"
      >
        <AppleLogo className="h-24 w-24" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="h-1.5 w-44 overflow-hidden rounded-full bg-white/20"
      >
        <div
          className="h-full rounded-full bg-white"
          style={{ width: `${progress * 100}%` }}
        />
      </motion.div>
    </div>
  );
}
