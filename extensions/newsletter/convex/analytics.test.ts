// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { addDays, dayKey, dayRange, dayStart } from "./days";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const ADMIN = "siddhantg2002@gmail.com";
const VISITOR_A = "visitor-aaaa-1111";
const VISITOR_B = "visitor-bbbb-2222";

async function setup() {
  const t = convexTest(schema, modules);
  const makeUser = async (email: string) => {
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { email, name: email.split("@")[0], emailVerificationTime: Date.now() }),
    );
    return { id, as: t.withIdentity({ subject: `${id}|session-${id}` }) };
  };
  const admin = await makeUser(ADMIN);
  const reader = await makeUser("reader@example.com");
  const post = await admin.as.mutation(api.posts.save, {
    kind: "post",
    title: "How is the code split up?",
    status: "published",
    contentHtml: "<p>" + "word ".repeat(300) + "</p>",
    contentJson: "{}",
  });
  const draft = await admin.as.mutation(api.posts.save, { kind: "post", title: "Not yet", status: "draft" });
  return { t, admin, reader, postId: post.id, draftId: draft.id };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("days", () => {
  it("splits days at midnight in India", () => {
    // 18:29 UTC is 23:59 in India; 18:30 UTC is the next day there
    expect(dayKey(Date.parse("2026-11-21T18:29:00Z"))).toBe("2026-11-21");
    expect(dayKey(Date.parse("2026-11-21T18:30:00Z"))).toBe("2026-11-22");
    expect(dayStart("2026-11-22")).toBe(Date.parse("2026-11-21T18:30:00Z"));
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayRange("2026-11-22", 3)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
  });
});

describe("views and reads", () => {
  it("counts each visitor once a day, skips the author, drafts and bad ids", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-11-20T06:00:00Z"));
    const { t, admin, reader, postId, draftId } = await setup();

    await t.mutation(api.analytics.recordView, { postId, visitor: VISITOR_A });
    await t.mutation(api.analytics.recordView, { postId, visitor: VISITOR_A });
    await reader.as.mutation(api.analytics.recordView, { postId, visitor: VISITOR_B });
    await t.mutation(api.analytics.recordRead, { postId, visitor: VISITOR_A });
    await t.mutation(api.analytics.recordRead, { postId, visitor: VISITOR_A });
    // the author reading their own post doesn't count
    await admin.as.mutation(api.analytics.recordView, { postId, visitor: "author-visitor-1" });
    await admin.as.mutation(api.analytics.recordRead, { postId, visitor: "author-visitor-1" });
    await t.mutation(api.analytics.recordView, { postId: draftId, visitor: VISITOR_A });
    await expect(t.mutation(api.analytics.recordView, { postId, visitor: "x" })).rejects.toThrow(/visitor/);

    let post = await t.run((ctx) => ctx.db.get(postId));
    expect([post!.viewCount, post!.readCount]).toEqual([2, 1]);
    expect((await t.run((ctx) => ctx.db.get(draftId)))!.viewCount).toBeUndefined();

    // the next day the same visitor counts again; finishing without a view
    // on that day counts both
    vi.setSystemTime(Date.parse("2026-11-21T06:00:00Z"));
    await t.mutation(api.analytics.recordRead, { postId, visitor: VISITOR_A });
    post = await t.run((ctx) => ctx.db.get(postId));
    expect([post!.viewCount, post!.readCount]).toEqual([3, 2]);

    const rows = await t.run((ctx) => ctx.db.query("daily").collect());
    expect(rows.map((r) => [r.day, r.views, r.reads])).toEqual([
      ["2026-11-20", 2, 1],
      ["2026-11-21", 1, 1],
    ]);

    // old visits are cleared, the counts stay
    vi.setSystemTime(Date.parse("2026-11-25T06:00:00Z"));
    await t.mutation(internal.analytics.purgeVisits, {});
    expect(await t.run((ctx) => ctx.db.query("visits").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("daily").collect())).toHaveLength(2);
  });
});

describe("insights", () => {
  it("adds up the period, the one before it, each story and the audience", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-11-10T06:00:00Z"));
    const { t, admin, reader, postId } = await setup();

    // previous period (7 days ending 2026-11-15 → 11-09..11-15)
    await t.mutation(api.analytics.recordView, { postId, visitor: VISITOR_A });
    // a subscriber who joins, then one who joins and leaves
    const join = async (email: string) => {
      await t.mutation(api.subscribers.subscribe, { email });
      const sub = await t.run((ctx) =>
        ctx.db.query("subscribers").withIndex("by_email", (q) => q.eq("email", email)).unique(),
      );
      await t.mutation(api.subscribers.confirm, { token: sub!.token });
      return sub!.token;
    };
    await join("early@example.com");

    vi.setSystemTime(Date.parse("2026-11-20T06:00:00Z"));
    await t.mutation(api.analytics.recordView, { postId, visitor: VISITOR_A });
    await t.mutation(api.analytics.recordView, { postId, visitor: VISITOR_B });
    await t.mutation(api.analytics.recordRead, { postId, visitor: VISITOR_B });
    await reader.as.mutation(api.likes.togglePost, { postId });
    await reader.as.mutation(api.comments.add, { postId, body: "Good one" });
    const token = await join("brief@example.com");

    vi.setSystemTime(Date.parse("2026-11-21T06:00:00Z"));
    await t.mutation(api.subscribers.unsubscribe, { token });

    expect(await reader.as.query(api.analytics.insights, { days: 7, today: "2026-11-22" })).toBeNull();
    await expect(admin.as.query(api.analytics.insights, { days: 7, today: "22-11-2026" })).rejects.toThrow(/date/);

    const res = (await admin.as.query(api.analytics.insights, { days: 7, today: "2026-11-22" }))!;
    expect(res.days.map((d) => d.day)).toEqual(dayRange("2026-11-22", 7));
    expect(res.current).toEqual({ views: 2, reads: 1, likes: 1, comments: 1, subscribers: 1, unsubscribes: 1 });
    expect(res.previous).toMatchObject({ views: 1, reads: 0, subscribers: 1 });
    const on = (day: string) => res.days.find((d) => d.day === day)!;
    expect(on("2026-11-20")).toMatchObject({ views: 2, reads: 1, likes: 1, comments: 1, audience: 2 });
    expect(on("2026-11-21").audience).toBe(1);
    expect([res.audienceBefore, res.audience]).toEqual([1, 1]);
    expect(res.stories).toHaveLength(1);
    expect(res.stories[0]).toMatchObject({ title: "How is the code split up?", views: 2, reads: 1, allTimeViews: 3 });
  });
});

describe("the author and the subscriber list", () => {
  it("won't let the author subscribe, by address or while signed in", async () => {
    vi.useFakeTimers();
    const { t, admin } = await setup();
    await expect(t.mutation(api.subscribers.subscribe, { email: " SiddhantG2002@gmail.com" })).rejects.toThrow(
      /can't subscribe/,
    );
    await expect(admin.as.mutation(api.subscribers.subscribe, { email: "alias@example.com" })).rejects.toThrow(
      /can't subscribe/,
    );

    // an address added before the rule existed is left out of counts and sends
    await t.run((ctx) =>
      ctx.db.insert("subscribers", { email: ADMIN, status: "active", token: "old", confirmedAt: Date.now() }),
    );
    expect(await admin.as.query(api.subscribers.stats, {})).toEqual({ active: 0, pending: 0, unsubscribed: 0 });
    const page = await t.query(internal.subscribers.activePage, { cursor: null, size: 10 });
    expect(page.page).toHaveLength(0);
    expect(await admin.as.query(api.subscribers.recent, { limit: 10 })).toEqual([]);
  });
});

describe("bookmarks and the reader's page", () => {
  it("saves, lists newest first, and drops posts that go away", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-11-20T06:00:00Z"));
    const { t, admin, reader, postId, draftId } = await setup();
    const second = await admin.as.mutation(api.posts.save, {
      kind: "post",
      title: "How do the parts talk?",
      status: "published",
      contentHtml: "<p>Hi</p>",
      contentJson: "{}",
    });

    await expect(t.mutation(api.bookmarks.toggle, { postId })).rejects.toThrow(/Sign in/);
    await expect(reader.as.mutation(api.bookmarks.toggle, { postId: draftId })).rejects.toThrow(/available/);
    expect(await reader.as.mutation(api.bookmarks.toggle, { postId })).toEqual({ saved: true });
    vi.setSystemTime(Date.parse("2026-11-20T07:00:00Z"));
    expect(await reader.as.mutation(api.bookmarks.toggle, { postId: second.id })).toEqual({ saved: true });
    await reader.as.mutation(api.likes.togglePost, { postId });
    await reader.as.mutation(api.comments.add, { postId, body: "Saving this one" });
    // the author has a page too
    await admin.as.mutation(api.bookmarks.toggle, { postId: second.id });

    expect((await reader.as.query(api.posts.stats, { postId }))!.saved).toBe(true);
    expect((await t.query(api.posts.stats, { postId }))!.saved).toBe(false);

    let page = (await reader.as.query(api.bookmarks.profile, {}))!;
    expect(page.saved.map((c) => c.title)).toEqual(["How do the parts talk?", "How is the code split up?"]);
    expect(page.liked.map((c) => c.title)).toEqual(["How is the code split up?"]);
    expect(page.comments.map((c) => [c.body, c.post.title])).toEqual([["Saving this one", "How is the code split up?"]]);
    expect((await admin.as.query(api.bookmarks.profile, {}))!.saved).toHaveLength(1);
    expect(await t.query(api.bookmarks.profile, {})).toBeNull();

    // unsaving, unpublishing and deleting all take a post off the list
    expect(await reader.as.mutation(api.bookmarks.toggle, { postId })).toEqual({ saved: false });
    await admin.as.mutation(api.posts.save, { id: second.id, kind: "post", title: "How do the parts talk?", status: "draft" });
    page = (await reader.as.query(api.bookmarks.profile, {}))!;
    expect(page.saved).toEqual([]);
    await admin.as.mutation(api.posts.remove, { id: second.id });
    expect(await t.run((ctx) => ctx.db.query("bookmarks").collect())).toHaveLength(0);
  });
});
