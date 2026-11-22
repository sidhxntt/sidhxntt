"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { api } from "@nl-convex/_generated/api";
import type { Id } from "@nl-convex/_generated/dataModel";
import { errorMessage } from "../../components/errors";
import { BASE, href } from "../../lib/config";
import { formatDate, formatExact, timeAgo } from "../../lib/format";
import { AdminGate } from "./Gate";
import { Insights } from "./Insights";
import { DashboardSkeleton } from "./Skeletons";
import { SkeletonRows } from "../../components/Skeleton";

// /newsletter/admin — the post tree, Insights (views, reads, subscribers),
// comment moderation and subscribers.

type Tree = NonNullable<FunctionReturnType<typeof api.posts.adminTree>>;
type Item = Tree[number];
type Row = Item & { depth: number; path: string[] | null; hasChildren: boolean };

const KIND_LABEL = { post: "Post", series: "Series", folder: "Folder" } as const;

export default function AdminDashboard() {
  return (
    <main id="main" className="wrap admin">
      <AdminGate fallback={<DashboardSkeleton />}>
        <Dashboard />
      </AdminGate>
    </main>
  );
}

type Tab = "posts" | "insights" | "comments" | "subscribers";
const TABS: Tab[] = ["posts", "insights", "comments", "subscribers"];
const TAB_LABEL: Record<Tab, string> = {
  posts: "Posts",
  insights: "Insights",
  comments: "Comments",
  subscribers: "Subscribers",
};

// The tab lives in the address (#insights) so a reload or a shared link
// opens the same one.
function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>("posts");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1) as Tab;
      setTab(TABS.includes(h) ? h : "posts");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "posts" ? window.location.pathname : `#${t}`);
  };
  return [tab, choose];
}

function Dashboard() {
  const [tab, setTab] = useTab();
  const tree = useQuery(api.posts.adminTree, {});
  const comments = useQuery(api.comments.recent, { limit: 100 });
  const subs = useQuery(api.subscribers.stats, {});
  const counts: Partial<Record<Tab, number | undefined>> = {
    posts: tree?.length,
    comments: comments?.length,
    subscribers: subs?.active,
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = TABS[(TABS.indexOf(tab) + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <>
      <div className="admin__head">
        <h1 className="admin__title">Newsletter</h1>
        <div className="side-actions">
          <Link className="btn" href={BASE}>
            View the newsletter
          </Link>
          <Link className="btn btn--primary" href={`${BASE}/admin/edit/new`}>
            New post
          </Link>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Manage" onKeyDown={onKeyDown}>
        {TABS.map((id) => (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="admin-panel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {TAB_LABEL[id]}
            {counts[id] !== undefined && <span className="tabs__count">{counts[id]}</span>}
          </button>
        ))}
      </div>
      <div id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "posts" && <Posts />}
        {tab === "insights" && <Insights />}
        {tab === "comments" && <Moderation />}
        {tab === "subscribers" && <Subscribers />}
      </div>
    </>
  );
}

function flatten(items: Tree): Row[] {
  const byParent = new Map<string | null, Item[]>();
  for (const it of items) {
    const key = it.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), it]);
  }
  const rows: Row[] = [];
  const walk = (parentId: string | null, depth: number, path: string[] | null) => {
    for (const it of (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order)) {
      const own = path && it.status === "published" ? [...path, it.slug] : null;
      rows.push({ ...it, depth, path: own, hasChildren: byParent.has(it.id) });
      walk(it.id, depth + 1, own);
    }
  };
  walk(null, 0, []);
  return rows;
}

function Posts() {
  const tree = useQuery(api.posts.adminTree, {});
  // reorder on screen at once; the server renumbers the same way
  const move = useMutation(api.posts.move).withOptimisticUpdate((store, { id, direction }) => {
    const items = store.getQuery(api.posts.adminTree, {});
    if (!items) return;
    const me = items.find((x) => x.id === id);
    if (!me) return;
    const siblings = items.filter((x) => x.parentId === me.parentId).sort((a, b) => a.order - b.order);
    const i = siblings.findIndex((x) => x.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    const order = new Map(siblings.map((x, n) => [x.id, n]));
    store.setQuery(
      api.posts.adminTree,
      {},
      items.map((x) => (order.has(x.id) ? { ...x, order: order.get(x.id)! } : x)),
    );
  });
  const rows = useMemo(() => (tree ? flatten(tree) : []), [tree]);

  if (tree === undefined) return <SkeletonRows rows={8} />;
  if (!tree || rows.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing written yet</h2>
        <p>
          Start with a post, or a series to hold several parts, or a folder (like Blogs or Misc) to group them.
        </p>
        <p>
          <Link className="btn btn--primary" href={`${BASE}/admin/edit/new`}>
            New post
          </Link>
        </p>
      </div>
    );
  }

  const totals = rows.reduce(
    (t, r) => ({ live: t.live + (r.status === "published" && r.kind !== "folder" ? 1 : 0), drafts: t.drafts + (r.status === "draft" ? 1 : 0) }),
    { live: 0, drafts: 0 },
  );
  return (
    <div className="chart-card chart-card--flush">
      <p className="chart-card__note posts-summary">
        {totals.live} published, {totals.drafts} {totals.drafts === 1 ? "draft" : "drafts"}. Use the arrows to
        reorder within a folder or series.
      </p>
      <div className="chart-card__table chart-card__table--tall">
        <table className="data-table data-table--posts">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
              <th scope="col" className="num">
                Views
              </th>
              <th scope="col" className="num">
                Likes
              </th>
              <th scope="col" className="num">
                Comments
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const siblings = rows.filter((x) => x.parentId === r.parentId);
              const pos = siblings.findIndex((x) => x.id === r.id);
              const counted = r.kind !== "folder";
              return (
                <tr key={r.id} className={r.status === "draft" ? "is-draft" : undefined}>
                  <th scope="row">
                    <div className="post-cell" style={{ paddingLeft: `${r.depth * 1.5}rem` }}>
                      {r.depth > 0 && <span className="post-cell__elbow" aria-hidden="true" />}
                      <div>
                        <Link href={`${BASE}/admin/edit/${r.id}`}>{r.title || "Untitled"}</Link>
                        <span className="data-table__sub">
                          {KIND_LABEL[r.kind]}
                          {r.topic ? `, ${r.topic}` : ""}
                          {r.emailedAt ? ", emailed" : ""}
                        </span>
                      </div>
                    </div>
                  </th>
                  <td>
                    <span className={`pill ${r.status === "published" ? "pill--live" : ""}`}>
                      {r.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="nowrap">
                    {r.publishedAt ? formatDate(r.publishedAt) : <span className="muted">Edited {timeAgo(r.updatedAt)}</span>}
                  </td>
                  <td className="num">{counted ? formatExact(r.viewCount) : ""}</td>
                  <td className="num">{counted ? formatExact(r.likeCount) : ""}</td>
                  <td className="num">{counted ? formatExact(r.commentCount) : ""}</td>
                  <td>
                    <span className="row-tools">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${r.title} up`}
                        disabled={pos === 0}
                        onClick={() => void move({ id: r.id as Id<"posts">, direction: "up" })}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Move ${r.title} down`}
                        disabled={pos === siblings.length - 1}
                        onClick={() => void move({ id: r.id as Id<"posts">, direction: "down" })}
                      >
                        ↓
                      </button>
                      {r.kind !== "post" ? (
                        <Link className="btn btn--small" href={`${BASE}/admin/edit/new?parent=${r.id}`}>
                          Add inside
                        </Link>
                      ) : (
                        <span />
                      )}
                      {r.path ? (
                        <a className="btn btn--small btn--ghost" href={href(r.path)} target="_blank" rel="noopener">
                          View
                        </a>
                      ) : (
                        <span />
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Moderation() {
  const recent = useQuery(api.comments.recent, { limit: 100 });
  const moderate = useMutation(api.comments.moderate).withOptimisticUpdate((store, { id }) => {
    const list = store.getQuery(api.comments.recent, { limit: 100 });
    if (list) store.setQuery(api.comments.recent, { limit: 100 }, list.filter((c) => c.id !== id));
  });
  const [error, setError] = useState<string | null>(null);
  if (recent === undefined) return <SkeletonRows rows={4} height="6rem" />;
  if (!recent || recent.length === 0) return <p className="meta">No comments yet.</p>;
  return (
    <div className="mod-list">
      {error && <p className="error-text">{error}</p>}
      {recent.map((c) => (
        <div key={c.id} className="mod">
          <p className="meta">
            <strong style={{ color: "var(--text)" }}>{c.author}</strong>
            {c.authorEmail ? ` (${c.authorEmail})` : ""} on {c.postTitle}, {timeAgo(c.createdAt)}
          </p>
          <p>{c.body}</p>
          <div>
            <button
              type="button"
              className="btn btn--small btn--danger"
              onClick={() => moderate({ id: c.id }).catch((e) => setError(errorMessage(e)))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const SUB_STATUS = { active: "Subscribed", pending: "Waiting to confirm", unsubscribed: "Unsubscribed" } as const;

function Subscribers() {
  const stats = useQuery(api.subscribers.stats, {});
  const recent = useQuery(api.subscribers.recent, { limit: 100 });
  if (stats === undefined) return <SkeletonRows rows={4} />;
  if (!stats) return null;
  return (
    <div className="insights">
      <div className="tiles">
        <div className="tile">
          <span className="tile__label">Subscribed and confirmed</span>
          <b className="tile__value">{formatExact(stats.active)}</b>
        </div>
        <div className="tile">
          <span className="tile__label">Waiting to confirm</span>
          <b className="tile__value">{formatExact(stats.pending)}</b>
        </div>
        <div className="tile">
          <span className="tile__label">Unsubscribed</span>
          <b className="tile__value">{formatExact(stats.unsubscribed)}</b>
        </div>
      </div>
      <section className="chart-card" aria-labelledby="recent-subs">
        <div className="chart-card__head">
          <div>
            <h2 className="chart-card__title" id="recent-subs">
              Newest sign-ups
            </h2>
            <p className="chart-card__note">
              Email a post to subscribers from its edit page once it&rsquo;s published. Growth over time is in
              Insights.
            </p>
          </div>
        </div>
        {!recent || recent.length === 0 ? (
          <p className="meta">No one has signed up yet.</p>
        ) : (
          <div className="chart-card__table">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">{s.email}</th>
                    <td>
                      <span className={`pill ${s.status === "active" ? "pill--live" : ""}`}>{SUB_STATUS[s.status]}</span>
                    </td>
                    <td className="nowrap">{formatDate(s.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
