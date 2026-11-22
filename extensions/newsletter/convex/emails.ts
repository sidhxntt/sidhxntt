import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { adminEmail } from "./lib";

// Email through AutoSend (https://docs.autosend.com). Needs these environment
// variables on the Convex deployment:
//   AUTOSEND_API_KEY        from AutoSend's settings
//   NEWSLETTER_FROM_EMAIL   an address on a domain verified in AutoSend
//   NEWSLETTER_FROM_NAME    optional, defaults to "Siddhant Gupta"
//   SITE_URL                https://sidhxntt.dev (also used by sign-in)
// Without an API key nothing is sent; links are logged instead, for local dev.

const AUTOSEND = "https://api.autosend.com/v1";
const BATCH = 100; // AutoSend's bulk endpoint takes up to 100 recipients

function site() {
  return (process.env.SITE_URL ?? "https://sidhxntt.dev").replace(/\/+$/, "");
}

function from() {
  const email = process.env.NEWSLETTER_FROM_EMAIL;
  if (!email) throw new ConvexError("Set NEWSLETTER_FROM_EMAIL on the Convex deployment first.");
  return { email, name: process.env.NEWSLETTER_FROM_NAME ?? "Siddhant Gupta" };
}

async function autosend(path: string, body: unknown) {
  const key = process.env.AUTOSEND_API_KEY;
  if (!key) {
    console.log(`[newsletter] AUTOSEND_API_KEY not set; would POST ${path}`, JSON.stringify(body).slice(0, 2000));
    return { success: true, skipped: true } as const;
  }
  const res = await fetch(`${AUTOSEND}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Record<string, unknown> } | null;
  if (!res.ok || !json?.success) {
    throw new ConvexError(`AutoSend refused the email (${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

// Both emails use templates in AutoSend (Dynamic Templates), so their design
// is edited there. AutoSend escapes the variables passed in dynamicData.
const CONFIRM_TEMPLATE = "A-9991fa304705f4ac22a5"; // "Confirm Subscription": email, confirmUrl
const POST_TEMPLATE = "A-04a937316b00d176a0a9"; // "New Blog": the fields postEmail returns

export const sendConfirmation = internalAction({
  args: { subscriberId: v.id("subscribers") },
  handler: async (ctx, { subscriberId }) => {
    const sub = await ctx.runQuery(internal.subscribers.get, { id: subscriberId });
    if (!sub || sub.status !== "pending") return;
    const confirmUrl = `${site()}/newsletter/confirm?token=${sub.token}`;
    if (!process.env.AUTOSEND_API_KEY) {
      console.log(`[newsletter] confirm link for ${sub.email}: ${confirmUrl}`);
      return;
    }
    await autosend("/mails/send", {
      from: from(),
      to: { email: sub.email },
      templateId: CONFIRM_TEMPLATE,
      dynamicData: { email: sub.email, confirmUrl },
    });
  },
});

// "" hides the template's optional parts (cover, excerpt, reading time).
function postEmail(post: {
  title: string;
  excerpt: string | null;
  path: string[];
  coverUrl: string | null;
  readingMinutes: number | null;
  seriesTitle: string | null;
}) {
  return {
    subject: post.title,
    data: {
      title: post.title,
      excerpt: post.excerpt ?? "",
      postUrl: `${site()}/newsletter/${post.path.map(encodeURIComponent).join("/")}`,
      coverUrl: post.coverUrl ?? "",
      readingMinutes: post.readingMinutes ? String(post.readingMinutes) : "",
      kicker: post.seriesTitle ? `New in ${post.seriesTitle}` : "New post",
    },
  };
}

async function sendTest(message: ReturnType<typeof postEmail>, email: string) {
  const res = await autosend("/mails/send", {
    from: from(),
    to: { email },
    templateId: POST_TEMPLATE,
    subject: `[Test] ${message.subject}`,
    dynamicData: { ...message.data, unsubscribeUrl: `${site()}/newsletter/unsubscribe?token=test` },
  });
  return { sent: 1, failed: 0, skipped: "skipped" in res };
}

// For the writing agent: a test copy of a published post, always to the
// author's own address.
export const sendTestToAuthor = internalAction({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }): Promise<{ sent: number; failed: number; skipped?: boolean; to: string }> => {
    const post = await ctx.runQuery(internal.posts.forEmail, { id: postId });
    if (!post) throw new ConvexError("Publish the post (and everything it sits in) before emailing it.");
    const to = adminEmail();
    return { ...(await sendTest(postEmail(post), to)), to };
  },
});

// Checks the AutoSend setup without a post or a sign-in:
//   npx convex run emails:sendSample '{"to":"you@example.com"}'
export const sendSample = internalAction({
  args: { to: v.string() },
  handler: async (_ctx, { to }) => {
    const message = postEmail({
      title: "A sample post",
      excerpt: "This is what a new post looks like in subscribers' inboxes. If it reached you, AutoSend is set up.",
      path: [],
      coverUrl: null,
      readingMinutes: 3,
      seriesTitle: null,
    });
    await autosend("/mails/send", {
      from: from(),
      to: { email: to },
      templateId: POST_TEMPLATE,
      subject: `[Test] ${message.subject}`,
      dynamicData: { ...message.data, unsubscribeUrl: `${site()}/newsletter/unsubscribe?token=test` },
    });
    return null;
  },
});

// From the admin: email a published post to everyone subscribed, or a test
// copy to the admin's own address first.
export const sendPost = action({
  args: {
    postId: v.id("posts"),
    mode: v.union(v.literal("test"), v.literal("all")),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { postId, mode, force }): Promise<{ sent: number; failed: number; skipped?: boolean }> => {
    if (!(await ctx.runQuery(internal.users.isAdmin, {}))) {
      throw new ConvexError("Only the newsletter's author can do that.");
    }
    const post = await ctx.runQuery(internal.posts.forEmail, { id: postId as Id<"posts"> });
    if (!post) throw new ConvexError("Publish the post (and everything it sits in) before emailing it.");
    const message = postEmail(post);
    const unsubscribeBase = `${site()}/newsletter/unsubscribe?token=`;

    if (mode === "test") {
      const me = await ctx.runQuery(api.users.me, {});
      if (!me?.email) throw new ConvexError("Your account has no email address.");
      return await sendTest(message, me.email);
    }

    if (post.emailedAt && !force) {
      throw new ConvexError("This post has already been emailed. Send again only if you mean to.");
    }
    let cursor: string | null = null;
    let sent = 0;
    let failed = 0;
    for (;;) {
      const page: { page: { email: string; token: string }[]; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.subscribers.activePage, { cursor, size: BATCH });
      if (page.page.length > 0) {
        const res = await autosend("/mails/bulk", {
          from: from(),
          templateId: POST_TEMPLATE,
          subject: message.subject,
          recipients: page.page.map((s) => ({
            email: s.email,
            dynamicData: { ...message.data, unsubscribeUrl: `${unsubscribeBase}${s.token}` },
          })),
        });
        const data = ("data" in res ? res.data : undefined) as { successCount?: number; failedCount?: number } | undefined;
        sent += data?.successCount ?? page.page.length;
        failed += data?.failedCount ?? 0;
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    await ctx.runMutation(internal.subscribers.markEmailed, { postId: postId as Id<"posts"> });
    return { sent, failed };
  },
});
