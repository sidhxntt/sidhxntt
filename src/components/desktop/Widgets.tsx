"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import Image from "next/image";
import { pictures } from "@/data/portfolio";
import { useWindowManager } from "@/components/window/WindowManager";
import { playClick } from "@/lib/sounds";
import { describeWeather, fetchWeather } from "@/lib/weather";
import { Draggable } from "./Draggable";

export type Coords = { lat: number; lon: number } | null;

// ── Calendar ──────────────────────────────────────────────────────────

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function CalendarWidget() {
  const { openApp } = useWindowManager();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="h-44 w-44 rounded-[22px] bg-neutral-900/60 backdrop-blur-xl" />;

  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <button
      onClick={() => {
        playClick();
        openApp("calendar");
      }}
      aria-label="Open Calendar app"
      className="h-44 w-44 rounded-[22px] bg-neutral-900/60 p-3 text-left shadow-xl backdrop-blur-xl transition hover:bg-neutral-900/70"
    >
      <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-red-400">
        {now.toLocaleDateString(undefined, { month: "long" })}
      </p>
      <div className="grid grid-cols-7 gap-x-1 text-center">
        {DAY_LETTERS.map((d, i) => (
          <span key={i} className="text-[9px] font-semibold text-neutral-400">
            {d}
          </span>
        ))}
        {cells.map((day, i) => (
          <span
            key={i}
            className={`flex h-[18px] items-center justify-center text-[10px] font-medium ${
              day === today
                ? "rounded-full bg-red-500 text-white"
                : "text-neutral-200"
            }`}
          >
            {day ?? ""}
          </span>
        ))}
      </div>
    </button>
  );
}

// ── Weather ───────────────────────────────────────────────────────────

type Weather = { city: string; temp: number; code: number; high: number; low: number };

function WeatherWidget({ coords, geoDone }: { coords: Coords; geoDone: boolean }) {
  const { openApp } = useWindowManager();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!geoDone) return; // wait until geolocation resolved (granted or denied)
    let cancelled = false;

    fetchWeather(coords)
      .then((data) => {
        if (!cancelled) setWeather(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [coords, geoDone]);

  return (
    <button
      onClick={() => {
        playClick();
        openApp("weather");
      }}
      aria-label="Open Weather app"
      className="flex h-44 w-44 flex-col rounded-[22px] bg-gradient-to-b from-slate-600/80 to-slate-700/80 p-4 text-left text-white shadow-xl backdrop-blur-xl transition hover:from-slate-600/90 hover:to-slate-700/90"
    >
      {weather ? (
        <>
          <p className="text-[15px] font-semibold">{weather.city}</p>
          <p className="text-[42px] font-light leading-tight">{weather.temp}°</p>
          <div className="mt-auto">
            <p className="text-xl leading-none">{describeWeather(weather.code).icon}</p>
            <p className="mt-1 text-[13px] font-medium">{describeWeather(weather.code).label}</p>
            <p className="text-[12px] text-white/80">
              H:{weather.high}° L:{weather.low}°
            </p>
          </div>
        </>
      ) : (
        <div className="m-auto text-center text-[13px] text-white/70">
          {failed ? "Weather unavailable" : "Loading weather…"}
        </div>
      )}
    </button>
  );
}

// ── Photos ────────────────────────────────────────────────────────────

function FlowerIcon({ size = 40 }: { size?: number }) {
  const petals = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      {petals.map((color, i) => {
        const angle = (i / petals.length) * Math.PI * 2;
        return (
          <ellipse
            key={color}
            cx={50 + Math.cos(angle) * 22}
            cy={50 + Math.sin(angle) * 22}
            rx="14"
            ry="9"
            fill={color}
            opacity="0.9"
            transform={`rotate(${(angle * 180) / Math.PI} ${50 + Math.cos(angle) * 22} ${50 + Math.sin(angle) * 22})`}
          />
        );
      })}
      <circle cx="50" cy="50" r="9" fill="#fff" />
    </svg>
  );
}

// stills only — a cycling widget shouldn't autoplay video
const widgetPhotos = pictures.filter((p) => p.kind === "photo");

function PhotosWidget() {
  const { openApp } = useWindowManager();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % widgetPhotos.length), 4000);
    return () => clearInterval(t);
  }, []);
  const pic = widgetPhotos[index];

  return (
    <button
      onClick={() => {
        playClick();
        openApp("pictures");
      }}
      aria-label="Open Pictures app"
      className="relative h-44 w-[368px] overflow-hidden rounded-[22px] text-left shadow-xl transition hover:brightness-110"
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key={pic.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <Image src={pic.src} alt={pic.caption} fill sizes="368px" className="object-cover" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
      <div className="absolute left-3 top-3 rounded-full bg-black/30 p-1.5 backdrop-blur">
        <FlowerIcon size={22} />
      </div>
      <p className="absolute bottom-3 left-4 text-[13px] font-medium text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
        {pic.caption}
      </p>
    </button>
  );
}

// ── Layout ────────────────────────────────────────────────────────────

export function Widgets({ coords, geoDone }: { coords: Coords; geoDone: boolean }) {
  return (
    <div className="absolute left-4 top-10 flex flex-col gap-4">
      <div className="flex gap-4">
        <Draggable>
          <CalendarWidget />
        </Draggable>
        <Draggable>
          <WeatherWidget coords={coords} geoDone={geoDone} />
        </Draggable>
      </div>
      <Draggable className="w-fit">
        <PhotosWidget />
      </Draggable>
    </div>
  );
}
