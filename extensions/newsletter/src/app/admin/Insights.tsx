"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { api } from "@nl-convex/_generated/api";
import { dayKey } from "@nl-convex/days";
import { Skeleton } from "../../components/Skeleton";
import { href } from "../../lib/config";
import { formatCount, formatDate, formatDay, formatExact, formatRatio } from "../../lib/format";

// The Insights tab, after Medium's stats page: pick a period, see views and
// reads by day (reads drawn inside views, since every read was a view first),
// the subscriber count over time, and how each story did.

type Data = NonNullable<FunctionReturnType<typeof api.analytics.insights>>;
type Day = Data["days"][number];
type Story = Data["stories"][number];
type Period = 7 | 30 | 90;

const PERIODS: Period[] = [7, 30, 90];

export function Insights() {
  const [days, setDays] = useState<Period>(30);
  // the admin's own date; the query never reads the clock
  const today = useMemo(() => dayKey(Date.now()), []);
  const live = useQuery(api.analytics.insights, { days, today });
  // keep the last answer on screen while a new period loads
  const last = useRef<Data | null>(null);
  if (live) last.current = live;
  const data = live ?? last.current;

  if (live === null) return null;
  return (
    <div className="insights" aria-busy={live === undefined}>
      <div className="insights__bar">
        <p className="meta">
          {data ? `${formatDay(data.days[0].day)} to ${formatDay(today)}` : <Skeleton width="9rem" height="0.9rem" />}
        </p>
        <div className="segmented" role="radiogroup" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={days === p} onClick={() => setDays(p)}>
              {p} days
            </button>
          ))}
        </div>
      </div>
      {data ? (
        <Report data={data} period={days} />
      ) : (
        <>
          <Skeleton height="8.5rem" radius="var(--radius)" />
          <Skeleton height="20rem" radius="var(--radius)" />
          <Skeleton height="20rem" radius="var(--radius)" />
        </>
      )}
    </div>
  );
}

function Report({ data, period }: { data: Data; period: Period }) {
  const { current: c, previous: p } = data;
  const prior = `vs the ${period} days before`;
  return (
    <>
      <div className="tiles">
        <Tile label="Views" value={c.views} before={p.views} prior={prior} />
        <Tile label="Reads" value={c.reads} before={p.reads} prior={prior} />
        <Tile
          label="Read ratio"
          display={formatRatio(c.reads, c.views)}
          change={ratioChange(c.reads, c.views, p.reads, p.views)}
          prior={prior}
        />
        <Tile label="Likes" value={c.likes} before={p.likes} prior={prior} />
        <Tile label="Comments" value={c.comments} before={p.comments} prior={prior} />
        <Tile
          label="Subscribers"
          value={data.audience}
          change={audienceChange(c.subscribers, c.unsubscribes)}
          prior={`in these ${period} days`}
        />
      </div>

      <ChartCard
        title="Views and reads"
        legend={[
          { label: "Views", className: "swatch--views" },
          { label: "Reads", className: "swatch--reads" },
        ]}
        table={
          <DayTable
            days={data.days}
            columns={[
              ["Views", (d) => formatExact(d.views)],
              ["Reads", (d) => formatExact(d.reads)],
              ["Read ratio", (d) => formatRatio(d.reads, d.views)],
            ]}
          />
        }
      >
        <ReadsChart days={data.days} />
      </ChartCard>

      <ChartCard
        title="Subscribers"
        note="Confirmed subscribers at the end of each day"
        table={<DayTable days={data.days} columns={[["Subscribers", (d) => formatExact(d.audience)]]} />}
      >
        <AudienceChart days={data.days} />
      </ChartCard>

      <Stories stories={data.stories} period={period} />
    </>
  );
}

/* ───────────────────────────────── tiles ───────────────────────────────── */

type Change = { text: string; dir: "up" | "down" | "flat" };

function countChange(now: number, before: number): Change {
  if (now === before) return { text: "No change", dir: "flat" };
  if (before === 0) return { text: `+${formatExact(now)}`, dir: "up" };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: "About the same", dir: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, dir: pct > 0 ? "up" : "down" };
}

function ratioChange(reads: number, views: number, readsBefore: number, viewsBefore: number): Change | undefined {
  if (views === 0 || viewsBefore === 0) return undefined;
  const pts = Math.round((reads / views - readsBefore / viewsBefore) * 100);
  if (pts === 0) return { text: "No change", dir: "flat" };
  return { text: `${pts > 0 ? "+" : ""}${pts} pts`, dir: pts > 0 ? "up" : "down" };
}

function audienceChange(joined: number, left: number): Change {
  const net = joined - left;
  const parts = [`${joined} joined`, left ? `${left} left` : ""].filter(Boolean).join(", ");
  return { text: parts, dir: net > 0 ? "up" : net < 0 ? "down" : "flat" };
}

const ARROW = { up: "▲", down: "▼", flat: "" } as const;

function Tile(props: {
  label: string;
  value?: number;
  display?: string;
  before?: number;
  change?: Change;
  prior: string;
}) {
  const change = props.change ?? (props.value !== undefined && props.before !== undefined
    ? countChange(props.value, props.before)
    : undefined);
  return (
    <div className="tile">
      <span className="tile__label">{props.label}</span>
      <b className="tile__value" title={props.value !== undefined ? formatExact(props.value) : undefined}>
        {props.display ?? formatCount(props.value ?? 0)}
      </b>
      {change && (
        <span className={`tile__change tile__change--${change.dir}`}>
          {ARROW[change.dir] && <span aria-hidden="true">{ARROW[change.dir]} </span>}
          {change.text} <span className="tile__prior">{props.prior}</span>
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────── chart frame ───────────────────────────── */

function ChartCard(props: {
  title: string;
  note?: string;
  legend?: { label: string; className: string }[];
  table: ReactNode;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="chart-card" aria-label={props.title}>
      <div className="chart-card__head">
        <div>
          <h2 className="chart-card__title">{props.title}</h2>
          {props.note && <p className="chart-card__note">{props.note}</p>}
        </div>
        <div className="chart-card__tools">
          {props.legend && !asTable && (
            <ul className="legend">
              {props.legend.map((l) => (
                <li key={l.label}>
                  <span className={`swatch ${l.className}`} aria-hidden="true" />
                  {l.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn--small btn--ghost" onClick={() => setAsTable((v) => !v)}>
            {asTable ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>
      {asTable ? <div className="chart-card__table">{props.table}</div> : props.children}
    </section>
  );
}

function DayTable({ days, columns }: { days: Day[]; columns: [string, (d: Day) => string][] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Day</th>
          {columns.map(([name]) => (
            <th key={name} scope="col" className="num">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...days].reverse().map((d) => (
          <tr key={d.day}>
            <th scope="row">{formatDay(d.day)}</th>
            {columns.map(([name, cell]) => (
              <td key={name} className="num">
                {cell(d)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// 0 and up to five round steps above the largest value
function ticksFor(max: number): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const rough = max / 5;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough)!;
  const n = Math.ceil(max / step);
  return Array.from({ length: n + 1 }, (_, i) => Math.round(i * step * 1000) / 1000);
}

const H = 240;
const M = { top: 12, right: 8, bottom: 28, left: 44 };

type Frame = { width: number; x: (i: number) => number; band: number; y: (v: number) => number; ticks: number[] };

function frame(width: number, count: number, max: number): Frame {
  const ticks = ticksFor(max);
  const top = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = H - M.top - M.bottom;
  const band = innerW / count;
  return {
    width,
    band,
    ticks,
    x: (i) => M.left + band * i + band / 2,
    y: (v) => M.top + innerH - (v / top) * innerH,
  };
}

function Axes({ f, days }: { f: Frame; days: Day[] }) {
  const every = Math.ceil(days.length / 6);
  return (
    <g className="axes">
      {f.ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={f.width - M.right} y1={f.y(t)} y2={f.y(t)} className={t === 0 ? "baseline" : "grid"} />
          <text x={M.left - 8} y={f.y(t)} dy="0.32em" textAnchor="end">
            {formatCount(t)}
          </text>
        </g>
      ))}
      {days.map((d, i) =>
        (days.length - 1 - i) % every === 0 ? (
          <text key={d.day} x={f.x(i)} y={H - 8} textAnchor="middle">
            {formatDay(d.day)}
          </text>
        ) : null,
      )}
    </g>
  );
}

// A column from the baseline up with 4px rounded top corners
function column(cx: number, w: number, y0: number, y1: number): string {
  const h = y0 - y1;
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  const l = cx - w / 2;
  return `M${l},${y0}V${y1 + r}Q${l},${y1} ${l + r},${y1}H${l + w - r}Q${l + w},${y1} ${l + w},${y1 + r}V${y0}Z`;
}

// Hover and arrow-key focus over the day columns
function useActive(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowLeft" ? -1 : 1;
    setActive((a) => Math.min(count - 1, Math.max(0, (a ?? count) + step)));
  };
  return { active, setActive, onKeyDown };
}

function Tooltip({ f, index, y, children }: { f: Frame; index: number; y: number; children: ReactNode }) {
  const x = f.x(index);
  const flip = x > f.width * 0.66;
  return (
    <div
      className="chart-tip"
      role="status"
      style={{ left: x, top: Math.max(0, y - 8), transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -100%)` }}
    >
      {children}
    </div>
  );
}

function HitAreas({ f, count, onEnter }: { f: Frame; count: number; onEnter: (i: number) => void }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={M.left + f.band * i}
          y={M.top}
          width={f.band}
          height={H - M.top - M.bottom}
          fill="transparent"
          onMouseEnter={() => onEnter(i)}
        />
      ))}
    </g>
  );
}

/* ──────────────────────────────── charts ───────────────────────────────── */

function ReadsChart({ days }: { days: Day[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(0, ...days.map((d) => d.views));
  const { active, setActive, onKeyDown } = useActive(days.length);
  const total = days.reduce((s, d) => s + d.views, 0);
  const f = frame(width, days.length, max);
  const barW = Math.min(24, Math.max(2, f.band - Math.max(2, f.band * 0.3)));
  const base = f.y(0);
  const a = active !== null ? days[active] : null;

  return (
    <div
      ref={ref}
      className="chart"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      onMouseLeave={() => setActive(null)}
      aria-label={`Views and reads by day. ${formatExact(total)} views in all. Use the arrow keys to read each day, or show the table.`}
    >
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-hidden="true">
          <Axes f={f} days={days} />
          {active !== null && (
            <rect className="chart__hover" x={M.left + f.band * active} y={M.top} width={f.band} height={base - M.top} />
          )}
          {days.map((d, i) => (
            <g key={d.day}>
              <path className="bar--views" d={column(f.x(i), barW, base, f.y(d.views))} />
              <path className="bar--reads" d={column(f.x(i), barW, base, f.y(d.reads))} />
            </g>
          ))}
          <HitAreas f={f} count={days.length} onEnter={setActive} />
        </svg>
      )}
      {total === 0 && width > 0 && <p className="chart__empty">No views in these days yet.</p>}
      {a && active !== null && (
        <Tooltip f={f} index={active} y={f.y(a.views)}>
          <strong>{formatDay(a.day)}</strong>
          <span>
            <i className="swatch swatch--views" aria-hidden="true" /> {formatExact(a.views)} views
          </span>
          <span>
            <i className="swatch swatch--reads" aria-hidden="true" /> {formatExact(a.reads)} reads (
            {formatRatio(a.reads, a.views)})
          </span>
        </Tooltip>
      )}
    </div>
  );
}

function AudienceChart({ days }: { days: Day[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(0, ...days.map((d) => d.audience));
  const { active, setActive, onKeyDown } = useActive(days.length);
  const f = frame(width, days.length, max);
  const line = days.map((d, i) => `${i ? "L" : "M"}${f.x(i)},${f.y(d.audience)}`).join("");
  const last = days.length - 1;
  const a = active !== null ? days[active] : null;

  return (
    <div
      ref={ref}
      className="chart"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      onMouseLeave={() => setActive(null)}
      aria-label={`Subscribers by day, ${formatExact(days[last]?.audience ?? 0)} now. Use the arrow keys to read each day, or show the table.`}
    >
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-hidden="true">
          <Axes f={f} days={days} />
          {active !== null && (
            <line className="chart__crosshair" x1={f.x(active)} x2={f.x(active)} y1={M.top} y2={f.y(0)} />
          )}
          <path className="line--audience" d={line} />
          <circle className="dot--audience" cx={f.x(active ?? last)} cy={f.y(days[active ?? last].audience)} r={4.5} />
          <HitAreas f={f} count={days.length} onEnter={setActive} />
        </svg>
      )}
      {a && active !== null && (
        <Tooltip f={f} index={active} y={f.y(a.audience)}>
          <strong>{formatDay(a.day)}</strong>
          <span>{formatExact(a.audience)} subscribers</span>
          {(a.subscribers > 0 || a.unsubscribes > 0) && (
            <span>
              {[a.subscribers ? `${a.subscribers} joined` : "", a.unsubscribes ? `${a.unsubscribes} left` : ""]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
        </Tooltip>
      )}
    </div>
  );
}

/* ──────────────────────────────── stories ──────────────────────────────── */

type SortKey = "views" | "reads" | "ratio" | "likes" | "comments" | "publishedAt";
const SORTS: [SortKey, string][] = [
  ["views", "Views"],
  ["reads", "Reads"],
  ["ratio", "Read ratio"],
  ["likes", "Likes"],
  ["comments", "Comments"],
];

function sortValue(s: Story, key: SortKey): number {
  if (key === "ratio") return s.views ? s.reads / s.views : -1;
  if (key === "publishedAt") return s.publishedAt ?? 0;
  return s[key];
}

function Stories({ stories, period }: { stories: Story[]; period: Period }) {
  const [sort, setSort] = useState<SortKey>("views");
  const rows = useMemo(
    () =>
      [...stories].sort(
        (a, b) => sortValue(b, sort) - sortValue(a, sort) || (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
      ),
    [stories, sort],
  );
  return (
    <section className="chart-card" aria-labelledby="stories-title">
      <div className="chart-card__head">
        <div>
          <h2 className="chart-card__title" id="stories-title">
            Stories
          </h2>
          <p className="chart-card__note">The last {period} days; all-time views under each count</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="meta">Nothing published yet.</p>
      ) : (
        <div className="chart-card__table chart-card__table--tall">
          <table className="data-table data-table--stories">
            <thead>
              <tr>
                <th scope="col" aria-sort={sort === "publishedAt" ? "descending" : "none"}>
                  <button type="button" onClick={() => setSort("publishedAt")}>
                    Story
                  </button>
                </th>
                {SORTS.map(([key, label]) => (
                  <th key={key} scope="col" className="num" aria-sort={sort === key ? "descending" : "none"}>
                    <button type="button" onClick={() => setSort(key)}>
                      {label}
                      {sort === key && <span aria-hidden="true"> ↓</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    <a href={href(s.path)} target="_blank" rel="noopener">
                      {s.title}
                    </a>
                    <span className="data-table__sub">
                      {s.kind === "series" ? "Series, " : ""}
                      {formatDate(s.publishedAt)}
                    </span>
                  </th>
                  <td className="num">
                    {formatExact(s.views)}
                    <span className="data-table__sub">{formatExact(s.allTimeViews)}</span>
                  </td>
                  <td className="num">
                    {formatExact(s.reads)}
                    <span className="data-table__sub">{formatExact(s.allTimeReads)}</span>
                  </td>
                  <td className="num">{formatRatio(s.reads, s.views)}</td>
                  <td className="num">{formatExact(s.likes)}</td>
                  <td className="num">{formatExact(s.comments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
