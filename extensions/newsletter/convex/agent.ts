import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { computeInsights } from "./analytics";
import { publishedPath, slugify } from "./lib";
import { allPosts, movePost, removePost, savePost } from "./posts";
import { vKind } from "./schema";

// What the writing agent (the MCP server and CLI in ../agent) can do. These
// are internal: the only way in is http.ts's /agent/* routes, which check
// NEWSLETTER_AGENT_KEY first. Posts only; no comments, readers or emails to
// subscribers.
//
// The agent only ever writes drafts: everything it creates is a draft, and
// it can't publish, unpublish, or change, move or delete anything published.
// The author reviews drafts and publishes them in the admin, and edits live
// posts there (adding images, say), so an agent push can't overwrite them.

function draftOnly(post: Doc<"posts">, path: string) {
  if (post.status === "published") {
    throw new ConvexError(
      `${path} is published, so the agent can't change it. Edit it in the admin, or unpublish it there first.`,
    );
  }
}

type ById = Map<Id<"posts">, Doc<"posts">>;

// Slugs from the top, whether or not anything on the way is published
function pathOf(post: Doc<"posts">, byId: ById): string[] {
  const path = [post.slug];
  let parentId = post.parentId;
  for (let hops = 0; parentId && hops < 32; hops++) {
    const parent = byId.get(parentId);
    if (!parent) break;
    path.unshift(parent.slug);
    parentId = parent.parentId;
  }
  return path;
}

async function describe(ctx: QueryCtx, post: Doc<"posts">, byId: ById) {
  const path = pathOf(post, byId);
  return {
    id: post._id,
    kind: post.kind,
    title: post.title,
    slug: post.slug,
    path: path.join("/"),
    parent: path.length > 1 ? path.slice(0, -1).join("/") : null,
    status: post.status,
    // published and everything above it too, so readers can reach it
    live: publishedPath(post, byId) !== null,
    order: post.order,
    topic: post.topic ?? null,
    summary: post.excerpt ?? null,
    coverUrl: post.coverImageId ? await ctx.storage.getUrl(post.coverImageId) : null,
    readingMinutes: post.readingMinutes ?? null,
    publishedAt: post.publishedAt ?? null,
    updatedAt: post.updatedAt,
    emailedAt: post.emailedAt ?? null,
    likes: post.likeCount,
    comments: post.commentCount,
    views: post.viewCount ?? 0,
    reads: post.readCount ?? 0,
  };
}

async function find(ctx: QueryCtx, ref: { id?: string; path?: string }) {
  const { byId } = await allPosts(ctx);
  if (ref.id) {
    const id = ctx.db.normalizeId("posts", ref.id);
    const post = id ? byId.get(id) : undefined;
    if (!post) throw new ConvexError(`No entry with id ${ref.id}.`);
    return { post, byId };
  }
  if (ref.path !== undefined) {
    const id = resolvePath(ref.path, byId);
    if (!id) throw new ConvexError(`Nothing at ${cleanPath(ref.path) || "the top level"}.`);
    return { post: byId.get(id)!, byId };
  }
  throw new ConvexError("Give an id or a path.");
}

function cleanPath(path: string): string {
  return path
    .trim()
    .replace(/^\/?(newsletter\/)?/, "")
    .replace(/\/+$/, "");
}

function resolvePath(path: string, byId: ById): Id<"posts"> | null {
  const slugs = cleanPath(path).split("/").filter(Boolean);
  if (slugs.length === 0) return null;
  let parentId: Id<"posts"> | undefined = undefined;
  let found: Doc<"posts"> | undefined;
  for (const slug of slugs) {
    found = [...byId.values()].find((p) => p.parentId === parentId && p.slug === slug);
    if (!found) return null;
    parentId = found._id;
  }
  return found?._id ?? null;
}

const vRef = { id: v.optional(v.string()), path: v.optional(v.string()) };

// The whole tree, in reading order
export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { posts, byId } = await allPosts(ctx);
    const children = new Map<string, Doc<"posts">[]>();
    for (const p of posts) {
      const key = p.parentId ?? "";
      children.set(key, [...(children.get(key) ?? []), p]);
    }
    const out: Awaited<ReturnType<typeof describe>>[] = [];
    const walk = async (key: string) => {
      for (const p of (children.get(key) ?? []).sort((a, b) => a.order - b.order)) {
        out.push(await describe(ctx, p, byId));
        await walk(p._id);
      }
    };
    await walk("");
    return out;
  },
});

export const get = internalQuery({
  args: vRef,
  handler: async (ctx, ref) => {
    const { post, byId } = await find(ctx, ref);
    return { ...(await describe(ctx, post, byId)), contentHtml: post.contentHtml ?? "" };
  },
});

export const topics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { posts } = await allPosts(ctx);
    return [...new Set(posts.map((p) => p.topic).filter((t): t is string => !!t))].sort();
  },
});

// Create or update an entry. Finds the existing one by id, or else by where
// it would live (parent path and slug), so pushing the same file twice
// updates it. Fields left out keep their current value; null clears one.
export const upsert = internalMutation({
  args: {
    id: v.optional(v.string()),
    kind: v.optional(vKind),
    title: v.string(),
    slug: v.optional(v.string()),
    parent: v.optional(v.union(v.string(), v.null())),
    topic: v.optional(v.union(v.string(), v.null())),
    summary: v.optional(v.union(v.string(), v.null())),
    coverImageId: v.optional(v.union(v.id("_storage"), v.null())),
    contentHtml: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { byId } = await allPosts(ctx);

    let parentId: Id<"posts"> | undefined;
    if (args.parent !== undefined && args.parent !== null && cleanPath(args.parent) !== "") {
      const found = resolvePath(args.parent, byId);
      if (!found) {
        throw new ConvexError(`There's no folder or series at ${cleanPath(args.parent)}. Create it first.`);
      }
      parentId = found;
    }

    let existing: Doc<"posts"> | undefined;
    if (args.id) {
      const id = ctx.db.normalizeId("posts", args.id);
      existing = id ? byId.get(id) : undefined;
      if (!existing) throw new ConvexError(`No entry with id ${args.id}. Remove the id to create it again.`);
    } else {
      const where = args.parent === undefined ? undefined : parentId;
      const slug = slugify(args.slug?.trim() || args.title);
      existing = [...byId.values()].find((p) => p.parentId === where && p.slug === slug);
    }
    if (existing) draftOnly(existing, pathOf(existing, byId).join("/"));
    if (args.parent === undefined && existing) parentId = existing.parentId;

    const keep = <T>(given: T | null | undefined, current: T | undefined) =>
      given === undefined ? current : given === null ? undefined : given;
    const html = args.contentHtml;
    const saved = await savePost(ctx, {
      id: existing?._id,
      kind: args.kind ?? existing?.kind ?? "post",
      title: args.title,
      // an update keeps its link unless a new slug is asked for
      slug: args.slug ?? existing?.slug,
      parentId,
      topic: keep(args.topic, existing?.topic),
      excerpt: keep(args.summary, existing?.excerpt),
      coverImageId: keep(args.coverImageId, existing?.coverImageId),
      // new HTML replaces the editor's copy; the editor rebuilds it from HTML
      contentJson: html === undefined ? existing?.contentJson : undefined,
      contentHtml: html === undefined ? existing?.contentHtml : html,
      status: "draft",
    });
    const fresh = await allPosts(ctx);
    const post = fresh.byId.get(saved.id)!;
    return { created: !existing, ...(await describe(ctx, post, fresh.byId)) };
  },
});

export const move = internalMutation({
  args: { ...vRef, direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, { direction, ...ref }) => {
    const { post, byId } = await find(ctx, ref);
    draftOnly(post, pathOf(post, byId).join("/"));
    await movePost(ctx, post._id, direction);
    const fresh = await allPosts(ctx);
    return await describe(ctx, fresh.byId.get(post._id)!, fresh.byId);
  },
});

export const remove = internalMutation({
  args: vRef,
  handler: async (ctx, ref) => {
    const { post, byId } = await find(ctx, ref);
    const path = pathOf(post, byId).join("/");
    draftOnly(post, path);
    await removePost(ctx, post._id);
    return { deleted: path };
  },
});

// For the test email: the id of a post given by id or path
export const idOf = internalQuery({
  args: vRef,
  handler: async (ctx, ref) => (await find(ctx, ref)).post._id,
});

export const insights = internalQuery({
  args: { days: v.union(v.literal(7), v.literal(30), v.literal(90)), today: v.string() },
  handler: async (ctx, { days, today }) => await computeInsights(ctx, days, today),
});
