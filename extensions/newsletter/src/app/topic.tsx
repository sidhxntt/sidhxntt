import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@nl-convex/_generated/api";
import { Cover } from "../components/Cover";
import { Footer, Header } from "../components/Header";
import { BASE, href } from "../lib/config";
import { formatDate } from "../lib/format";
import { load } from "../lib/server";

// /newsletter/topic/<name> — everything under one topic.

type Props = { params: Promise<{ topic: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = decodeURIComponent((await params).topic);
  return { title: topic, alternates: { canonical: `${BASE}/topic/${encodeURIComponent(topic)}` } };
}

async function getItems(topic: string) {
  const res = await load(api.posts.published, {});
  const items = (res.ok ? res.data : [])
    .filter((c) => c.kind !== "folder" && c.topic?.toLowerCase() === topic.toLowerCase())
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  return { ok: res.ok, items };
}

// The route's layout: a real 404 for an unused topic, before loading.tsx
// starts streaming (see EntryLayout in entry.tsx).
export async function TopicLayout({ params, children }: Props & { children: React.ReactNode }) {
  const { ok, items } = await getItems(decodeURIComponent((await params).topic));
  if (ok && items.length === 0) notFound();
  return children;
}

export default async function TopicPage({ params }: Props) {
  const topic = decodeURIComponent((await params).topic);
  const { items } = await getItems(topic);

  return (
    <>
      <Header />
      <main id="main" className="wrap">
        <header className="article-head" style={{ maxWidth: "none" }}>
          <nav aria-label="Breadcrumb">
            <ol className="crumbs">
              <li>
                <Link href={BASE}>Newsletter</Link>
              </li>
              <li>
                <Link href={`${BASE}#topics`}>Topics</Link>
              </li>
            </ol>
          </nav>
          <h1 className="article-title">{items[0]?.topic ?? topic}</h1>
          <p className="meta">{items.length === 1 ? "1 piece" : `${items.length} pieces`}</p>
        </header>
        <ul className="grid-2" style={{ marginTop: "2.5rem" }}>
          {items.map((c) => (
            <li key={c.id}>
              <Link className="card" href={href(c.path)}>
                <Cover url={c.coverUrl} title={c.title} tag={c.kind === "series" ? "Series" : undefined} />
                <span className="card__body">
                  <span className="card__title card__title--sans">{c.title}</span>
                  <span className="meta">
                    {[formatDate(c.publishedAt), c.readingMinutes ? `${c.readingMinutes} min read` : ""]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
