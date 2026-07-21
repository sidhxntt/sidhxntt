"use client";

import { motion } from "framer-motion";
import { getStartupChime, playChime, unlockAudio } from "@/lib/sounds";

export function PowerButton({ onPowerOn }: { onPowerOn: () => void }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 bg-black">
      <motion.button
        onClick={() => {
          unlockAudio(); // user gesture unlocks audio for the whole session
          if (getStartupChime()) playChime();
          onPowerOn();
        }}
        aria-label="Power on"
        className="group relative flex h-24 w-24 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-white/40 hover:text-white"
        whileTap={{ scale: 0.92 }}
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-white/5"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* power glyph */}
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2v9" />
          <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
        </svg>
      </motion.button>
      <motion.p
        className="text-sm tracking-wide text-white/30"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        Press power to start
      </motion.p>

      {/*
        Phones boot the iOS springboard instead of the desktop. Say so here
        rather than letting a visitor assume the small build is all there is.
        CSS-only (md = the same 767px breakpoint useIsMobile watches) so the
        hint can't flash on desktop while JS boots.
      */}
      <div className="absolute inset-x-8 bottom-14 flex items-center justify-center gap-2.5 text-center md:hidden">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/25" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2.5" y="4" width="19" height="13" rx="2" />
          <path d="M9 20.5h6M12 17.5v3" />
        </svg>
        <p className="text-[13px] leading-snug text-white/30">
          Open on a desktop for the full macOS experience
        </p>
      </div>
    </div>
  );
}
