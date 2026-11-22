"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { SkeletonRows } from "./Skeleton";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "@nl-convex/_generated/api";
import type { Id } from "@nl-convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { convexConfigured } from "../lib/config";
import { timeAgo } from "../lib/format";
import { SignInButton } from "./auth";
import { Avatar } from "./Avatar";
import { errorMessage } from "./errors";

// Reddit-style discussion: replies nest to any depth, the rail beside a
// comment collapses its whole branch, and threads sort by top, new or old.

type Data = FunctionReturnType<typeof api.comments.forPost>;
type Row = Data["comments"][number];
type Node = Row & { children: Node[] };
type Sort = "top" | "new" | "old";

const MAX_BODY = 5000;
// replies deeper than this stop indenting (they still nest and collapse)
const MAX_INDENT = 6;

export function Comments({ postId }: { postId: string }) {
  return (
    <section id="comments" aria-labelledby="comments-title">
      {convexConfigured ? (
        <Discussion postId={postId as Id<"posts">} />
      ) : (
        <h2 className="comments__title" id="comments-title">
          Comments
        </h2>
      )}
    </section>
  );
}

function sortNodes(nodes: Node[], sort: Sort) {
  const by: Record<Sort, (a: Node, b: Node) => number> = {
    top: (a, b) => b.likeCount - a.likeCount || b.replyCount - a.replyCount || b.createdAt - a.createdAt,
    new: (a, b) => b.createdAt - a.createdAt,
    old: (a, b) => a.createdAt - b.createdAt,
  };
  nodes.sort(by[sort]);
  for (const n of nodes) sortNodes(n.children, sort);
  return nodes;
}

function Discussion({ postId }: { postId: Id<"posts"> }) {
  const data = useQuery(api.comments.forPost, { postId });
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [sort, setSort] = useState<Sort>("top");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const add = useMutation(api.comments.add);
  const edit = useMutation(api.comments.edit);
  const remove = useMutation(api.comments.remove);
  const like = useMutation(api.likes.toggleComment).withOptimisticUpdate((store, { commentId }) => {
    const current = store.getQuery(api.comments.forPost, { postId });
    if (!current) return;
    store.setQuery(
      api.comments.forPost,
      { postId },
      {
        ...current,
        comments: current.comments.map((c) =>
          c.id === commentId ? { ...c, liked: !c.liked, likeCount: c.likeCount + (c.liked ? -1 : 1) } : c,
        ),
      },
    );
  });

  const tree = useMemo(() => {
    if (!data) return [];
    const byId = new Map<string, Node>(data.comments.map((c) => [c.id, { ...c, children: [] }]));
    const roots: Node[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return sortNodes(roots, sort);
  }, [data, sort]);

  const live = data?.comments.filter((c) => !c.deleted).length ?? 0;
  const viewer = data?.viewer ?? null;

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ctx: ThreadCtx = {
    viewer,
    signedIn: isAuthenticated,
    collapsed,
    toggleCollapsed,
    replyTo,
    setReplyTo,
    editing,
    setEditing,
    reply: (parentId, body) => add({ postId, parentId: parentId as Id<"comments">, body }),
    save: (id, body) => edit({ id: id as Id<"comments">, body }),
    remove: (id) => remove({ id: id as Id<"comments"> }),
    like: (id) => like({ commentId: id as Id<"comments"> }),
  };

  return (
    <>
      <div className="comments__head">
        <h2 className="comments__title" id="comments-title">
          {data ? (live === 1 ? "1 comment" : `${live} comments`) : "Comments"}
        </h2>
        {data && data.comments.length > 1 && (
          <div className="sort" role="group" aria-label="Sort comments">
            {(["top", "new", "old"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>
                {s === "top" ? "Top" : s === "new" ? "Newest" : "Oldest"}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? null : isAuthenticated ? (
        <Composer
          label="Add a comment"
          placeholder="What do you think?"
          submitLabel="Comment"
          onSubmit={(body) => add({ postId, body })}
        />
      ) : (
        <div className="signin-prompt">
          <span>Sign in with Google to like comments and join the discussion.</span>
          <SignInButton label="Sign in with Google" className="btn btn--small" />
        </div>
      )}

      {data === undefined ? (
        <div style={{ marginTop: "1.5rem" }}>
          <SkeletonRows rows={2} height="5rem" />
        </div>
      ) : tree.length === 0 ? (
        <p className="meta" style={{ marginTop: "1.5rem" }}>
          No comments yet. Start the discussion.
        </p>
      ) : (
        <div className="thread">
          {tree.map((n) => (
            <Comment key={n.id} node={n} ctx={ctx} />
          ))}
        </div>
      )}
    </>
  );
}

type ThreadCtx = {
  viewer: Data["viewer"];
  signedIn: boolean;
  collapsed: Set<string>;
  toggleCollapsed: (id: string) => void;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  editing: string | null;
  setEditing: (id: string | null) => void;
  reply: (parentId: string, body: string) => Promise<unknown>;
  save: (id: string, body: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  like: (id: string) => Promise<unknown>;
};

function countAll(node: Node): number {
  return node.children.reduce((n, c) => n + 1 + countAll(c), 0);
}

function Comment({ node, ctx }: { node: Node; ctx: ThreadCtx }) {
  const isCollapsed = ctx.collapsed.has(node.id);
  const flat = node.depth >= MAX_INDENT;
  const name = node.author?.name ?? (node.deleted === "moderator" ? "Removed" : "Deleted");
  const hidden = countAll(node);
  const canModerate = !!ctx.viewer?.isAdmin && !node.mine;

  return (
    <article
      className={`c ${flat ? "c--flat" : ""} ${isCollapsed ? "c--collapsed" : ""}`}
      aria-label={`Comment by ${name}`}
    >
      <span className="c__avatar">
        <Avatar name={name} image={node.author?.image ?? null} size={28} />
      </span>
      {!flat && (
        <button
          type="button"
          className="c__rail"
          aria-label={isCollapsed ? `Expand ${name}'s thread` : `Collapse ${name}'s thread`}
          aria-expanded={!isCollapsed}
          onClick={() => ctx.toggleCollapsed(node.id)}
        />
      )}

      <div className="c__main">
        <div className="c__meta">
          <span className="c__name">{node.author ? node.author.name : "[deleted]"}</span>
          {node.author?.isAuthor && <span className="c__badge">Author</span>}
          <time dateTime={new Date(node.createdAt).toISOString()}>{timeAgo(node.createdAt)}</time>
          {node.editedAt && <span>edited</span>}
          {isCollapsed && (
            <button type="button" className="c__expand" onClick={() => ctx.toggleCollapsed(node.id)}>
              {hidden > 0 ? `Show ${hidden} more ${hidden === 1 ? "reply" : "replies"}` : "Show"}
            </button>
          )}
        </div>

        {ctx.editing === node.id ? (
          <Composer
            label="Edit your comment"
            initial={node.body ?? ""}
            submitLabel="Save"
            autoFocus
            onCancel={() => ctx.setEditing(null)}
            onSubmit={async (body) => {
              await ctx.save(node.id, body);
              ctx.setEditing(null);
            }}
          />
        ) : (
          <p className={`c__body ${node.deleted ? "c__body--deleted" : ""}`}>
            {node.deleted === "moderator"
              ? "Removed by Siddhant."
              : node.deleted
                ? "Deleted by the person who wrote it."
                : node.body}
          </p>
        )}

        {!node.deleted && ctx.editing !== node.id && (
          <div className="c__tools">
            <button
              type="button"
              aria-pressed={node.liked}
              disabled={!ctx.signedIn}
              title={ctx.signedIn ? undefined : "Sign in to like comments"}
              onClick={() => void ctx.like(node.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />
              </svg>
              <span className="sr-only">Like</span>
              {node.likeCount}
            </button>
            {ctx.signedIn && (
              <button type="button" onClick={() => ctx.setReplyTo(ctx.replyTo === node.id ? null : node.id)}>
                Reply
              </button>
            )}
            {node.mine && (
              <button type="button" onClick={() => ctx.setEditing(node.id)}>
                Edit
              </button>
            )}
            {(node.mine || canModerate) && (
              <DeleteButton label={node.mine ? "Delete" : "Remove"} onConfirm={() => ctx.remove(node.id)} />
            )}
          </div>
        )}

        {ctx.replyTo === node.id && (
          <Composer
            label={`Reply to ${name}`}
            placeholder={`Reply to ${name}`}
            submitLabel="Reply"
            autoFocus
            onCancel={() => ctx.setReplyTo(null)}
            onSubmit={async (body) => {
              await ctx.reply(node.id, body);
              ctx.setReplyTo(null);
            }}
          />
        )}
      </div>

      {node.children.length > 0 && (
        <div className="c__children">
          {node.children.map((child) => (
            <Comment key={child.id} node={child} ctx={ctx} />
          ))}
        </div>
      )}
    </article>
  );
}

function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => Promise<unknown> }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <>
      <button type="button" onClick={() => void onConfirm()}>
        Yes, {label.toLowerCase()} it
      </button>
      <button type="button" onClick={() => setAsking(false)}>
        Keep it
      </button>
    </>
  );
}

function Composer({
  label,
  placeholder,
  initial = "",
  submitLabel,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder?: string;
  initial?: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<unknown>;
  onCancel?: () => void;
}): ReactNode {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLong = body.length > MAX_BODY;

  const submit = async () => {
    if (!body.trim() || tooLong || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body);
      setBody("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        aria-label={label}
        value={body}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="composer__row">
        <span className={tooLong ? "error-text" : undefined}>
          {error ?? (tooLong ? `${body.length} / ${MAX_BODY}` : "Cmd or Ctrl + Enter to post")}
        </span>
        <span className="composer__buttons">
          {onCancel && (
            <button type="button" className="btn btn--small btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn--small btn--primary" disabled={busy || !body.trim() || tooLong}>
            {busy ? "Posting…" : submitLabel}
          </button>
        </span>
      </div>
    </form>
  );
}
