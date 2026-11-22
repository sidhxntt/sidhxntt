import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./lib";

// One like per reader per post or comment; liking again takes it back.

export const togglePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const user = await requireUser(ctx);
    const post = await ctx.db.get(postId);
    if (!post || post.status !== "published") throw new ConvexError("That post isn't available.");
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_post_comment", (q) =>
        q.eq("userId", user._id).eq("postId", postId).eq("commentId", undefined),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(postId, { likeCount: Math.max(0, post.likeCount - 1) });
      return { liked: false, likeCount: Math.max(0, post.likeCount - 1) };
    }
    await ctx.db.insert("likes", { userId: user._id, postId });
    await ctx.db.patch(postId, { likeCount: post.likeCount + 1 });
    return { liked: true, likeCount: post.likeCount + 1 };
  },
});

export const toggleComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    const user = await requireUser(ctx);
    const comment = await ctx.db.get(commentId);
    if (!comment || comment.deleted) throw new ConvexError("That comment isn't available.");
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_user_post_comment", (q) =>
        q.eq("userId", user._id).eq("postId", comment.postId).eq("commentId", commentId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(commentId, { likeCount: Math.max(0, comment.likeCount - 1) });
      return { liked: false };
    }
    await ctx.db.insert("likes", { userId: user._id, postId: comment.postId, commentId });
    await ctx.db.patch(commentId, { likeCount: comment.likeCount + 1 });
    return { liked: true };
  },
});
