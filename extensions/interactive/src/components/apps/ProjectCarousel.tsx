"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type ProjectCarouselProps = {
  projectId: string;
  projectName: string;
  images: readonly string[];
};

const SWIPE_THRESHOLD = 40;

export function ProjectCarousel({
  projectId,
  projectName,
  images,
}: ProjectCarouselProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const pointerStart = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const hasNavigation = images.length > 1;

  useEffect(() => {
    setIndex(0);
    setDirection(1);
  }, [projectId]);

  const step = useCallback(
    (delta: 1 | -1) => {
      if (!hasNavigation) return;
      setDirection(delta);
      setIndex((current) => (current + delta + images.length) % images.length);
    },
    [hasNavigation, images.length],
  );

  useEffect(() => {
    if (!hasNavigation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasNavigation, step]);

  const select = (next: number) => {
    if (next === index) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  const finishSwipe = (clientX: number) => {
    if (pointerStart.current === null) return;
    const distance = clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(distance) < SWIPE_THRESHOLD) return;
    step(distance < 0 ? 1 : -1);
  };

  const currentImage = images[index] ?? images[0];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={`${projectName} screenshots`}
      className="relative mb-4 h-56 w-full shrink-0 touch-pan-y overflow-hidden rounded-xl bg-neutral-100 shadow-inner max-md:h-52 max-md:rounded-2xl dark:bg-neutral-800"
      onPointerDown={(event) => {
        pointerStart.current = event.clientX;
      }}
      onPointerUp={(event) => finishSwipe(event.clientX)}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={`${projectId}-${index}`}
          custom={direction}
          initial={reduceMotion ? false : { opacity: 0, x: direction * 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: direction * -32 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={currentImage}
            alt={`${projectName} screenshot ${index + 1} of ${images.length}`}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="select-none object-contain"
            draggable={false}
            priority={index === 0}
          />
        </motion.div>
      </AnimatePresence>

      {hasNavigation ? (
        <>
          <button
            type="button"
            aria-label="Previous screenshot"
            onClick={() => step(-1)}
            className="absolute left-2.5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-[0_4px_14px_rgba(0,0,0,0.22)] backdrop-blur-md transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95 md:h-9 md:w-9"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next screenshot"
            onClick={() => step(1)}
            className="absolute right-2.5 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-[0_4px_14px_rgba(0,0,0,0.22)] backdrop-blur-md transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95 md:h-9 md:w-9"
          >
            <Chevron direction="right" />
          </button>

          <div className="absolute inset-x-0 bottom-2.5 z-10 flex items-center justify-center gap-2 px-14">
            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full bg-black/45 px-2.5 py-1.5 shadow-[0_3px_12px_rgba(0,0,0,0.2)] backdrop-blur-md">
              {images.map((image, dotIndex) => (
                <button
                  key={image}
                  type="button"
                  aria-label={`Show screenshot ${dotIndex + 1}`}
                  aria-current={dotIndex === index ? "true" : undefined}
                  onClick={() => select(dotIndex)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span
                    className={`block rounded-full transition-all ${
                      dotIndex === index ? "h-2 w-4 bg-white" : "h-2 w-2 bg-white/50 hover:bg-white/75"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <p
            aria-live="polite"
            className="absolute right-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white shadow-[0_3px_12px_rgba(0,0,0,0.18)] backdrop-blur-md"
          >
            Slide {index + 1} of {images.length}
          </p>
        </>
      ) : null}
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M 12 4.5 L 6.5 10 l 5.5 5.5" : "M 8 4.5 L 13.5 10 L 8 15.5"} />
    </svg>
  );
}
