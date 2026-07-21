"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClick, playNote } from "@/lib/sounds";

type CamStatus = "loading" | "ready" | "denied" | "unavailable";

interface Filter {
  name: string;
  css: string;
  swatch: string; // gradient classes for the thumbnail button
}

const FILTERS: Filter[] = [
  { name: "None", css: "none", swatch: "from-neutral-500 to-neutral-700" },
  { name: "Noir", css: "grayscale(1) contrast(1.2)", swatch: "from-neutral-300 to-black" },
  { name: "Sepia", css: "sepia(1)", swatch: "from-amber-300 to-amber-800" },
  { name: "X-Ray", css: "invert(1) grayscale(1)", swatch: "from-white to-neutral-400" },
  { name: "Pop", css: "saturate(2.2) contrast(1.1)", swatch: "from-fuchsia-500 to-cyan-400" },
  { name: "Pixel", css: "contrast(1.4) saturate(0.1) blur(1.5px)", swatch: "from-slate-400 to-slate-600" },
];

export function PhotoBooth() {
  const [status, setStatus] = useState<CamStatus>("loading");
  const [filterIdx, setFilterIdx] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<number[]>([]);
  const shotCounter = useRef(0);
  const filterIdxRef = useRef(0);
  filterIdxRef.current = filterIdx;

  const cancelledRef = useRef(false);
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setStatus("loading");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // window may have closed while the permission prompt was up
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setStatus("ready");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  }, [stopStream]);

  // Mount: request camera. Unmount: stop tracks + clear timers.
  useEffect(() => {
    cancelledRef.current = false;
    void startCamera();
    const timers = timersRef.current;
    return () => {
      cancelledRef.current = true;
      stopStream();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [startCamera, stopStream]);

  // Attach the stream once the <video> element is in the DOM.
  useEffect(() => {
    if (status === "ready" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = FILTERS[filterIdxRef.current].css;
    if (typeof ctx.filter === "string" && css !== "none") ctx.filter = css;
    // Mirror horizontally to match the on-screen preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotos((prev) => [...prev, canvas.toDataURL("image/png")]);
  }, []);

  const takePhoto = useCallback(() => {
    if (countdown !== null || status !== "ready") return;
    playClick();
    setCountdown(3);
    playNote(660, 0.15);
    for (let i = 1; i <= 3; i++) {
      timersRef.current.push(
        window.setTimeout(() => {
          if (i < 3) {
            setCountdown(3 - i);
            playNote(660, 0.15);
          } else {
            setCountdown(null);
            setFlash(true);
            playNote(1200, 0.2);
            capture();
            timersRef.current.push(window.setTimeout(() => setFlash(false), 350));
          }
        }, i * 1000),
      );
    }
  }, [countdown, status, capture]);

  const downloadPhoto = useCallback((dataUrl: string) => {
    playClick();
    shotCounter.current += 1;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `photobooth-${shotCounter.current}.png`;
    a.click();
  }, []);

  return (
    <div className="flex h-full flex-col gap-3 bg-neutral-900 p-3 text-neutral-200 max-md:p-0 max-md:pb-4">
      {/* Video area (full-width on phones) */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-black max-md:order-1 max-md:rounded-none max-md:border-0">
        {status === "loading" && (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-label="Loading camera" />
          </div>
        )}

        {(status === "denied" || status === "unavailable") && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <svg viewBox="0 0 24 24" className="h-12 w-12 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1m4 0h5a2 2 0 0 1 2 2v3l5-3v8l-2.5-1.5" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
            <p className="max-w-xs text-sm text-neutral-400">Camera unavailable — allow camera access to use Photo Booth.</p>
            <button
              type="button"
              onClick={() => {
                playClick();
                void startCamera();
              }}
              className="rounded-md bg-white/10 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}

        {status === "ready" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full scale-x-[-1] object-cover"
            style={{ filter: FILTERS[filterIdx].css }}
          />
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
            <span key={countdown} className="text-8xl font-bold text-white drop-shadow-lg">{countdown}</span>
          </div>
        )}

        {/* Flash overlay */}
        <div
          className={`pointer-events-none absolute inset-0 bg-white transition-opacity ${flash ? "opacity-100 duration-0" : "opacity-0 duration-300"}`}
        />
      </div>

      {/* Filter strip (horizontally scrollable on phones) */}
      <div className="flex shrink-0 items-center justify-center gap-2 overflow-x-auto px-1 max-md:order-2 max-md:justify-start max-md:px-3">
        {FILTERS.map((f, i) => (
          <button
            key={f.name}
            type="button"
            onClick={() => {
              playClick();
              setFilterIdx(i);
            }}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-md bg-gradient-to-br ${f.swatch} px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition-transform hover:scale-105 max-md:px-4 max-md:py-2 max-md:text-[11px] ${
              i === filterIdx ? "ring-2 ring-yellow-400" : "ring-1 ring-white/10"
            }`}
          >
            <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">{f.name}</span>
          </button>
        ))}
      </div>

      {/* Shutter row (big centered circle at the bottom on phones) */}
      <div className="flex shrink-0 items-center justify-center max-md:order-4">
        <button
          type="button"
          onClick={takePhoto}
          disabled={status !== "ready" || countdown !== null}
          aria-label="Take photo"
          className="h-12 w-12 rounded-full border-4 border-white/80 bg-red-600 shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 max-md:h-[72px] max-md:w-[72px]"
        />
      </div>

      {/* Photo tray (4-column grid on phones) */}
      {photos.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 max-md:order-3 max-md:items-start max-md:px-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 max-md:grid max-md:grid-cols-4 max-md:gap-1.5 max-md:overflow-visible max-md:pb-0">
            {photos.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => downloadPhoto(p)}
                title="Click to download"
                className="shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 transition-shadow hover:ring-2 hover:ring-yellow-400 max-md:w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt={`Captured photo ${i + 1}`} className="h-14 w-20 object-cover max-md:aspect-square max-md:h-auto max-md:w-full" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              playClick();
              setPhotos([]);
            }}
            aria-label="Clear photos"
            title="Clear photos"
            className="shrink-0 rounded-md bg-white/10 p-2 text-neutral-300 transition-colors hover:bg-white/20 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
