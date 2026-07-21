"use client";

import { useEffect, useState } from "react";
import { playClick } from "@/lib/sounds";
import { useIsMobile } from "@/lib/useIsMobile";
import { consumePendingView, subscribeViewNav } from "@/lib/view-nav";

// Calendar-app-style window with Day / Week / Month / Year views.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type View = "day" | "week" | "month" | "year";

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MonthGrid({
  year,
  month,
  today,
  compact = false,
  mobile = false,
}: {
  year: number;
  month: number;
  today: Date;
  compact?: boolean;
  /** iOS-style full-width month grid — only ever rendered below 768px. */
  mobile?: boolean;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad out to whole weeks so the grid's borders form complete rows.
  const trailing = (7 - (leading.length % 7)) % 7;
  const cells: (number | null)[] = [...leading, ...Array.from({ length: trailing }, () => null)];
  const isTodayCell = (d: number | null) =>
    d !== null && today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  if (compact) {
    return (
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {DAY_NAMES.map((d) => (
          <span key={d} className="text-[8px] font-semibold text-neutral-400 max-md:text-[9px]">
            {d[0]}
          </span>
        ))}
        {cells.map((day, i) => (
          <span
            key={i}
            className={`mx-auto flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] max-md:text-[9px] ${
              isTodayCell(day) ? "bg-red-500 font-bold text-white" : "text-neutral-600 dark:text-neutral-300"
            }`}
          >
            {day ?? ""}
          </span>
        ))}
      </div>
    );
  }

  if (mobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-7 border-b border-black/10 px-2 pb-1.5 text-center dark:border-white/15">
          {DAY_NAMES.map((d) => (
            <span key={d} className="text-[12px] font-semibold text-neutral-400">
              {d[0]}
            </span>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto px-2 pb-4">
          {cells.map((day, i) => (
            <div
              key={i}
              className={`flex min-h-14 items-start justify-center border-t pt-1.5 ${
                i < 7 ? "border-transparent" : "border-black/10 dark:border-white/15"
              }`}
            >
              {day !== null && (
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[17px] ${
                    isTodayCell(day)
                      ? "bg-red-500 font-semibold text-white"
                      : "text-neutral-800 dark:text-neutral-100"
                  }`}
                >
                  {day}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-7 border-b border-black/10 pb-1 text-right dark:border-white/15">
        {DAY_NAMES.map((d) => (
          <span key={d} className="pr-2 text-[11px] font-semibold text-neutral-400">
            {d}
          </span>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-7">
        {cells.map((day, i) => (
          <div
            key={i}
            className="border-b border-r border-black/5 p-1 text-right [&:nth-child(7n)]:border-r-0 dark:border-white/10"
          >
            {day && (
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
                  isTodayCell(day) ? "bg-red-500 text-white" : "text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {day}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function HourRows({ children }: { children?: React.ReactNode }) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM – 8 PM
  return (
    <div className="relative flex-1 overflow-auto">
      {hours.map((h) => (
        <div key={h} className="flex h-10 items-start gap-2 border-t border-black/5 px-2 dark:border-white/10">
          <span className="w-12 shrink-0 -translate-y-2 text-right text-[10px] text-neutral-400">
            {h <= 12 ? h : h - 12} {h < 12 ? "AM" : "PM"}
          </span>
          <div className="h-full flex-1" />
        </div>
      ))}
      {children}
    </div>
  );
}

function NowLine({ visible }: { visible: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!visible || !now) return null;
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = 8 * 60;
  const end = 21 * 60;
  if (mins < start || mins > end) return null;
  const top = ((mins - start) / 60) * 40; // 40px per hour row
  return (
    <div className="pointer-events-none absolute left-14 right-2" style={{ top }}>
      <div className="flex items-center">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="h-px flex-1 bg-red-500" />
      </div>
    </div>
  );
}

export function CalendarApp() {
  const isMobile = useIsMobile();
  const [today, setToday] = useState<Date | null>(null);
  const [cursor, setCursor] = useState<Date | null>(null);
  const [view, setView] = useState<View>("month");

  // Siri can ask for a specific view ("show me the week")
  useEffect(() => {
    const jump = (v: string) => {
      if (v === "day" || v === "week" || v === "month" || v === "year") setView(v);
    };
    const pending = consumePendingView("calendar");
    if (pending) jump(pending);
    return subscribeViewNav((app, v) => app === "calendar" && jump(v));
  }, []);

  useEffect(() => {
    const now = new Date();
    setToday(now);
    setCursor(now);
    const t = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!today || !cursor) return null;

  const shift = (dir: 1 | -1) => {
    playClick();
    setCursor((c) => {
      if (!c) return c;
      const next = new Date(c);
      if (view === "day") next.setDate(c.getDate() + dir);
      if (view === "week") next.setDate(c.getDate() + dir * 7);
      // pin to day 1 first: on Jul 31, "‹" would otherwise make "June 31" → July 1
      if (view === "month") {
        next.setDate(1);
        next.setMonth(c.getMonth() + dir);
      }
      if (view === "year") {
        next.setDate(1);
        next.setFullYear(c.getFullYear() + dir);
      }
      return next;
    });
  };

  const weekStart = new Date(cursor);
  weekStart.setDate(cursor.getDate() - cursor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const title =
    view === "year"
      ? String(cursor.getFullYear())
      : view === "day"
        ? cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
        : `${cursor.toLocaleDateString(undefined, { month: "long" })} ${cursor.getFullYear()}`;

  // iOS-style full-screen layout — only ever rendered below 768px, so the
  // desktop window markup further down stays byte-for-byte untouched.
  if (isMobile) {
    const containsToday =
      view === "day"
        ? sameDay(cursor, today)
        : view === "week"
          ? weekDays.some((d) => sameDay(d, today))
          : view === "month"
            ? cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()
            : cursor.getFullYear() === today.getFullYear();

    const mobileTitle =
      view === "year"
        ? String(cursor.getFullYear())
        : view === "day"
          ? cursor.toLocaleDateString(undefined, { month: "long", day: "numeric" })
          : cursor.toLocaleDateString(undefined, { month: "long" });
    const mobileYear = view === "year" ? null : String(cursor.getFullYear());

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden text-neutral-800 dark:text-neutral-100">
        {/* Compact D/W/M/Y segmented control — 44px touch target */}
        <div className="shrink-0 px-4 pt-3">
          <div className="flex h-11 items-stretch rounded-[10px] bg-black/[0.06] p-1 dark:bg-white/[0.1]">
            {(["day", "week", "month", "year"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  playClick();
                  setView(v);
                }}
                className={`flex-1 rounded-lg text-[13px] font-semibold capitalize transition ${
                  view === v
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-600 dark:text-white"
                    : "text-neutral-500 active:text-neutral-700 dark:text-neutral-400 dark:active:text-neutral-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Large left-aligned title, red when the visible period contains today */}
          <div className="flex items-center justify-between gap-2 pb-2 pt-4">
            <h1
              className={`min-w-0 truncate text-[30px] font-bold leading-tight tracking-tight ${
                containsToday ? "text-red-500" : ""
              }`}
            >
              {mobileTitle}
              {mobileYear && <span className="font-normal text-neutral-400"> {mobileYear}</span>}
            </h1>
            <div className="flex shrink-0 items-center">
              <button
                onClick={() => shift(-1)}
                aria-label="Previous"
                className="flex h-11 w-11 items-center justify-center text-2xl text-red-500 active:opacity-50"
              >
                ‹
              </button>
              <button
                onClick={() => {
                  playClick();
                  setCursor(new Date());
                }}
                className="flex h-11 items-center px-1 text-[15px] font-medium text-red-500 active:opacity-50"
              >
                Today
              </button>
              <button
                onClick={() => shift(1)}
                aria-label="Next"
                className="flex h-11 w-11 items-center justify-center text-2xl text-red-500 active:opacity-50"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {view === "month" && (
          <MonthGrid year={cursor.getFullYear()} month={cursor.getMonth()} today={today} mobile />
        )}

        {view === "day" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-4 pb-1">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold ${
                  sameDay(cursor, today) ? "bg-red-500 text-white" : "text-neutral-700 dark:text-neutral-200"
                }`}
              >
                {cursor.getDate()}
              </span>
              <span className="truncate text-[13px] text-neutral-400">
                {sameDay(cursor, today) ? "Today · no events, just vibes" : "No events"}
              </span>
            </div>
            <HourRows>
              <NowLine visible={sameDay(cursor, today)} />
            </HourRows>
          </div>
        )}

        {view === "week" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-7 border-b border-black/10 pb-1.5 pl-14 pr-2 text-center dark:border-white/15">
              {weekDays.map((d) => (
                <div key={d.toISOString()} className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] font-semibold text-neutral-400">{DAY_NAMES[d.getDay()][0]}</span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[14px] ${
                      sameDay(d, today)
                        ? "bg-red-500 font-semibold text-white"
                        : "text-neutral-600 dark:text-neutral-300"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
              ))}
            </div>
            <HourRows>
              <NowLine visible={weekDays.some((d) => sameDay(d, today))} />
            </HourRows>
          </div>
        )}

        {view === "year" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="grid grid-cols-3 gap-x-4 gap-y-6 pt-1">
              {Array.from({ length: 12 }, (_, m) => (
                <button
                  key={m}
                  onClick={() => {
                    playClick();
                    setCursor(new Date(cursor.getFullYear(), m, 1));
                    setView("month");
                  }}
                  className="min-h-11 text-left active:opacity-60"
                >
                  <p
                    className={`mb-1 text-[15px] font-semibold ${
                      today.getFullYear() === cursor.getFullYear() && today.getMonth() === m
                        ? "text-red-500"
                        : "text-neutral-800 dark:text-neutral-100"
                    }`}
                  >
                    {new Date(2000, m, 1).toLocaleDateString(undefined, { month: "short" })}
                  </p>
                  <MonthGrid year={cursor.getFullYear()} month={m} today={today} compact />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4 text-neutral-800 dark:text-neutral-100">
      {/* Header — title left, view switcher centered, nav right */}
      <div className="relative mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-xl font-bold">
          {title.split(" ").slice(0, -1).join(" ")}{" "}
          <span className="font-light text-neutral-400">{title.split(" ").at(-1)}</span>
        </span>
        {/* Day / Week / Month / Year segmented control — centered */}
        <div className="absolute left-1/2 flex -translate-x-1/2 rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.08]">
          {(["day", "week", "month", "year"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                playClick();
                setView(v);
              }}
              className={`rounded-md px-3 py-1 text-[12px] font-medium capitalize transition ${
                view === v
                  ? "bg-white text-neutral-800 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-md bg-black/[0.05] px-2.5 py-1 text-sm font-medium text-neutral-600 hover:bg-black/10 dark:bg-white/[0.08] dark:text-neutral-300 dark:hover:bg-white/15">
              ‹
            </button>
            <button
              onClick={() => {
                playClick();
                setCursor(new Date());
              }}
              className="rounded-md bg-black/[0.05] px-2.5 py-1 text-sm font-medium text-neutral-600 hover:bg-black/10 dark:bg-white/[0.08] dark:text-neutral-300 dark:hover:bg-white/15"
            >
              Today
            </button>
            <button onClick={() => shift(1)} className="rounded-md bg-black/[0.05] px-2.5 py-1 text-sm font-medium text-neutral-600 hover:bg-black/10 dark:bg-white/[0.08] dark:text-neutral-300 dark:hover:bg-white/15">
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Views */}
      {view === "month" && (
        <MonthGrid year={cursor.getFullYear()} month={cursor.getMonth()} today={today} />
      )}

      {view === "day" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                sameDay(cursor, today) ? "bg-red-500 text-white" : "text-neutral-700 dark:text-neutral-200"
              }`}
            >
              {cursor.getDate()}
            </span>
            <span className="text-sm text-neutral-400">
              {sameDay(cursor, today) ? "Today · no events, just vibes" : "No events"}
            </span>
          </div>
          <HourRows>
            <NowLine visible={sameDay(cursor, today)} />
          </HourRows>
        </div>
      )}

      {view === "week" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-7 border-b border-black/10 pb-1 pl-14 text-center dark:border-white/15">
            {weekDays.map((d) => (
              <div key={d.toISOString()} className="text-[11px] font-semibold text-neutral-400">
                {DAY_NAMES[d.getDay()]}{" "}
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    sameDay(d, today) ? "bg-red-500 font-bold text-white" : "text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            ))}
          </div>
          <HourRows>
            <NowLine visible={weekDays.some((d) => sameDay(d, today))} />
          </HourRows>
        </div>
      )}

      {view === "year" && (
        <div className="grid min-h-0 flex-1 grid-cols-4 content-stretch gap-x-4 gap-y-1">
          {Array.from({ length: 12 }, (_, m) => (
            <button
              key={m}
              onClick={() => {
                playClick();
                setCursor(new Date(cursor.getFullYear(), m, 1));
                setView("month");
              }}
              className="min-h-0 rounded-lg p-1 text-left transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <p
                className={`mb-0.5 text-[11px] font-bold ${
                  today.getFullYear() === cursor.getFullYear() && today.getMonth() === m
                    ? "text-red-500"
                    : "text-neutral-700 dark:text-neutral-200"
                }`}
              >
                {new Date(2000, m, 1).toLocaleDateString(undefined, { month: "short" })}
              </p>
              <MonthGrid year={cursor.getFullYear()} month={m} today={today} compact />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
