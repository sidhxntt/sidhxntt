import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// A post, a series or a folder. Series and folders hold other entries
// (parentId), so the newsletter can nest like a Notion page tree:
//   Blogs (folder) → Software Architectures (series) → its parts (posts)
export const vKind = v.union(v.literal("post"), v.literal("series"), v.literal("folder"));
export const vStatus = v.union(v.literal("draft"), v.literal("published"));

export default defineSchema({
  // users, sessions and accounts for Google sign-in (Convex Auth)
  ...authTables,

  posts: defineTable({
    kind: vKind,
    title: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("posts")),
    // position among its siblings; parts of a series read in this order
    order: v.number(),
    status: vStatus,
    topic: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    coverImageId: v.optional(v.id("_storage")),
    // the editor's own document (Tiptap JSON, stringified) and the HTML readers see
    contentJson: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    readingMinutes: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
    // set once the post has been emailed to subscribers
    emailedAt: v.optional(v.number()),
    likeCount: v.number(),
    commentCount: v.number(),
    // all-time totals, kept beside the per-day rows in `daily`
    viewCount: v.optional(v.number()),
    readCount: v.optional(v.number()),
  })
    .index("by_parent_order", ["parentId", "order"])
    .index("by_parent_slug", ["parentId", "slug"])
    .index("by_status_published", ["status", "publishedAt"]),

  // Reddit-style threads: any comment can be replied to, to any depth.
  comments: defineTable({
    postId: v.id("posts"),
    parentId: v.optional(v.id("comments")),
    authorId: v.id("users"),
    body: v.string(),
    depth: v.number(),
    // a removed comment that still has replies stays as a "[deleted]" stub
    deleted: v.optional(v.union(v.literal("author"), v.literal("moderator"))),
    editedAt: v.optional(v.number()),
    likeCount: v.number(),
    replyCount: v.number(),
  })
    .index("by_post", ["postId"])
    .index("by_parent", ["parentId"])
    .index("by_author", ["authorId"]),

  // One row per like. commentId is empty for a like on the post itself.
  likes: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
    commentId: v.optional(v.id("comments")),
  })
    .index("by_user_post_comment", ["userId", "postId", "commentId"])
    .index("by_post", ["postId"])
    .index("by_comment", ["commentId"]),

  // Posts a reader saved to read later, newest first per reader.
  bookmarks: defineTable({
    userId: v.id("users"),
    postId: v.id("posts"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_post", ["userId", "postId"])
    .index("by_post", ["postId"]),

  // Email subscribers, with double opt-in.
  subscribers: defineTable({
    email: v.string(),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("unsubscribed")),
    token: v.string(),
    confirmedAt: v.optional(v.number()),
    unsubscribedAt: v.optional(v.number()),
    lastConfirmationSentAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_status", ["status"]),

  // Stats. A view is one visitor opening a post on a day; a read is that
  // visitor reaching the end of it. `visits` only exists to count each
  // visitor once a day and is cleared after two days; `daily` keeps the
  // counts. A visitor is a random id the browser keeps, never an account.
  visits: defineTable({
    postId: v.id("posts"),
    visitor: v.string(),
    day: v.string(),
    read: v.boolean(),
  })
    .index("by_post_and_visitor_and_day", ["postId", "visitor", "day"])
    .index("by_day", ["day"]),

  daily: defineTable({
    postId: v.id("posts"),
    day: v.string(),
    views: v.number(),
    reads: v.number(),
  })
    .index("by_post_and_day", ["postId", "day"])
    .index("by_day", ["day"]),
});
