"use client";

import { useEffect, useState } from "react";
import {
  describeWeather,
  fetchWeather,
  type WeatherData,
} from "@/lib/weather";

type Coords = { lat: number; lon: number } | null;

function gradientFor(code: number): string {
  if (code === 0 || code === 1 || code === 2) return "from-blue-500 via-blue-400 to-cyan-400"; // clear / partly
  if (code === 3 || code === 45 || code === 48) return "from-slate-500 via-slate-600 to-slate-700"; // clouds / fog
  if (code >= 71 && code <= 86 && code !== 80 && code !== 81 && code !== 82)
    return "from-slate-300 via-slate-400 to-slate-500"; // snow
  if (code >= 95) return "from-indigo-950 via-slate-950 to-black"; // storm
  if (code >= 51) return "from-indigo-700 via-indigo-800 to-slate-900"; // drizzle / rain / showers
  return "from-slate-500 via-slate-600 to-slate-700";
}

function hourLabel(iso: string, index: number): string {
  if (index === 0) return "Now";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" });
}

function dayLabel(date: string, index: number): string {
  if (index === 0) return "Today";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

export function WeatherApp() {
  const [coords, setCoords] = useState<Coords>(null);
  const [geoDone, setGeoDone] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoDone(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoDone(true);
      },
      () => setGeoDone(true),
      { timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    if (!geoDone) return;
    let cancelled = false;
    setFailed(false);
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

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-slate-600 to-slate-800 text-white">
        <p className="text-3xl">🌡️</p>
        <p className="text-sm font-medium">Weather unavailable</p>
        <p className="text-xs text-white/60">Check your connection and try again.</p>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-600 to-slate-800 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <p className="text-sm text-white/70">Loading weather…</p>
      </div>
    );
  }

  const condition = describeWeather(weather.code);
  const weekMin = Math.min(...weather.daily.map((d) => d.low));
  const weekMax = Math.max(...weather.daily.map((d) => d.high));
  const weekRange = Math.max(weekMax - weekMin, 1);

  return (
    <div
      className={`h-full overflow-y-auto bg-gradient-to-b ${gradientFor(weather.code)} text-white`}
    >
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-6 pt-8 max-md:pt-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center max-md:mb-2">
          <h1 className="text-2xl font-medium [text-shadow:0_1px_4px_rgba(0,0,0,0.25)] max-md:text-[34px]">
            {weather.city}
          </h1>
          <p className="text-6xl font-thin leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.25)] max-md:text-[96px] max-md:leading-none">
            {weather.temp}°
          </p>
          <p className="text-base font-medium max-md:mt-1 max-md:text-xl">
            {condition.icon} {condition.label}
          </p>
          <p className="text-sm text-white/85 max-md:text-base">
            H:{weather.high}° L:{weather.low}°
          </p>
        </div>

        {/* Hourly */}
        <section className="rounded-2xl bg-white/15 p-3 backdrop-blur">
          <p className="mb-2 border-b border-white/20 pb-2 text-[11px] font-semibold uppercase tracking-wide text-white/75">
            Hourly
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {weather.hourly.map((h, i) => (
              <div
                key={h.time}
                className="flex min-w-[52px] flex-col items-center gap-1 rounded-xl bg-white/10 px-2 py-2 max-md:min-w-[58px] max-md:py-2.5"
              >
                <span className="text-[11px] font-medium text-white/85">
                  {hourLabel(h.time, i)}
                </span>
                <span className="text-lg leading-none">{describeWeather(h.code).icon}</span>
                <span className="text-[13px] font-semibold">{h.temp}°</span>
              </div>
            ))}
          </div>
        </section>

        {/* 7-Day Forecast */}
        <section className="rounded-2xl bg-white/15 p-3 backdrop-blur">
          <p className="mb-1 border-b border-white/20 pb-2 text-[11px] font-semibold uppercase tracking-wide text-white/75">
            7-Day Forecast
          </p>
          <ul>
            {weather.daily.map((d, i) => {
              const left = ((d.low - weekMin) / weekRange) * 100;
              const width = Math.max(((d.high - d.low) / weekRange) * 100, 6);
              return (
                <li
                  key={d.date}
                  className="flex items-center gap-3 border-b border-white/10 py-2.5 last:border-b-0 max-md:py-3"
                >
                  <span className="w-12 shrink-0 text-[13px] font-medium">
                    {dayLabel(d.date, i)}
                  </span>
                  <span className="w-6 shrink-0 text-center text-base leading-none">
                    {describeWeather(d.code).icon}
                  </span>
                  <span className="w-8 shrink-0 text-right text-[13px] text-white/70">
                    {d.low}°
                  </span>
                  <div className="relative h-1 flex-1 rounded-full bg-white/20">
                    <div
                      className="absolute h-1 rounded-full bg-gradient-to-r from-cyan-300 to-amber-300"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[13px] font-semibold">
                    {d.high}°
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
