// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const ADMIN = "siddhantg2002@gmail.com";

async function setup() {
  const t = convexTest(schema, modules);
  const makeUser = async (email: string, verified = true, name = email.split("@")[0]) => {
    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        email,
        name,
        ...(verified ? { emailVerificationTime: Date.now() } : {}),
      }),
    );
    // Convex Auth's identity subject is "<userId>|<sessionId>"
    return { id, as: t.withIdentity({ subject: `${id}|session-${id}` }) };
  };
  const admin = await makeUser(ADMIN, true, "Siddhant");
  const reader = await makeUser("reader@example.com");
  const other = await makeUser("other@example.com");
  return { t, admin, reader, other, makeUser };
}

type Asker = Awaited<ReturnType<typeof setup>>["admin"]["as"];

async function publishTree(as: Asker) {
  const blogs = await as.mutation(api.posts.save, { kind: "folder", title: "Blogs", status: "published" });
  const series = await as.mutation(api.posts.save, {
    kind: "series",
    title: "Software Architectures",
    parentId: blogs.id,
    status: "published",
  });
  const parts: Id<"posts">[] = [];
  for (const title of ["How is the code split up?", "How do the parts talk?", "Where does the code actually run?"]) {
    const p = await as.mutation(api.posts.save, {
      kind: "post",
      title,
      parentId: series.id,
      status: "published",
      contentHtml: "<p>" + "word ".repeat(450) + "</p>",
      contentJson: "{}",
    });
    parts.push(p.id);
  }
  return { blogs: blogs.id, series: series.id, parts };
}

describe("admin gate", () => {
  it("lets only the verified admin account write", async () => {
    const { t, admin, reader, makeUser } = await setup();
    await expect(
      reader.as.mutation(api.posts.save, { kind: "post", title: "Nope", status: "draft" }),
    ).rejects.toThrow(/author/);
    await expect(t.mutation(api.posts.save, { kind: "post", title: "Nope", status: "draft" })).rejects.toThrow();

    // the admin address without Google's verification is not enough
    const impostor = await makeUser(ADMIN, false);
    await expect(
      impostor.as.mutation(api.posts.save, { kind: "post", title: "Nope", status: "draft" }),
    ).rejects.toThrow(/author/);

    const ok = await admin.as.mutation(api.posts.save, { kind: "post", title: "Hello world", status: "draft" });
    expect(ok.slug).toBe("hello-world");
    expect(await reader.as.query(api.posts.adminTree, {})).toBeNull();
    expect((await admin.as.query(api.posts.adminTree, {}))?.length).toBe(1);
    expect((await admin.as.query(api.users.me, {}))?.isAdmin).toBe(true);
    expect((await reader.as.query(api.users.me, {}))?.isAdmin).toBe(false);
  });
});

describe("nested posts", () => {
  it("resolves slug paths and knows a part's place in its series", async () => {
    const { t, admin } = await setup();
    await publishTree(admin.as);
    const part = await t.query(api.posts.byPath, {
      path: ["blogs", "software-architectures", "how-do-the-parts-talk"],
    });
    expect(part?.title).toBe("How do the parts talk?");
    expect(part?.series?.index).toBe(1);
    expect(part?.series?.parts.map((p) => p.path.join("/"))).toEqual([
      "blogs/software-architectures/how-is-the-code-split-up",
      "blogs/software-architectures/how-do-the-parts-talk",
      "blogs/software-architectures/where-does-the-code-actually-run",
    ]);
    expect(part?.ancestors.map((a) => a.title)).toEqual(["Blogs", "Software Architectures"]);
    expect(part?.readingMinutes).toBe(2);

    const series = await t.query(api.posts.byPath, { path: ["blogs", "software-architectures"] });
    expect(series?.children.map((c) => c.title)).toHaveLength(3);
    expect(await t.query(api.posts.byPath, { path: ["blogs", "nope"] })).toBeNull();
  });

  it("hides everything under a draft", async () => {
    const { t, admin } = await setup();
    const { series } = await publishTree(admin.as);
    await admin.as.mutation(api.posts.save, {
      id: series,
      kind: "series",
      title: "Software Architectures",
      parentId: (await t.run((ctx) => ctx.db.get(series)))!.parentId,
      status: "draft",
    });
    const published = await t.query(api.posts.published, {});
    expect(published.map((p) => p.title)).toEqual(["Blogs"]);
    expect(
      await t.query(api.posts.byPath, { path: ["blogs", "software-architectures", "how-is-the-code-split-up"] }),
    ).toBeNull();
  });

  it("keeps slugs unique, avoids reserved ones and refuses loops", async () => {
    const { admin } = await setup();
    const a = await admin.as.mutation(api.posts.save, { kind: "post", title: "Admin", status: "draft" });
    expect(a.slug).toBe("admin-2");
    const b1 = await admin.as.mutation(api.posts.save, { kind: "folder", title: "Notes", status: "draft" });
    const b2 = await admin.as.mutation(api.posts.save, { kind: "folder", title: "Notes", status: "draft" });
    expect(b2.slug).toBe("notes-2");
    const child = await admin.as.mutation(api.posts.save, {
      kind: "folder",
      title: "Inner",
      parentId: b1.id,
      status: "draft",
    });
    await expect(
      admin.as.mutation(api.posts.save, { id: b1.id, kind: "folder", title: "Notes", parentId: child.id, status: "draft" }),
    ).rejects.toThrow(/inside itself/);
    await expect(
      admin.as.mutation(api.posts.save, { kind: "post", title: "x", parentId: a.id, status: "draft" }),
    ).rejects.toThrow(/series or a folder/);
    await expect(admin.as.mutation(api.posts.remove, { id: b1.id })).rejects.toThrow(/inside it/);
  });

  it("reorders siblings", async () => {
    const { t, admin } = await setup();
    const { series, parts } = await publishTree(admin.as);
    await admin.as.mutation(api.posts.move, { id: parts[2], direction: "up" });
    const s = await t.query(api.posts.byPath, { path: ["blogs", "software-architectures"] });
    expect(s?.children.map((c) => c.id)).toEqual([parts[0], parts[2], parts[1]]);
    expect(series).toBeTruthy();
  });
});

describe("likes", () => {
  it("toggles once per reader and needs sign-in", async () => {
    const { t, admin, reader, other } = await setup();
    const { parts } = await publishTree(admin.as);
    await expect(t.mutation(api.likes.togglePost, { postId: parts[0] })).rejects.toThrow(/Sign in/);
    expect((await reader.as.mutation(api.likes.togglePost, { postId: parts[0] })).likeCount).toBe(1);
    expect((await other.as.mutation(api.likes.togglePost, { postId: parts[0] })).likeCount).toBe(2);
    expect((await reader.as.mutation(api.likes.togglePost, { postId: parts[0] })).likeCount).toBe(1);
    const path = ["blogs", "software-architectures", "how-is-the-code-split-up"];
    expect((await other.as.query(api.posts.byPath, { path }))?.liked).toBe(true);
    expect((await reader.as.query(api.posts.byPath, { path }))?.liked).toBe(false);
  });
});

describe("nested comments", () => {
  it("threads replies to any depth and keeps counts right", async () => {
    vi.useFakeTimers();
    const { admin, reader, other } = await setup();
    const { parts } = await publishTree(admin.as);
    const postId = parts[0];

    const top = await reader.as.mutation(api.comments.add, { postId, body: "First!" });
    vi.advanceTimersByTime(6000);
    const r1 = await other.as.mutation(api.comments.add, { postId, parentId: top, body: "Reply" });
    vi.advanceTimersByTime(6000);
    const r2 = await reader.as.mutation(api.comments.add, { postId, parentId: r1, body: "Reply to reply" });
    // too fast: the same reader again within five seconds
    await expect(reader.as.mutation(api.comments.add, { postId, body: "spam" })).rejects.toThrow(/Slow down/);
    vi.advanceTimersByTime(6000);
    const r3 = await other.as.mutation(api.comments.add, { postId, parentId: r2, body: "Deeper" });

    let list = await reader.as.query(api.comments.forPost, { postId });
    expect(list.comments.find((c) => c.id === r3)?.depth).toBe(3);
    expect(list.comments.find((c) => c.id === top)?.replyCount).toBe(1);

    // likes on comments
    await reader.as.mutation(api.likes.toggleComment, { commentId: r3 });
    list = await reader.as.query(api.comments.forPost, { postId });
    expect(list.comments.find((c) => c.id === r3)).toMatchObject({ likeCount: 1, liked: true });

    // only the author edits; anyone else is refused
    await expect(reader.as.mutation(api.comments.edit, { id: r1, body: "hijack" })).rejects.toThrow(/own/);
    await other.as.mutation(api.comments.edit, { id: r1, body: "Reply (edited)" });

    // deleting a comment with replies leaves a stub
    await other.as.mutation(api.comments.remove, { id: r1 });
    list = await reader.as.query(api.comments.forPost, { postId });
    const stub = list.comments.find((c) => c.id === r1);
    expect(stub).toMatchObject({ deleted: "author", body: null, author: null });

    // removing the rest of that branch clears the stub too
    await other.as.mutation(api.comments.remove, { id: r3 });
    await reader.as.mutation(api.comments.remove, { id: r2 });
    list = await reader.as.query(api.comments.forPost, { postId });
    expect(list.comments.map((c) => c.id)).toEqual([top]);
    expect(list.comments[0].replyCount).toBe(0);

    // the post's count follows live comments
    const post = await reader.as.query(api.posts.byPath, {
      path: ["blogs", "software-architectures", "how-is-the-code-split-up"],
    });
    expect(post?.commentCount).toBe(1);

    // admin can moderate anyone's comment
    await admin.as.mutation(api.comments.moderate, { id: top });
    list = await reader.as.query(api.comments.forPost, { postId });
    expect(list.comments).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("subscribers", () => {
  it("confirms, unsubscribes, and doesn't reveal who is on the list", async () => {
    vi.useFakeTimers();
    const { t, admin } = await setup();
    expect(await t.mutation(api.subscribers.subscribe, { email: " Fan@Example.com " })).toEqual({ ok: true });
    await expect(t.mutation(api.subscribers.subscribe, { email: "not-an-email" })).rejects.toThrow(/look right/);
    const sub = await t.run((ctx) =>
      ctx.db.query("subscribers").withIndex("by_email", (q) => q.eq("email", "fan@example.com")).unique(),
    );
    expect(sub?.status).toBe("pending");
    expect(sub?.token).toMatch(/^[0-9a-f]{48}$/);

    expect(await t.mutation(api.subscribers.confirm, { token: sub!.token })).toMatchObject({ status: "confirmed" });
    expect(await t.mutation(api.subscribers.subscribe, { email: "fan@example.com" })).toEqual({ ok: true });
    expect(await admin.as.query(api.subscribers.stats, {})).toEqual({ active: 1, pending: 0, unsubscribed: 0 });
    expect(await t.query(api.subscribers.stats, {})).toBeNull();

    expect(await t.mutation(api.subscribers.unsubscribe, { token: sub!.token })).toMatchObject({
      status: "unsubscribed",
    });
    expect(await t.mutation(api.subscribers.confirm, { token: "nope" })).toEqual({ status: "invalid" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
  });
});
