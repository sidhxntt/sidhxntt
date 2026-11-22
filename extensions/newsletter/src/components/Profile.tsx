"use client";

import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type ReactNode } from "react";
import { api } from "@nl-convex/_generated/api";
import { BASE, convexConfigured, href } from "../lib/config";
import { formatDate, timeAgo } from "../lib/format";
import { SignInButton } from "./auth";
import { Avatar } from "./Avatar";
import { Cover } from "./Cover";
import { Skeleton, SkeletonRows } from "./Skeleton";

type Data = NonNullable<FunctionReturnType<typeof api.bookmarks.profile>>;
type Card = Data["liked"][number];
type Tab = "saved" | "liked" | "comments";

export function Profile() {
  if (!convexConfigured) {
    return (
      <div className="notice">
        <h1>Not connected yet</h1>
        <p>Profiles open once the newsletter is connected.</p>
      </div>
    );
  }
  return <Signed />;
}

function Signed() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const data = useQuery(api.bookmarks.profile, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && data === undefined)) {
    return (
      <div role="status" aria-label="Loading your profile">
        <div className="profile__head">
          <Skeleton width="72px" height="72px" radius="50%" />
          <div style={{ display: "grid", gap: "0.6rem", flex: 1 }}>
            <Skeleton width="16rem" height="2.4rem" radius="10px" />
            <Skeleton width="12rem" height="0.9rem" />
          </div>
        </div>
        <SkeletonRows rows={3} height="7.5rem" />
      </div>
    );
  }
  if (!isAuthenticated || !data) {
    return (
      <div className="notice">
        <h1>Your profile</h1>
        <p>Sign in with Google to see the posts you saved, the ones you liked and your comments.</p>
        <p>
          <SignInButton label="Sign in with Google" className="btn btn--primary" />
        </p>
      </div>
    );
  }
  return <Page data={data} />;
}

function Page({ data }: { data: Data }) {
  const [tab, setTab] = useState<Tab>("saved");
  const counts: Record<Tab, number> = { saved: data.saved.length, liked: data.liked.length, comments: data.comments.length };
  const label: Record<Tab, string> = { saved: "Saved", liked: "Liked", comments: "Comments" };
  return (
    <>
      <header className="profile__head">
        <Avatar name={data.name} image={data.image} size={72} />
        <div>
          <h1 className="profile__name">{data.name}</h1>
          <p className="meta">
            {data.email ? `${data.email}, ` : ""}reading since {formatDate(data.joinedAt)}
          </p>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Your activity">
        {(Object.keys(label) as Tab[]).map((id) => (
          <button
            key={id}
            id={`ptab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="profile-panel"
            onClick={() => setTab(id)}
          >
            {label[id]}
            <span className="tabs__count">{counts[id]}</span>
          </button>
        ))}
      </div>

      <div id="profile-panel" role="tabpanel" aria-labelledby={`ptab-${tab}`}>
        {tab === "saved" && <Saved cards={data.saved} />}
        {tab === "liked" &&
          (data.liked.length ? (
            <CardList cards={data.liked} />
          ) : (
            <Empty title="No likes yet" text="Like a post and it shows up here." />
          ))}
        {tab === "comments" && <Comments comments={data.comments} />}
      </div>
    </>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
      <p>
        <Link className="btn" href={BASE}>
          Browse the newsletter
        </Link>
      </p>
    </div>
  );
}

function meta(card: Card) {
  return [formatDate(card.publishedAt), card.readingMinutes ? `${card.readingMinutes} min read` : ""]
    .filter(Boolean)
    .join(", ");
}

function CardList({ cards, action }: { cards: Card[]; action?: (card: Card) => ReactNode }) {
  return (
    <ul className="profile-list">
      {cards.map((c) => (
        <li key={c.id} className="profile-item">
          <Link className="row" href={href(c.path)}>
            <Cover url={c.coverUrl} title={c.title} />
            <span className="row__text">
              {(c.topic || c.kind === "series") && (
                <span className="meta">{c.kind === "series" ? "Series" : c.topic}</span>
              )}
              <span className="row__title">{c.title}</span>
              <span className="meta">{meta(c)}</span>
            </span>
          </Link>
          {action?.(c)}
        </li>
      ))}
    </ul>
  );
}

function Saved({ cards }: { cards: Data["saved"] }) {
  const toggle = useMutation(api.bookmarks.toggle).withOptimisticUpdate((store, { postId }) => {
    const page = store.getQuery(api.bookmarks.profile, {});
    if (page) store.setQuery(api.bookmarks.profile, {}, { ...page, saved: page.saved.filter((c) => c.id !== postId) });
  });
  if (cards.length === 0) {
    return <Empty title="Nothing saved yet" text="Use Save on any post to keep it here for later." />;
  }
  return (
    <CardList
      cards={cards}
      action={(c) => (
        <button
          type="button"
          className="btn btn--small btn--ghost profile-item__action"
          aria-label={`Remove ${c.title} from saved`}
          onClick={() => void toggle({ postId: c.id })}
        >
          Remove
        </button>
      )}
    />
  );
}

function Comments({ comments }: { comments: Data["comments"] }) {
  if (comments.length === 0) {
    return <Empty title="No comments yet" text="Join a discussion under any post." />;
  }
  return (
    <ul className="mod-list">
      {comments.map((c) => (
        <li key={c.id} className="mod">
          <p className="meta">
            On <Link href={`${href(c.post.path)}#comments`}>{c.post.title}</Link>, {timeAgo(c.createdAt)}
          </p>
          <p>{c.body}</p>
          {(c.likeCount > 0 || c.replyCount > 0) && (
            <p className="meta">
              {[
                c.likeCount ? `${c.likeCount} ${c.likeCount === 1 ? "like" : "likes"}` : "",
                c.replyCount ? `${c.replyCount} ${c.replyCount === 1 ? "reply" : "replies"}` : "",
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
