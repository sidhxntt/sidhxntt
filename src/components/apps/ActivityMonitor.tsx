"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { playClick } from "@/lib/sounds";

type Tab = "cpu" | "memory" | "network";
type SortKey = "name" | "cpu" | "mem" | "threads";
type SortDir = "asc" | "desc";

interface Proc {
  id: number;
  name: string;
  cpu: number; // %
  mem: number; // MB (used for sorting even when display overridden)
  memLabel?: string; // display override, e.g. "growing…"
  threads: number;
  jitter: boolean;
}

const WINDOW = 60;
const RAM_GB = 32;

const INITIAL_PROCS: Proc[] = [
  { id: 1, name: "Chrome Tab #147", cpu: 38.2, mem: 31900, threads: 42, jitter: true },
  { id: 2, name: "node_modules indexer", cpu: 24.6, mem: 999999, memLabel: "growing…", threads: 128, jitter: true },
  { id: 3, name: "WindowServer (this portfolio)", cpu: 1.2, mem: 84, threads: 6, jitter: true },
  { id: 4, name: "Spotify (in your heart)", cpu: 4.3, mem: 512, threads: 24, jitter: true },
  { id: 5, name: "kernel_task", cpu: 12.7, mem: 1740, threads: 512, jitter: true },
  { id: 6, name: "Waiting for CI", cpu: 0.1, mem: 12, threads: 1, jitter: false },
  { id: 7, name: "npm install (day 3)", cpu: 87.4, mem: 4096, threads: 64, jitter: true },
  { id: 8, name: "Electron App #9", cpu: 9.8, mem: 2048, threads: 31, jitter: true },
  { id: 9, name: "mdworker (judging your files)", cpu: 2.4, mem: 156, threads: 4, jitter: true },
  { id: 10, name: "Slack (says it's idle)", cpu: 14.1, mem: 1337, threads: 38, jitter: true },
  { id: 11, name: "coreaudiod (lofi beats)", cpu: 3.6, mem: 96, threads: 7, jitter: true },
  { id: 12, name: "Docker Desktop (fans engaged)", cpu: 41.9, mem: 6144, threads: 96, jitter: true },
];

function clamp(v: number, lo = 5, hi = 95) {
  return Math.min(hi, Math.max(lo, v));
}

function walk(prev: number, step = 8) {
  return clamp(prev + (Math.random() - 0.5) * step);
}

function seedSeries(start: number): number[] {
  const out: number[] = [clamp(start)];
  for (let i = 1; i < WINDOW; i++) out.push(walk(out[i - 1]));
  return out;
}

function formatMem(p: Proc): string {
  if (p.memLabel) return p.memLabel;
  if (p.mem >= 1024) return `${(p.mem / 1024).toFixed(1)} GB`;
  return `${Math.round(p.mem)} MB`;
}

const CHART_W = 600;
const CHART_H = 150;

function toPoints(series: number[]): string {
  const n = series.length;
  if (n === 0) return "";
  return series
    .map((v, i) => {
      const x = (i / (WINDOW - 1)) * CHART_W;
      const y = CHART_H - (v / 100) * CHART_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function AreaSeries({ series, color, fillOpacity = 0.18 }: { series: number[]; color: string; fillOpacity?: number }) {
  const pts = toPoints(series);
  if (!pts) return null;
  const lastX = ((series.length - 1) / (WINDOW - 1)) * CHART_W;
  const firstX = 0;
  return (
    <g>
      <polygon points={`${firstX},${CHART_H} ${pts} ${lastX.toFixed(1)},${CHART_H}`} fill={color} fillOpacity={fillOpacity} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

function Chart({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-800">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block h-36 w-full" preserveAspectRatio="none" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={CHART_W} y1={CHART_H * f} y2={CHART_H * f} className="stroke-black/[0.08] dark:stroke-white/[0.08]" strokeWidth={1} />
        ))}
        <line x1={0} x2={CHART_W} y1={CHART_H - 0.5} y2={CHART_H - 0.5} className="stroke-black/[0.12] dark:stroke-white/[0.12]" strokeWidth={1} />
        {children}
      </svg>
    </div>
  );
}

export function ActivityMonitor() {
  const [tab, setTab] = useState<Tab>("cpu");
  const [cpuSeries, setCpuSeries] = useState<number[]>(() => seedSeries(35));
  const [memSeries, setMemSeries] = useState<number[]>(() => seedSeries(58));
  const [netInSeries, setNetInSeries] = useState<number[]>(() => seedSeries(40));
  const [netOutSeries, setNetOutSeries] = useState<number[]>(() => seedSeries(15));
  const [procs, setProcs] = useState<Proc[]>(INITIAL_PROCS);
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [fps, setFps] = useState<number | null>(null);
  const [heapMB, setHeapMB] = useState<number | null>(null);
  const [cores, setCores] = useState<number | null>(null);

  // 1s tick: advance all series + jitter process numbers
  useEffect(() => {
    const push = (prev: number[]) => [...prev.slice(-(WINDOW - 1)), walk(prev[prev.length - 1] ?? 50)];
    const id = setInterval(() => {
      setCpuSeries(push);
      setMemSeries(push);
      setNetInSeries(push);
      setNetOutSeries(push);
      setProcs((prev) =>
        prev.map((p) => {
          if (!p.jitter) return p;
          const cpu = Math.max(0, p.cpu + (Math.random() - 0.5) * 1.6);
          const mem = p.memLabel ? p.mem : Math.max(1, p.mem * (1 + (Math.random() - 0.5) * 0.02));
          return { ...p, cpu, mem };
        }),
      );
      // guarded heap read (Chrome only)
      const perf = performance as unknown as { memory?: { usedJSHeapSize?: number } };
      const used = perf.memory?.usedJSHeapSize;
      setHeapMB(typeof used === "number" ? used / (1024 * 1024) : null);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Honest metric: real FPS via rAF counter
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // hardwareConcurrency (client-only, read once)
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      setCores(navigator.hardwareConcurrency);
    }
  }, []);

  const sortedProcs = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...procs].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [procs, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    playClick();
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const handleTab = (t: Tab) => {
    if (t === tab) return;
    playClick();
    setTab(t);
  };

  const cpuNow = cpuSeries[cpuSeries.length - 1] ?? 0;
  const memNow = memSeries[memSeries.length - 1] ?? 0;
  const netInNow = netInSeries[netInSeries.length - 1] ?? 0;
  const netOutNow = netOutSeries[netOutSeries.length - 1] ?? 0;

  const readout =
    tab === "cpu"
      ? `${Math.round(cpuNow)}%`
      : tab === "memory"
        ? `${((memNow / 100) * RAM_GB).toFixed(1)} GB of ${RAM_GB} GB`
        : `↓ ${Math.round(netInNow)} MB/s ↑ ${Math.round(netOutNow)} MB/s`;

  const readoutLabel = tab === "cpu" ? "CPU Usage" : tab === "memory" ? "Memory Used" : "Network Throughput";

  const tabs: { key: Tab; label: string }[] = [
    { key: "cpu", label: "CPU" },
    { key: "memory", label: "Memory" },
    { key: "network", label: "Network" },
  ];

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "name", label: "Process Name", align: "left" },
    { key: "cpu", label: "% CPU", align: "right" },
    { key: "mem", label: "Memory", align: "right" },
    { key: "threads", label: "Threads", align: "right" },
  ];

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-neutral-100/60 p-3 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-100">
      {/* Segmented tab bar */}
      <div className="flex justify-center">
        <div className="flex gap-0.5 rounded-lg border border-black/10 bg-white p-0.5 shadow-sm dark:border-white/10 dark:bg-neutral-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTab(t.key)}
              className={`rounded-md px-4 py-1 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "bg-black/10 text-neutral-900 dark:bg-white/15 dark:text-white"
                  : "text-neutral-600 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Readout */}
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{readout}</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{readoutLabel}</span>
        {tab === "network" && (
          <span className="ml-auto flex items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#0a84ff" }} />
              In
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#0a84ff", opacity: 0.45 }} />
              Out
            </span>
          </span>
        )}
      </div>

      {/* Chart */}
      {tab === "cpu" && (
        <Chart>
          <AreaSeries series={cpuSeries} color="#34c759" />
        </Chart>
      )}
      {tab === "memory" && (
        <Chart>
          <AreaSeries series={memSeries} color="#af52de" />
        </Chart>
      )}
      {tab === "network" && (
        <Chart>
          <AreaSeries series={netInSeries} color="#0a84ff" />
          <AreaSeries series={netOutSeries} color="#0a84ff" fillOpacity={0.08} />
        </Chart>
      )}

      {/* Honest stat chips (2-column summary cards on phones) */}
      <div className="flex flex-wrap gap-1.5 px-1 max-md:grid max-md:grid-cols-2 max-md:gap-2 max-md:px-0">
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 max-md:rounded-lg max-md:px-3 max-md:py-2 max-md:text-center max-md:text-xs max-md:shadow-sm">
          Renderer FPS: ~{fps ?? "--"}
        </span>
        {cores !== null && (
          <span className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 max-md:rounded-lg max-md:px-3 max-md:py-2 max-md:text-center max-md:text-xs max-md:shadow-sm">
            {cores} cores
          </span>
        )}
        {heapMB !== null && (
          <span className="rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 max-md:rounded-lg max-md:px-3 max-md:py-2 max-md:text-center max-md:text-xs max-md:shadow-sm">
            JS heap: {heapMB.toFixed(1)} MB
          </span>
        )}
      </div>

      {/* Process list (phones): stacked rows with tiny CPU / memory bars */}
      <div className="hidden overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-800 max-md:block">
        <p className="border-b border-black/10 bg-neutral-50 px-3 py-1.5 text-[11px] font-medium text-neutral-500 dark:border-white/10 dark:bg-neutral-900/40 dark:text-neutral-400">
          Processes
        </p>
        {sortedProcs.map((p) => (
          <div key={p.id} className="border-b border-black/5 px-3 py-2 last:border-0 dark:border-white/10">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium">{p.name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                {p.cpu.toFixed(1)}% · {formatMem(p)} · {p.threads} thr
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(p.cpu, 100)}%`, background: "#34c759" }}
                />
              </div>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min((p.mem / (RAM_GB * 1024)) * 100, 100)}%`, background: "#af52de" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Process table (desktop) */}
      <div className="overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-800 max-md:hidden">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-black/10 bg-neutral-50 dark:border-white/10 dark:bg-neutral-900/40">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`cursor-pointer select-none px-3 py-1.5 font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100 ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                  onClick={() => handleSort(c.key)}
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-1 text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProcs.map((p) => (
              <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]">
                <td className="px-3 py-1.5">{p.name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{p.cpu.toFixed(1)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatMem(p)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{p.threads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
