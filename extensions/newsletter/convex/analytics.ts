import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { addDays, dayKey, dayRange, dayStart, isDay } from "./days";
import { adminEmail, currentUser, isAdminUser, publishedPath } from "./lib";

// Views and reads, counted the way Medium does: a view when a visitor opens a
// post, a read when they reach its end. Each visitor counts once a day per
// post. The author's own visits are never counted.

const VISITOR = /^[A-Za-z0-9-]{8,64}$/;
// Bounds for the Insights reads; far above what a personal newsletter makes
const MAX_ROWS = 20_000;

async function countable(ctx: MutationCtx, postId: Id<"posts">, visitor: string) {
  if (!VISITOR.test(visitor)) throw new ConvexError("Bad visitor id.");
  if (isAdminUser(await currentUser(ctx))) return null;
  const post = await ctx.db.get(postId);
  if (!post || post.status !== "published" || post.kind === "folder") return null;
  return post;
}

async function bump(ctx: MutationCtx, post: Doc<"posts">, day: string, views: number, reads: number) {
  const row = await ctx.db
    .query("daily")
    .withIndex("by_post_and_day", (q) => q.eq("postId", post._id).eq("day", day))
    .unique();
  if (row) await ctx.db.patch(row._id, { views: row.views + views, reads: row.reads + reads });
  else await ctx.db.insert("daily", { postId: post._id, day, views, reads });
  await ctx.db.patch(post._id, {
    viewCount: (post.viewCount ?? 0) + views,
    readCount: (post.readCount ?? 0) + reads,
  });
}

async function visitFor(ctx: MutationCtx, postId: Id<"posts">, visitor: string, day: string) {
  return await ctx.db
    .query("visits")
    .withIndex("by_post_and_visitor_and_day", (q) => q.eq("postId", postId).eq("visitor", visitor).eq("day", day))
    .unique();
}

export const recordView = mutation({
  args: { postId: v.id("posts"), visitor: v.string() },
  handler: async (ctx, { postId, visitor }) => {
    const post = await countable(ctx, postId, visitor);
    if (!post) return null;
    const day = dayKey(Date.now());
    if (await visitFor(ctx, postId, visitor, day)) return null;
    await ctx.db.insert("visits", { postId, visitor, day, read: false });
    await bump(ctx, post, day, 1, 0);
    return null;
  },
});

export const recordRead = mutation({
  args: { postId: v.id("posts"), visitor: v.string() },
  handler: async (ctx, { postId, visitor }) => {
    const post = await countable(ctx, postId, visitor);
    if (!post) return null;
    const day = dayKey(Date.now());
    const visit = await visitFor(ctx, postId, visitor, day);
    if (visit?.read) return null;
    if (visit) {
      await ctx.db.patch(visit._id, { read: true });
      await bump(ctx, post, day, 0, 1);
    } else {
      // opened yesterday, finished after midnight: a view and a read today
      await ctx.db.insert("visits", { postId, visitor, day, read: true });
      await bump(ctx, post, day, 1, 1);
    }
    return null;
  },
});

// Visits only matter on the day they happen; the cron clears old ones.
export const purgeVisits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = addDays(dayKey(Date.now()), -2);
    const old = await ctx.db
      .query("visits")
      .withIndex("by_day", (q) => q.lt("day", cutoff))
      .take(500);
    for (const visit of old) await ctx.db.delete(visit._id);
    if (old.length === 500) await ctx.scheduler.runAfter(0, internal.analytics.purgeVisits, {});
    return null;
  },
});

/* ─────────────────────────────── Insights ─────────────────────────────── */

export type Totals = {
  views: number;
  reads: number;
  likes: number;
  comments: number;
  subscribers: number;
  unsubscribes: number;
};

export type InsightsDay = Totals & { day: string; audience: number };

export type InsightsPost = {
  id: Id<"posts">;
  kind: Doc<"posts">["kind"];
  title: string;
  path: string[];
  publishedAt: number | null;
  views: number;
  reads: number;
  likes: number;
  comments: number;
  allTimeViews: number;
  allTimeReads: number;
};

const zero = (): Totals => ({ views: 0, reads: 0, likes: 0, comments: 0, subscribers: 0, unsubscribes: 0 });

// Everything the Insights tab shows for the `days` days ending on `today`
// (the admin's browser passes its date; queries don't read the clock), plus
// the same totals for the period before, for the change figures.
export const insights = query({
  args: { days: v.union(v.literal(7), v.literal(30), v.literal(90)), today: v.string() },
  handler: async (ctx, { days, today }) => {
    if (!isAdminUser(await currentUser(ctx))) return null;
    return await computeInsights(ctx, days, today);
  },
});

// Shared with the agent endpoints, which check their own key.
export async function computeInsights(ctx: QueryCtx, days: 7 | 30 | 90, today: string) {
  if (!isDay(today)) throw new ConvexError("Bad date.");

  const range = dayRange(today, days);
  const first = range[0];
  const prevFirst = addDays(first, -days);
  const from = dayStart(prevFirst);
  const end = dayStart(addDays(today, 1));
  const series = new Map<string, Totals>(range.map((d) => [d, zero()]));
  const current = zero();
  const previous = zero();
  const perPost = new Map<Id<"posts">, { views: number; reads: number; likes: number; comments: number }>();
  const postRow = (id: Id<"posts">) => {
    let row = perPost.get(id);
    if (!row) perPost.set(id, (row = { views: 0, reads: 0, likes: 0, comments: 0 }));
    return row;
  };
  // Adds to the right period; returns whether it fell in the current one
  const add = (day: string, key: keyof Totals, n: number) => {
    if (day < prevFirst || day > today) return false;
    if (day < first) {
      previous[key] += n;
      return false;
    }
    current[key] += n;
    series.get(day)![key] += n;
    return true;
  };

  const daily = await ctx.db
    .query("daily")
    .withIndex("by_day", (q) => q.gte("day", prevFirst).lte("day", today))
    .take(MAX_ROWS);
  for (const row of daily) {
    add(row.day, "reads", row.reads);
    if (add(row.day, "views", row.views)) {
      const p = postRow(row.postId);
      p.views += row.views;
      p.reads += row.reads;
    }
  }

  const likes = await ctx.db
    .query("likes")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lt("_creationTime", end))
    .take(MAX_ROWS);
  for (const like of likes) {
    if (like.commentId) continue; // likes on comments aren't likes on the post
    if (add(dayKey(like._creationTime), "likes", 1)) postRow(like.postId).likes += 1;
  }

  const comments = await ctx.db
    .query("comments")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lt("_creationTime", end))
    .take(MAX_ROWS);
  for (const comment of comments) {
    if (add(dayKey(comment._creationTime), "comments", 1)) postRow(comment.postId).comments += 1;
  }

  // Audience: confirmed subscribers on each day, from when each joined and
  // (if they did) left. The author's own address never counts.
  const admin = adminEmail();
  const subs = (await ctx.db.query("subscribers").take(MAX_ROWS)).filter(
    (s) => s.confirmedAt !== undefined && s.email !== admin,
  );
  for (const s of subs) {
    add(dayKey(s.confirmedAt!), "subscribers", 1);
    if (s.status === "unsubscribed" && s.unsubscribedAt) add(dayKey(s.unsubscribedAt), "unsubscribes", 1);
  }
  const audienceOn = (day: string) => {
    const dayEnd = dayStart(addDays(day, 1));
    return subs.filter(
      (s) =>
        s.confirmedAt! < dayEnd &&
        (s.status !== "unsubscribed" || (s.unsubscribedAt !== undefined && s.unsubscribedAt >= dayEnd)),
    ).length;
  };

  const posts = await ctx.db.query("posts").take(MAX_ROWS);
  const byId = new Map(posts.map((p) => [p._id, p]));
  const stories: InsightsPost[] = [];
  for (const post of posts) {
    if (post.kind === "folder") continue;
    const path = publishedPath(post, byId);
    if (!path) continue;
    const p = perPost.get(post._id) ?? { views: 0, reads: 0, likes: 0, comments: 0 };
    stories.push({
      id: post._id,
      kind: post.kind,
      title: post.title,
      path,
      publishedAt: post.publishedAt ?? null,
      ...p,
      allTimeViews: post.viewCount ?? 0,
      allTimeReads: post.readCount ?? 0,
    });
  }
  stories.sort((a, b) => b.views - a.views || b.allTimeViews - a.allTimeViews || (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  const daysOut: InsightsDay[] = range.map((day) => ({ day, ...series.get(day)!, audience: audienceOn(day) }));
  return {
    days: daysOut,
    current,
    previous,
    audience: audienceOn(today),
    audienceBefore: audienceOn(addDays(first, -1)),
    stories,
  };
}
