import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { vKind, vStatus } from "./schema";
import {
  RESERVED_ROOT_SLUGS,
  currentUser,
  isAdminUser,
  publishedPath,
  readingMinutes,
  requireAdmin,
  slugify,
} from "./lib";

/* ─────────────────────────────── reading ──────────────────────────────── */

// What a card or list row needs; never the full content.
export type PostCard = {
  id: Id<"posts">;
  parentId: Id<"posts"> | null;
  kind: Doc<"posts">["kind"];
  title: string;
  slug: string;
  path: string[];
  order: number;
  topic: string | null;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: number | null;
  readingMinutes: number | null;
  likeCount: number;
  commentCount: number;
};

export async function allPosts(ctx: QueryCtx) {
  const posts = await ctx.db.query("posts").collect();
  return { posts, byId: new Map(posts.map((p) => [p._id, p])) };
}

export async function toCard(ctx: QueryCtx, post: Doc<"posts">, path: string[]): Promise<PostCard> {
  return {
    id: post._id,
    parentId: post.parentId ?? null,
    kind: post.kind,
    title: post.title,
    slug: post.slug,
    path,
    order: post.order,
    topic: post.topic ?? null,
    excerpt: post.excerpt ?? null,
    coverUrl: post.coverImageId ? await ctx.storage.getUrl(post.coverImageId) : null,
    publishedAt: post.publishedAt ?? null,
    readingMinutes: post.readingMinutes ?? null,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
  };
}

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

async function isSaved(ctx: QueryCtx, userId: Id<"users">, postId: Id<"posts">) {
  const row = await ctx.db
    .query("bookmarks")
    .withIndex("by_user_and_post", (q) => q.eq("userId", userId).eq("postId", postId))
    .unique();
  return row !== null;
}

// Every entry readers can reach, as cards. The home page builds its sections
// (series with their parts, single posts, topics) from this.
export const published = query({
  args: {},
  handler: async (ctx) => {
    const { posts, byId } = await allPosts(ctx);
    const cards: PostCard[] = [];
    for (const post of posts) {
      const path = publishedPath(post, byId);
      if (path) cards.push(await toCard(ctx, post, path));
    }
    return cards.sort(byOrder);
  },
});

// One entry by its slug path (/newsletter/blogs/software-architectures/…),
// with what its page shows around it.
export const byPath = query({
  args: { path: v.array(v.string()) },
  handler: async (ctx, { path }) => {
    if (path.length === 0) return null;
    let parentId: Id<"posts"> | undefined = undefined;
    let post: Doc<"posts"> | null = null;
    const ancestors: Doc<"posts">[] = [];
    for (const slug of path) {
      post = await ctx.db
        .query("posts")
        .withIndex("by_parent_slug", (q) => q.eq("parentId", parentId).eq("slug", slug))
        .unique();
      if (!post || post.status !== "published") return null;
      ancestors.push(post);
      parentId = post._id;
    }
    if (!post) return null;
    ancestors.pop();

    const viewer = await currentUser(ctx);
    const children = await ctx.db
      .query("posts")
      .withIndex("by_parent_order", (q) => q.eq("parentId", post!._id))
      .collect();
    const childCards = await Promise.all(
      children
        .filter((c) => c.status === "published")
        .map((c) => toCard(ctx, c, [...path, c.slug])),
    );

    // The parts of the series this post belongs to, for "Part 2 of 5" and
    // previous / next links.
    const parent = ancestors[ancestors.length - 1];
    let series: null | {
      title: string;
      path: string[];
      index: number;
      parts: { title: string; path: string[] }[];
    } = null;
    if (parent && parent.kind === "series") {
      const siblings = (
        await ctx.db
          .query("posts")
          .withIndex("by_parent_order", (q) => q.eq("parentId", parent._id))
          .collect()
      ).filter((s) => s.status === "published");
      const parentPath = path.slice(0, -1);
      series = {
        title: parent.title,
        path: parentPath,
        index: siblings.findIndex((s) => s._id === post!._id),
        parts: siblings.map((s) => ({ title: s.title, path: [...parentPath, s.slug] })),
      };
    }

    let liked = false;
    let saved = false;
    if (viewer) {
      const like = await ctx.db
        .query("likes")
        .withIndex("by_user_post_comment", (q) =>
          q.eq("userId", viewer._id).eq("postId", post!._id).eq("commentId", undefined),
        )
        .first();
      liked = like !== null;
      saved = await isSaved(ctx, viewer._id, post._id);
    }

    return {
      ...(await toCard(ctx, post, path)),
      contentHtml: post.contentHtml ?? "",
      updatedAt: post.updatedAt,
      ancestors: ancestors.map((a, i) => ({ title: a.title, kind: a.kind, path: path.slice(0, i + 1) })),
      children: childCards.sort(byOrder),
      series,
      liked,
      saved,
    };
  },
});

// Live counts for a post page (the page itself is cached for a minute).
export const stats = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const post = await ctx.db.get(postId);
    if (!post || post.status !== "published") return null;
    const viewer = await currentUser(ctx);
    const like = viewer
      ? await ctx.db
          .query("likes")
          .withIndex("by_user_post_comment", (q) =>
            q.eq("userId", viewer._id).eq("postId", postId).eq("commentId", undefined),
          )
          .first()
      : null;
    return {
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      liked: like !== null,
      saved: viewer ? await isSaved(ctx, viewer._id, postId) : false,
    };
  },
});

/* ─────────────────────────────── writing ──────────────────────────────── */

// Everything, drafts included, for the admin's tree.
export const adminTree = query({
  args: {},
  handler: async (ctx) => {
    if (!isAdminUser(await currentUser(ctx))) return null;
    const posts = await ctx.db.query("posts").collect();
    return posts
      .map((p) => ({
        id: p._id,
        parentId: p.parentId ?? null,
        kind: p.kind,
        title: p.title,
        slug: p.slug,
        order: p.order,
        status: p.status,
        topic: p.topic ?? null,
        publishedAt: p.publishedAt ?? null,
        updatedAt: p.updatedAt,
        emailedAt: p.emailedAt ?? null,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        viewCount: p.viewCount ?? 0,
        readCount: p.readCount ?? 0,
      }))
      .sort(byOrder);
  },
});

export const adminGet = query({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    if (!isAdminUser(await currentUser(ctx))) return null;
    const post = await ctx.db.get(id);
    if (!post) return null;
    return {
      ...post,
      coverUrl: post.coverImageId ? await ctx.storage.getUrl(post.coverImageId) : null,
    };
  },
});

export const topics = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query("posts").collect();
    return [...new Set(posts.map((p) => p.topic).filter((t): t is string => !!t))].sort();
  },
});

async function assertValidParent(ctx: QueryCtx, id: Id<"posts"> | null, parentId: Id<"posts"> | undefined) {
  if (!parentId) return;
  const parent = await ctx.db.get(parentId);
  if (!parent) throw new ConvexError("That parent no longer exists.");
  if (parent.kind === "post") throw new ConvexError("Only a series or a folder can hold other entries.");
  // no entry may end up inside itself
  let node: Doc<"posts"> | null = parent;
  while (node) {
    if (id && node._id === id) throw new ConvexError("An entry can't be moved inside itself.");
    node = node.parentId ? await ctx.db.get(node.parentId) : null;
  }
}

async function uniqueSlug(ctx: QueryCtx, wanted: string, parentId: Id<"posts"> | undefined, id: Id<"posts"> | null) {
  const base = slugify(wanted);
  let slug = base;
  for (let n = 2; ; n++) {
    const clash = await ctx.db
      .query("posts")
      .withIndex("by_parent_slug", (q) => q.eq("parentId", parentId).eq("slug", slug))
      .first();
    const reserved = !parentId && RESERVED_ROOT_SLUGS.has(slug);
    if ((!clash || clash._id === id) && !reserved) return slug;
    slug = `${base}-${n}`;
  }
}

async function nextOrder(ctx: QueryCtx, parentId: Id<"posts"> | undefined) {
  const last = await ctx.db
    .query("posts")
    .withIndex("by_parent_order", (q) => q.eq("parentId", parentId))
    .order("desc")
    .first();
  return last ? last.order + 1 : 0;
}

const MAX_HTML = 600_000; // Convex documents are capped at 1 MB

export type SaveArgs = {
  id?: Id<"posts">;
  kind: Doc<"posts">["kind"];
  title: string;
  slug?: string;
  parentId?: Id<"posts">;
  topic?: string;
  excerpt?: string;
  coverImageId?: Id<"_storage">;
  contentJson?: string;
  contentHtml?: string;
  status: Doc<"posts">["status"];
};

export const save = mutation({
  args: {
    id: v.optional(v.id("posts")),
    kind: vKind,
    title: v.string(),
    slug: v.optional(v.string()),
    parentId: v.optional(v.id("posts")),
    topic: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    contentJson: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    status: vStatus,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await savePost(ctx, args);
  },
});

// Creating or updating an entry, shared by the admin editor and the agent
// endpoints (which check their own key instead of a signed-in admin).
export async function savePost(ctx: MutationCtx, args: SaveArgs): Promise<{ id: Id<"posts">; slug: string }> {
  const title = args.title.trim();
  if (!title) throw new ConvexError("Give it a title.");
  if ((args.contentHtml?.length ?? 0) > MAX_HTML || (args.contentJson?.length ?? 0) > MAX_HTML) {
    throw new ConvexError("This post is too large to save. Images pasted as data are the usual cause.");
  }
  const existing = args.id ? await ctx.db.get(args.id) : null;
  if (args.id && !existing) throw new ConvexError("That entry no longer exists.");
  if (existing && existing.kind !== "post" && args.kind === "post") {
    const child = await ctx.db
      .query("posts")
      .withIndex("by_parent_order", (q) => q.eq("parentId", existing._id))
      .first();
    if (child) throw new ConvexError("Move or delete what's inside it before making it a single post.");
  }
  await assertValidParent(ctx, existing?._id ?? null, args.parentId);

  const slug = await uniqueSlug(ctx, args.slug?.trim() || title, args.parentId, existing?._id ?? null);
  const now = Date.now();
  const fields = {
    kind: args.kind,
    title,
    slug,
    parentId: args.parentId,
    topic: args.topic?.trim() || undefined,
    excerpt: args.excerpt?.trim() || undefined,
    coverImageId: args.coverImageId,
    contentJson: args.contentJson,
    contentHtml: args.contentHtml,
    readingMinutes: args.kind === "post" ? readingMinutes(args.contentHtml) : undefined,
    status: args.status,
    updatedAt: now,
    publishedAt:
      args.status === "published" ? (existing?.publishedAt ?? now) : existing?.publishedAt,
  };

  if (existing) {
    const moved = existing.parentId !== args.parentId;
    if (existing.coverImageId && existing.coverImageId !== args.coverImageId) {
      await deleteImageIfUnused(ctx, existing.coverImageId, existing._id, args.contentHtml);
    }
    await ctx.db.patch(existing._id, {
      ...fields,
      order: moved ? await nextOrder(ctx, args.parentId) : existing.order,
    });
    return { id: existing._id, slug };
  }
  const id = await ctx.db.insert("posts", {
    ...fields,
    order: await nextOrder(ctx, args.parentId),
    likeCount: 0,
    commentCount: 0,
  });
  return { id, slug };
}

// Swap with the neighbour above or below, among siblings.
export const move = mutation({
  args: { id: v.id("posts"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { id, direction }) => {
    await requireAdmin(ctx);
    await movePost(ctx, id, direction);
  },
});

export async function movePost(ctx: MutationCtx, id: Id<"posts">, direction: "up" | "down") {
  const post = await ctx.db.get(id);
  if (!post) return;
  const siblings = await ctx.db
    .query("posts")
    .withIndex("by_parent_order", (q) => q.eq("parentId", post.parentId))
    .collect();
  const i = siblings.findIndex((s) => s._id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;
  // renumber so equal orders can't stick
  const reordered = [...siblings];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  await Promise.all(reordered.map((s, n) => (s.order === n ? null : ctx.db.patch(s._id, { order: n }))));
}

export const remove = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await removePost(ctx, id);
  },
});

export async function removePost(ctx: MutationCtx, id: Id<"posts">) {
  const post = await ctx.db.get(id);
  if (!post) return;
  const child = await ctx.db
    .query("posts")
    .withIndex("by_parent_order", (q) => q.eq("parentId", id))
    .first();
  if (child) throw new ConvexError("Move or delete what's inside it first.");
  for (const c of await ctx.db.query("comments").withIndex("by_post", (q) => q.eq("postId", id)).collect()) {
    await ctx.db.delete(c._id);
  }
  for (const l of await ctx.db.query("likes").withIndex("by_post", (q) => q.eq("postId", id)).collect()) {
    await ctx.db.delete(l._id);
  }
  for (const b of await ctx.db.query("bookmarks").withIndex("by_post", (q) => q.eq("postId", id)).collect()) {
    await ctx.db.delete(b._id);
  }
  if (post.coverImageId) await deleteImageIfUnused(ctx, post.coverImageId, id);
  await ctx.db.delete(id);
}

// The writing agent uploads an image once and reuses it, so one stored file
// can be several posts' cover or sit in their text. Only delete it when
// nothing else (other posts, or `ownHtml`, the post's new text) still uses it.
async function deleteImageIfUnused(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  postId: Id<"posts">,
  ownHtml?: string,
) {
  const url = await ctx.storage.getUrl(storageId);
  if (!url || ownHtml?.includes(url)) return; // already gone, or still in this post's text
  for (const p of await ctx.db.query("posts").collect()) {
    if (p._id === postId) continue;
    if (p.coverImageId === storageId || p.contentHtml?.includes(url)) return;
  }
  await ctx.storage.delete(storageId);
}

// For the email action.
export const forEmail = internalQuery({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    const { byId } = await allPosts(ctx);
    const post = byId.get(id);
    if (!post) return null;
    const path = publishedPath(post, byId);
    if (!path) return null;
    const parent = post.parentId ? byId.get(post.parentId) : undefined;
    return {
      title: post.title,
      excerpt: post.excerpt ?? null,
      path,
      coverUrl: post.coverImageId ? await ctx.storage.getUrl(post.coverImageId) : null,
      readingMinutes: post.readingMinutes ?? null,
      seriesTitle: parent?.kind === "series" ? parent.title : null,
      emailedAt: post.emailedAt ?? null,
    };
  },
});
