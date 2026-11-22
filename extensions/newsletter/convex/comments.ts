import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { currentUser, isAdminUser, requireAdmin, requireUser } from "./lib";

// Reddit-style threads: any comment can be replied to, to any depth. The
// client builds the tree from this flat list (parentId links).

export const MAX_BODY = 5000;
const MIN_GAP_MS = 5_000; // between two comments from the same reader

export const forPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const viewer = await currentUser(ctx);
    const comments = await ctx.db.query("comments").withIndex("by_post", (q) => q.eq("postId", postId)).collect();

    const likedIds = new Set<Id<"comments">>();
    if (viewer) {
      const likes = await ctx.db
        .query("likes")
        .withIndex("by_user_post_comment", (q) => q.eq("userId", viewer._id).eq("postId", postId))
        .collect();
      for (const l of likes) if (l.commentId) likedIds.add(l.commentId);
    }

    const authors = new Map<Id<"users">, Doc<"users"> | null>();
    for (const c of comments) {
      if (!authors.has(c.authorId)) authors.set(c.authorId, await ctx.db.get(c.authorId));
    }

    return {
      viewer: viewer
        ? { id: viewer._id, isAdmin: isAdminUser(viewer), name: viewer.name ?? "Reader", image: viewer.image ?? null }
        : null,
      comments: comments.map((c) => {
        const author = authors.get(c.authorId);
        return {
          id: c._id,
          parentId: c.parentId ?? null,
          depth: c.depth,
          createdAt: c._creationTime,
          editedAt: c.editedAt ?? null,
          deleted: c.deleted ?? null,
          body: c.deleted ? null : c.body,
          author:
            c.deleted || !author
              ? null
              : { name: author.name ?? "Reader", image: author.image ?? null, isAuthor: isAdminUser(author) },
          likeCount: c.likeCount,
          replyCount: c.replyCount,
          liked: likedIds.has(c._id),
          mine: !!viewer && c.authorId === viewer._id,
        };
      }),
    };
  },
});

function cleanBody(body: string) {
  const text = body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new ConvexError("Write something first.");
  if (text.length > MAX_BODY) throw new ConvexError(`Keep it under ${MAX_BODY} characters.`);
  return text;
}

export const add = mutation({
  args: { postId: v.id("posts"), parentId: v.optional(v.id("comments")), body: v.string() },
  handler: async (ctx, { postId, parentId, body }) => {
    const user = await requireUser(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.status !== "published") throw new ConvexError("That post isn't open for comments.");
    const text = cleanBody(body);

    const last = await ctx.db
      .query("comments")
      .withIndex("by_author", (q) => q.eq("authorId", user._id))
      .order("desc")
      .first();
    if (last && Date.now() - last._creationTime < MIN_GAP_MS && !isAdminUser(user)) {
      throw new ConvexError("Slow down a little, then try again.");
    }

    let depth = 0;
    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent || parent.postId !== postId) throw new ConvexError("That comment is gone.");
      if (parent.deleted) throw new ConvexError("You can't reply to a deleted comment.");
      depth = parent.depth + 1;
      await ctx.db.patch(parentId, { replyCount: parent.replyCount + 1 });
    }
    const id = await ctx.db.insert("comments", {
      postId,
      parentId,
      authorId: user._id,
      body: text,
      depth,
      likeCount: 0,
      replyCount: 0,
    });
    await ctx.db.patch(postId, { commentCount: post.commentCount + 1 });
    return id;
  },
});

export const edit = mutation({
  args: { id: v.id("comments"), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const user = await requireUser(ctx);
    const comment = await ctx.db.get(id);
    if (!comment || comment.deleted) throw new ConvexError("That comment is gone.");
    if (comment.authorId !== user._id) throw new ConvexError("You can only edit your own comments.");
    await ctx.db.patch(id, { body: cleanBody(body), editedAt: Date.now() });
  },
});

// A comment with replies stays as a "[deleted]" stub so the thread keeps its
// shape; one without replies goes, and so do deleted ancestors left empty.
async function removeComment(ctx: MutationCtx, comment: Doc<"comments">, by: "author" | "moderator") {
  const post = await ctx.db.get(comment.postId);
  if (post) await ctx.db.patch(post._id, { commentCount: Math.max(0, post.commentCount - 1) });

  for (const like of await ctx.db.query("likes").withIndex("by_comment", (q) => q.eq("commentId", comment._id)).collect()) {
    await ctx.db.delete(like._id);
  }

  if (comment.replyCount > 0) {
    await ctx.db.patch(comment._id, { deleted: by, body: "", likeCount: 0 });
    return;
  }
  await ctx.db.delete(comment._id);
  let parentId = comment.parentId;
  while (parentId) {
    const parent: Doc<"comments"> | null = await ctx.db.get(parentId);
    if (!parent) break;
    const replyCount = Math.max(0, parent.replyCount - 1);
    if (parent.deleted && replyCount === 0) {
      await ctx.db.delete(parent._id);
      parentId = parent.parentId;
    } else {
      await ctx.db.patch(parent._id, { replyCount });
      break;
    }
  }
}

export const remove = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const comment = await ctx.db.get(id);
    if (!comment || comment.deleted) return;
    const admin = isAdminUser(user);
    if (comment.authorId !== user._id && !admin) throw new ConvexError("You can only delete your own comments.");
    await removeComment(ctx, comment, comment.authorId === user._id ? "author" : "moderator");
  },
});

// The admin's moderation list: newest comments across every post.
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    if (!isAdminUser(await currentUser(ctx))) return null;
    const rows = await ctx.db.query("comments").order("desc").take(Math.min(limit ?? 50, 200));
    return await Promise.all(
      rows
        .filter((c) => !c.deleted)
        .map(async (c) => {
          const [author, post] = await Promise.all([ctx.db.get(c.authorId), ctx.db.get(c.postId)]);
          return {
            id: c._id,
            body: c.body,
            createdAt: c._creationTime,
            author: author?.name ?? author?.email ?? "Reader",
            authorEmail: author?.email ?? null,
            postTitle: post?.title ?? "(deleted post)",
            postId: c.postId,
          };
        }),
    );
  },
});

export const moderate = mutation({
  args: { id: v.id("comments") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const comment = await ctx.db.get(id);
    if (comment && !comment.deleted) await removeComment(ctx, comment, "moderator");
  },
});
