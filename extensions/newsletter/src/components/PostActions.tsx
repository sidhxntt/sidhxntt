"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@nl-convex/_generated/api";
import type { Id } from "@nl-convex/_generated/dataModel";
import { convexConfigured } from "../lib/config";
import { useGoogleSignIn } from "./auth";

type Initial = { likeCount: number; commentCount: number; liked: boolean; saved: boolean };

export function PostActions({ postId, title, initial }: { postId: string; title: string; initial: Initial }) {
  return (
    <div className="actions">
      {convexConfigured ? <Like postId={postId as Id<"posts">} initial={initial} /> : null}
      {convexConfigured ? <Save postId={postId as Id<"posts">} initial={initial} /> : null}
      <a className="btn btn--small btn--ghost" href="#comments">
        {initial.commentCount === 1 ? "1 comment" : `${initial.commentCount} comments`}
      </a>
      <Share title={title} />
    </div>
  );
}

function Like({ postId, initial }: { postId: Id<"posts">; initial: Initial }) {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(api.posts.stats, { postId });
  const toggle = useMutation(api.likes.togglePost).withOptimisticUpdate((store) => {
    const current = store.getQuery(api.posts.stats, { postId });
    if (current) {
      store.setQuery(
        api.posts.stats,
        { postId },
        { ...current, liked: !current.liked, likeCount: current.likeCount + (current.liked ? -1 : 1) },
      );
    }
  });
  const signIn = useGoogleSignIn();
  const [pop, setPop] = useState(false);
  const stats = live ?? initial;

  return (
    <button
      type="button"
      className={`like ${pop ? "is-pop" : ""}`}
      aria-pressed={stats.liked}
      onAnimationEnd={() => setPop(false)}
      onClick={() => {
        if (!isAuthenticated) return void signIn();
        if (!stats.liked) setPop(true);
        void toggle({ postId });
      }}
      title={isAuthenticated ? undefined : "Sign in with Google to like this post"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />
      </svg>
      <span>{stats.liked ? "Liked" : "Like"}</span>
      <span aria-label={`${stats.likeCount} likes`}>{stats.likeCount}</span>
    </button>
  );
}

// Save for later; saved posts are listed on the reader's profile page.
function Save({ postId, initial }: { postId: Id<"posts">; initial: Initial }) {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(api.posts.stats, { postId });
  const toggle = useMutation(api.bookmarks.toggle).withOptimisticUpdate((store) => {
    const current = store.getQuery(api.posts.stats, { postId });
    if (current) store.setQuery(api.posts.stats, { postId }, { ...current, saved: !current.saved });
  });
  const signIn = useGoogleSignIn();
  const [pop, setPop] = useState(false);
  const saved = (live ?? initial).saved;

  return (
    <button
      type="button"
      className={`like save ${pop ? "is-pop" : ""}`}
      aria-pressed={saved}
      onAnimationEnd={() => setPop(false)}
      onClick={() => {
        if (!isAuthenticated) return void signIn();
        if (!saved) setPop(true);
        void toggle({ postId });
      }}
      title={isAuthenticated ? (saved ? "Saved to your profile" : "Save to read later") : "Sign in with Google to save this post"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1Z" />
      </svg>
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}

function Share({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--small btn--ghost"
      onClick={async () => {
        const url = window.location.href.split("#")[0];
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* cancelled: fall back to copying */
          }
        }
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
