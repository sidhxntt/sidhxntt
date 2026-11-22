import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@nl-convex/_generated/api";
import { Comments } from "../components/Comments";
import { Cover } from "../components/Cover";
import { Footer, Header } from "../components/Header";
import { PostActions } from "../components/PostActions";
import { ReadTracker } from "../components/ReadTracker";
import { SubscribeForm } from "../components/SubscribeForm";
import { BASE, href } from "../lib/config";
import { formatDate } from "../lib/format";
import { IMAGE } from "../lib/meta";
import { renderPostHtml } from "../lib/render";
import { load } from "../lib/server";

// /newsletter/<slug>/<slug>/… — a post, a series or a folder, by its path in
// the tree.

type Props = { params: Promise<{ path: string[] }> };

async function getEntry(path: string[]) {
  const res = await load(api.posts.byPath, { path: path.map((s) => decodeURIComponent(s)) });
  return res.ok ? res.data : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getEntry((await params).path);
  if (!entry) return { title: "Not found" };
  const url = href(entry.path);
  return {
    title: entry.title,
    description: entry.excerpt ?? undefined,
    alternates: { canonical: url },
    openGraph: {
      type: entry.kind === "post" ? "article" : "website",
      url,
      title: entry.title,
      description: entry.excerpt ?? undefined,
      ...(entry.publishedAt ? { publishedTime: new Date(entry.publishedAt).toISOString() } : {}),
      // no cover: the newsletter's own card
      images: [entry.coverUrl ? { url: entry.coverUrl } : { ...IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: entry.title,
      description: entry.excerpt ?? undefined,
      images: [entry.coverUrl ?? IMAGE.url],
    },
  };
}

// The route's layout. loading.tsx streams the skeleton (and with it a 200)
// before the page renders, so a missing entry is caught here, above that
// boundary, to answer with a real 404. Same cached query as the page's.
export async function EntryLayout({ params, children }: Props & { children: React.ReactNode }) {
  if (!(await getEntry((await params).path))) notFound();
  return children;
}

export default async function EntryPage({ params }: Props) {
  const entry = await getEntry((await params).path);
  if (!entry) notFound();

  const html = renderPostHtml(entry.contentHtml);
  const series = entry.series;
  const prev = series && series.index > 0 ? series.parts[series.index - 1] : null;
  const next = series && series.index < series.parts.length - 1 ? series.parts[series.index + 1] : null;
  const parts = entry.children.filter((c) => c.kind === "post");

  return (
    <>
      <Header />
      <main id="main" className="wrap">
        <header className="article-head">
          <nav aria-label="Breadcrumb">
            <ol className="crumbs">
              <li>
                <Link href={BASE}>Newsletter</Link>
              </li>
              {entry.ancestors.map((a) => (
                <li key={a.path.join("/")}>
                  <Link href={href(a.path)}>{a.title}</Link>
                </li>
              ))}
            </ol>
          </nav>

          {series && (
            <p className="article-head__part">
              Part {series.index + 1} of {series.parts.length} in <Link href={href(series.path)}>{series.title}</Link>
            </p>
          )}
          {entry.kind === "series" && (
            <p className="article-head__part">
              A series in {parts.length} {parts.length === 1 ? "part" : "parts"}
            </p>
          )}

          <h1 className="article-title">{entry.title}</h1>
          {entry.excerpt && <p className="article-excerpt">{entry.excerpt}</p>}
          {entry.kind === "post" && (
            <p className="meta">
              {[
                formatDate(entry.publishedAt),
                entry.readingMinutes ? `${entry.readingMinutes} min read` : "",
                entry.topic ?? "",
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </header>

        {entry.coverUrl && (
          <div className="article-cover">
            <Cover url={entry.coverUrl} title={entry.title} eager />
          </div>
        )}

        <div className="reading">
          {html && <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />}
          {entry.kind !== "folder" && <ReadTracker postId={entry.id} minutes={entry.readingMinutes} />}

          {entry.kind === "post" && (
            <>
              <PostActions
                postId={entry.id}
                title={entry.title}
                initial={{ likeCount: entry.likeCount, commentCount: entry.commentCount, liked: entry.liked, saved: entry.saved }}
              />

              {series && (
                <nav className="series-box" aria-label={`Parts of ${series.title}`}>
                  <p className="meta">This post is part of a series</p>
                  <Link href={href(series.path)} style={{ textDecoration: "none" }}>
                    <h2 className="series-box__title">{series.title}</h2>
                  </Link>
                  <ol>
                    {series.parts.map((p, i) => (
                      <li key={p.path.join("/")}>
                        {i === series.index ? (
                          <span className="current" aria-current="page">
                            <span className="n">Part {i + 1}</span>
                            <span>{p.title}</span>
                          </span>
                        ) : (
                          <Link href={href(p.path)}>
                            <span className="n">Part {i + 1}</span>
                            <span>{p.title}</span>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                  {(prev || next) && (
                    <div className="prevnext">
                      {prev ? (
                        <Link href={href(prev.path)}>
                          <small>Previous part</small>
                          {prev.title}
                        </Link>
                      ) : (
                        <span />
                      )}
                      {next && (
                        <Link className="next" href={href(next.path)}>
                          <small>Next part</small>
                          {next.title}
                        </Link>
                      )}
                    </div>
                  )}
                </nav>
              )}

              <section className="series-box" aria-labelledby="sub-title">
                <h2 className="series-box__title" id="sub-title">
                  Get the next post by email
                </h2>
                <p className="meta" style={{ margin: "0.4rem 0 1rem" }}>
                  One email when I publish something new. Unsubscribe anytime.
                </p>
                <SubscribeForm id="post-email" />
              </section>

              <Comments postId={entry.id} />
            </>
          )}
        </div>

        {entry.kind === "series" && parts.length > 0 && (
          <>
            <ol className="parts" aria-label="Parts">
              {parts.map((p, i) => (
                <li key={p.id}>
                  <Link href={href(p.path)}>
                    <span className="n">Part {i + 1}</span>
                    <span className="t">{p.title}</span>
                    <span className="r">{p.readingMinutes ? `${p.readingMinutes} min` : ""}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p style={{ maxWidth: "48rem", margin: "2rem auto 0" }}>
              <Link className="btn btn--primary" href={href(parts[0].path)}>
                Start with part 1
              </Link>
            </p>
          </>
        )}

        {entry.kind !== "post" && entry.children.some((c) => c.kind !== "post" || entry.kind === "folder") && (
          <section className="nl-section" aria-labelledby="inside-title">
            <div className="nl-section__head">
              <h2 className="nl-section__title" id="inside-title">
                {entry.kind === "folder" ? "Inside" : "Also in this series"}
              </h2>
            </div>
            <ul className="grid-2">
              {entry.children
                .filter((c) => entry.kind === "folder" || c.kind !== "post")
                .map((c) => (
                  <li key={c.id}>
                    <Link className="card" href={href(c.path)}>
                      <Cover
                        url={c.coverUrl}
                        title={c.title}
                        tag={c.kind === "series" ? "Series" : c.kind === "folder" ? "Folder" : (c.topic ?? undefined)}
                      />
                      <span className="card__body">
                        <span className="card__title card__title--sans">{c.title}</span>
                        <span className="meta">
                          {c.excerpt ??
                            [formatDate(c.publishedAt), c.readingMinutes ? `${c.readingMinutes} min read` : ""]
                              .filter(Boolean)
                              .join(", ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
