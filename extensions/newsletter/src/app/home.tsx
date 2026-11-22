import Link from "next/link";
import { api } from "@nl-convex/_generated/api";
import type { PostCard } from "@nl-convex/posts";
import { SocialIcon } from "@/components/landing/SocialIcon";
import { Cover } from "../components/Cover";
import { Footer, Header } from "../components/Header";
import { SubscribeForm } from "../components/SubscribeForm";
import { BASE, href } from "../lib/config";
import { formatDate } from "../lib/format";
import { load } from "../lib/server";

// /newsletter — the magazine-style home page (design option D): hero with
// the subscribe form, the newest series featured with its parts, single
// posts, an about card and topics.

const LINKS = [
  { label: "Medium", url: "https://medium.com/@sidhxntt" },
  { label: "GitHub", url: "https://github.com/sidhxntt" },
  { label: "LinkedIn", url: "https://www.linkedin.com/in/sidhxntt" },
  { label: "X", url: "https://x.com/sidhxntt" },
];

const newest = (a: PostCard, b: PostCard) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0);

function meta(card: PostCard) {
  return [formatDate(card.publishedAt), card.readingMinutes ? `${card.readingMinutes} min read` : ""]
    .filter(Boolean)
    .join(", ");
}

export default async function NewsletterHome() {
  const res = await load(api.posts.published, {});
  const cards = res.ok ? res.data : [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const childrenOf = (id: string) => cards.filter((c) => c.parentId === id);

  const series = cards.filter((c) => c.kind === "series").sort(newest);
  const featured = series[0] ?? null;
  const parts = featured ? childrenOf(featured.id).filter((c) => c.kind === "post") : [];
  const [first, ...rest] = parts;

  // posts that stand alone: not a part of any series
  const singles = cards
    .filter((c) => c.kind === "post" && !(c.parentId && byId.get(c.parentId)?.kind === "series"))
    .sort(newest);
  const [big1, big2, ...small] = singles;
  const otherSeries = series.slice(1);

  const topicCounts = new Map<string, number>();
  for (const c of cards) {
    if (c.topic && c.kind !== "folder") topicCounts.set(c.topic, (topicCounts.get(c.topic) ?? 0) + 1);
  }
  const topics = [...topicCounts].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Header current="home" />
      <main id="main" className="wrap">
        <section id="subscribe" className="nl-hero" aria-labelledby="nl-title">
          <div>
            <p className="nl-hero__kicker">Siddhant&rsquo;s newsletter</p>
            <h1 className="nl-hero__title" id="nl-title">
              How software gets built, in writing
            </h1>
          </div>
          <div className="nl-hero__side">
            <p className="nl-hero__lede">
              Series on software architecture, plus single posts on deployment, data and AI. New posts arrive by
              email.
            </p>
            <SubscribeForm id="hero-email" />
          </div>
        </section>

        {!res.ok && (
          <div className="empty">
            <h2>{res.reason === "not-configured" ? "Not connected yet" : "Couldn't load posts"}</h2>
            <p>
              {res.reason === "not-configured"
                ? "The newsletter's backend isn't set up on this site yet."
                : "The posts didn't load. Refresh in a moment."}
            </p>
          </div>
        )}
        {res.ok && cards.length === 0 && (
          <div className="empty">
            <h2>The first post is on its way</h2>
            <p>Subscribe above and it'll land in your inbox.</p>
          </div>
        )}

        {featured && (
          <Link className="featured" href={href(featured.path)} aria-labelledby="featured-title">
            <Cover url={featured.coverUrl} title={featured.title} eager />
            <span className="tag" style={{ top: "1.5rem", left: "1.5rem" }}>
              {parts.length === 1 ? "Series of 1 part" : `Series of ${parts.length} parts`}
            </span>
            <span className="featured__text">
              <span className="featured__title" id="featured-title">
                {featured.title}
              </span>
              {featured.excerpt && <span className="featured__desc">{featured.excerpt}</span>}
            </span>
          </Link>
        )}

        {featured && first && (
          <section className="nl-section" id="series" aria-labelledby="series-title">
            <div className="nl-section__head">
              <h2 className="nl-section__title" id="series-title">
                Start the series
              </h2>
              <Link className="text-link" href={href(featured.path)}>
                All of {featured.title}
              </Link>
            </div>
            <div className="start">
              <Link className="card" href={href(first.path)}>
                <Cover url={first.coverUrl} title={first.title} tag="Part 1" />
                <span className="card__body">
                  <span className="card__kicker">{featured.title}</span>
                  <span className="card__title">{first.title}</span>
                  {first.readingMinutes && <span className="meta">{first.readingMinutes} min read</span>}
                </span>
              </Link>
              {rest.length > 0 && (
                <ol className="rows" start={2} aria-label={`More parts of ${featured.title}`}>
                  {rest.map((p, i) => (
                    <li key={p.id} style={{ flex: 1 }}>
                      <Link className="row" href={href(p.path)} style={{ height: "100%" }}>
                        <Cover url={p.coverUrl} title={p.title} />
                        <span className="row__text">
                          <span className="row__kicker">Part {i + 2}</span>
                          <span className="row__title">{p.title}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        {otherSeries.length > 0 && (
          <section className="nl-section" aria-labelledby="more-series-title">
            <div className="nl-section__head">
              <h2 className="nl-section__title" id="more-series-title">
                More series
              </h2>
            </div>
            <ul className="grid-2">
              {otherSeries.map((s) => (
                <li key={s.id}>
                  <Link className="card" href={href(s.path)}>
                    <Cover url={s.coverUrl} title={s.title} tag="Series" />
                    <span className="card__body">
                      <span className="card__title">{s.title}</span>
                      {s.excerpt && <span className="meta">{s.excerpt}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {big1 && (
          <section className="nl-section" id="posts" aria-labelledby="posts-title">
            <div className="nl-section__head">
              <h2 className="nl-section__title" id="posts-title">
                Single posts
              </h2>
            </div>
            <ul className="grid-2">
              {[big1, big2].filter(Boolean).map((p) => (
                <li key={p!.id}>
                  <Link className="card" href={href(p!.path)}>
                    <Cover url={p!.coverUrl} title={p!.title} tag={p!.topic ?? undefined} />
                    <span className="card__body">
                      <span className="card__title card__title--sans">{p!.title}</span>
                      <span className="meta">{meta(p!)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {small.length > 0 && (
              <ul className="grid-rows">
                {small.map((p) => (
                  <li key={p.id}>
                    <Link className="row" href={href(p.path)}>
                      <Cover url={p.coverUrl} title={p.title} />
                      <span className="row__text">
                        {p.topic && <span className="meta">{p.topic}</span>}
                        <span className="row__title">{p.title}</span>
                        <span className="meta">{meta(p)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="about" id="about" aria-labelledby="about-title">
          <div className="about__lead">
            <h2 id="about-title" className="meta">
              About the writer
            </h2>
            <p className="about__quote">
              I&rsquo;m Siddhant Gupta, a backend engineer in Bengaluru who builds data platforms and developer tools.
            </p>
            <a className="text-link" href="/">
              See my work
            </a>
          </div>
          <div style={{ display: "grid", gap: "0.5rem", alignContent: "start" }}>
            <p className="meta">Also on</p>
            <ul className="chips">
              {LINKS.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    <SocialIcon label={l.label} />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {topics.length > 0 && (
          <section className="nl-section" id="topics" aria-labelledby="topics-title">
            <div className="nl-section__head">
              <h2 className="nl-section__title" id="topics-title">
                Explore topics
              </h2>
            </div>
            <ul className="topics">
              {topics.map(([name, count]) => (
                <li key={name}>
                  <Link className="topic" href={`${BASE}/topic/${encodeURIComponent(name)}`}>
                    <span>
                      <span className="topic__name">{name}</span>
                      <span className="topic__count">{count === 1 ? "1 piece" : `${count} pieces`}</span>
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
