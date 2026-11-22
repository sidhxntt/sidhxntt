import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { adminEmail, currentUser, isAdminUser } from "./lib";

// Double opt-in: subscribing sends a confirmation email; only confirmed
// addresses get posts. Every email carries a one-click unsubscribe link.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_AFTER_MS = 2 * 60 * 1000;

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const subscribe = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) throw new ConvexError("That email address doesn't look right.");
    // The author writes the newsletter; it is never sent to them.
    if (email === adminEmail() || isAdminUser(await currentUser(ctx))) {
      throw new ConvexError("You write this newsletter, so you can't subscribe to it.");
    }
    const existing = await ctx.db.query("subscribers").withIndex("by_email", (q) => q.eq("email", email)).unique();

    // Same answer whether or not the address is already on the list, so the
    // form can't be used to find out who subscribes.
    if (existing?.status === "active") return { ok: true };
    if (existing?.lastConfirmationSentAt && Date.now() - existing.lastConfirmationSentAt < RESEND_AFTER_MS) {
      return { ok: true };
    }

    const token = newToken();
    let id = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, { status: "pending", token, lastConfirmationSentAt: Date.now() });
    } else {
      id = await ctx.db.insert("subscribers", { email, status: "pending", token, lastConfirmationSentAt: Date.now() });
    }
    await ctx.scheduler.runAfter(0, internal.emails.sendConfirmation, { subscriberId: id! });
    return { ok: true };
  },
});

export const confirm = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sub = await ctx.db.query("subscribers").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!sub) return { status: "invalid" as const };
    if (sub.email === adminEmail()) return { status: "invalid" as const };
    if (sub.status !== "active") {
      await ctx.db.patch(sub._id, { status: "active", confirmedAt: Date.now(), unsubscribedAt: undefined });
    }
    return { status: "confirmed" as const, email: sub.email };
  },
});

export const unsubscribe = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sub = await ctx.db.query("subscribers").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!sub) return { status: "invalid" as const };
    if (sub.status !== "unsubscribed") {
      await ctx.db.patch(sub._id, { status: "unsubscribed", unsubscribedAt: Date.now() });
    }
    return { status: "unsubscribed" as const, email: sub.email };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    if (!isAdminUser(await currentUser(ctx))) return null;
    const admin = adminEmail();
    const all = (await ctx.db.query("subscribers").take(20_000)).filter((s) => s.email !== admin);
    return {
      active: all.filter((s) => s.status === "active").length,
      pending: all.filter((s) => s.status === "pending").length,
      unsubscribed: all.filter((s) => s.status === "unsubscribed").length,
    };
  },
});

// The newest sign-ups, for the Subscribers tab
export const recent = query({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    if (!isAdminUser(await currentUser(ctx))) return null;
    const admin = adminEmail();
    const rows = await ctx.db
      .query("subscribers")
      .order("desc")
      .take(Math.min(Math.max(limit, 1), 200));
    return rows
      .filter((s) => s.email !== admin)
      .map((s) => ({
        id: s._id,
        email: s.email,
        status: s.status,
        joinedAt: s._creationTime,
        confirmedAt: s.confirmedAt ?? null,
        unsubscribedAt: s.unsubscribedAt ?? null,
      }));
  },
});

export const get = internalQuery({
  args: { id: v.id("subscribers") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

// Active subscribers, a page at a time, for the post email. The author's own
// address is left out even if it got onto the list before that was blocked.
export const activePage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), size: v.number() },
  handler: async (ctx, { cursor, size }) => {
    const result = await ctx.db
      .query("subscribers")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .paginate({ cursor, numItems: size });
    const admin = adminEmail();
    return { ...result, page: result.page.filter((s) => s.email !== admin) };
  },
});

export const markEmailed = internalMutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    await ctx.db.patch(postId, { emailedAt: Date.now() });
  },
});
