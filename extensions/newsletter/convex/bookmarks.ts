import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { allPosts, toCard, type PostCard } from "./posts";
import { currentUser, publishedPath, requireUser } from "./lib";

// Saving posts to read later, and the reader's own page: what they saved,
// liked and said. Every signed-in reader has one, the author included.

const LIST_LIMIT = 200;

export const toggle = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const user = await requireUser(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.status !== "published" || post.kind === "folder") {
      throw new ConvexError("That post isn't available.");
    }
    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_and_post", (q) => q.eq("userId", user._id).eq("postId", postId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("bookmarks", { userId: user._id, postId });
    return { saved: true };
  },
});

export type ProfileComment = {
  id: Id<"comments">;
  body: string;
  createdAt: number;
  replyCount: number;
  likeCount: number;
  post: { title: string; path: string[] };
};

// The signed-in reader's page. Posts that are no longer published drop out.
export const profile = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const { byId } = await allPosts(ctx);
    const cards = async (ids: Id<"posts">[]) => {
      const out: PostCard[] = [];
      for (const id of ids) {
        const post = byId.get(id);
        const path = post ? publishedPath(post, byId) : null;
        if (post && path) out.push(await toCard(ctx, post, path));
      }
      return out;
    };

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(LIST_LIMIT);
    const savedCards = await cards(bookmarks.map((b) => b.postId));
    const savedAt = new Map(bookmarks.map((b) => [b.postId, b._creationTime]));

    const likes = (
      await ctx.db
        .query("likes")
        .withIndex("by_user_post_comment", (q) => q.eq("userId", user._id))
        .take(LIST_LIMIT * 4)
    )
      .filter((l) => l.commentId === undefined)
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, LIST_LIMIT);
    const likedCards = await cards(likes.map((l) => l.postId));

    const comments: ProfileComment[] = [];
    for (const c of await ctx.db
      .query("comments")
      .withIndex("by_author", (q) => q.eq("authorId", user._id))
      .order("desc")
      .take(LIST_LIMIT)) {
      if (c.deleted) continue;
      const post = byId.get(c.postId);
      const path = post ? publishedPath(post, byId) : null;
      if (!post || !path) continue;
      comments.push({
        id: c._id,
        body: c.body,
        createdAt: c._creationTime,
        replyCount: c.replyCount,
        likeCount: c.likeCount,
        post: { title: post.title, path },
      });
    }

    return {
      name: user.name ?? user.email ?? "Reader",
      email: user.email ?? null,
      image: user.image ?? null,
      joinedAt: user._creationTime,
      saved: savedCards.map((c) => ({ ...c, savedAt: savedAt.get(c.id) ?? null })),
      liked: likedCards,
      comments,
    };
  },
});
