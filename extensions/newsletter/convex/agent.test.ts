// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const KEY = "k".repeat(40);

function setup() {
  const t = convexTest(schema, modules);
  const call = async (op: string, body: unknown = {}, key = KEY) => {
    const res = await t.fetch(`/agent/${op}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as { ok: boolean; data?: any; error?: string } };
  };
  return { t, call };
}

beforeEach(() => {
  vi.stubEnv("NEWSLETTER_AGENT_KEY", KEY);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("agent endpoints", () => {
  it("refuse without the key, or when agent access is off", async () => {
    const { call } = setup();
    expect((await call("list", {}, "wrong-key")).status).toBe(401);
    // answers say which site reads this deployment, for the agent's links
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    expect((await call("list")).json).toMatchObject({ ok: true, site: "http://localhost:3000" });
    vi.stubEnv("NEWSLETTER_AGENT_KEY", "");
    expect((await call("list")).status).toBe(503);
  });

  it("create a tree from paths and update in place, as drafts", async () => {
    const { call } = setup();
    expect((await call("upsert", { title: "Blogs", kind: "folder" })).json.data).toMatchObject({
      created: true,
      path: "blogs",
      status: "draft",
    });
    await call("upsert", { title: "Software Architectures", kind: "series", parent: "blogs" });

    const missing = await call("upsert", { title: "Lost", parent: "nowhere/at-all" });
    expect(missing.status).toBe(400);
    expect(missing.json.error).toMatch(/no folder or series at nowhere\/at-all/);

    const first = await call("upsert", {
      title: "How is the code split up?",
      parent: "/newsletter/blogs/software-architectures/",
      topic: "Architecture",
      summary: "Layers, features or services.",
      contentHtml: "<h2>The short answer</h2><p>" + "word ".repeat(440) + "</p>",
    });
    expect(first.json.data).toMatchObject({
      created: true,
      path: "blogs/software-architectures/how-is-the-code-split-up",
      status: "draft",
      live: false,
      readingMinutes: 2,
    });

    // the same file again: found by its place, updated, not duplicated
    const again = await call("upsert", {
      title: "How is the code split up?",
      parent: "blogs/software-architectures",
      contentHtml: "<p>Shorter now.</p>",
    });
    expect(again.json.data).toMatchObject({ created: false, id: first.json.data.id, topic: "Architecture" });

    // by id, a new title keeps the link; null clears the topic
    const renamed = await call("upsert", { id: first.json.data.id, title: "How code is split", topic: null });
    expect(renamed.json.data).toMatchObject({
      slug: "how-is-the-code-split-up",
      topic: null,
      summary: "Layers, features or services.",
    });

    const list = (await call("list")).json.data as { path: string }[];
    expect(list.map((e) => e.path)).toEqual([
      "blogs",
      "blogs/software-architectures",
      "blogs/software-architectures/how-is-the-code-split-up",
    ]);
    const got = await call("get", { id: first.json.data.id });
    expect(got.json.data.contentHtml).toBe("<p>Shorter now.</p>");

    expect((await call("delete", { path: "blogs" })).json.error).toMatch(/inside it first/);
    expect((await call("delete", { id: first.json.data.id })).json.data).toEqual({
      deleted: "blogs/software-architectures/how-is-the-code-split-up",
    });
    expect((await call("get", { id: first.json.data.id })).status).toBe(400);
  });

  it("stores images, reorders and reports stats", async () => {
    const { t, call } = setup();
    const res = await t.fetch("/agent/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "image/png" },
      body: new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
    });
    const upload = (await res.json()) as { data: { storageId: string; url: string } };
    expect(upload.data.url).toMatch(/^https?:\/\//);
    const notImage = await t.fetch("/agent/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "text/plain" },
      body: "hi",
    });
    expect(notImage.status).toBe(400);

    const a = await call("upsert", { title: "A", coverImageId: upload.data.storageId });
    expect(a.json.data.coverUrl).toBe(upload.data.url);
    await call("upsert", { title: "B" });
    await call("move", { path: "b", direction: "up" });
    expect(((await call("list")).json.data as { slug: string }[]).map((e) => e.slug)).toEqual(["b", "a"]);
    expect((await call("move", { path: "b", direction: "sideways" })).status).toBe(400);

    // the agent reuses an uploaded image, so deleting one post or changing
    // its cover must leave the file for the others
    await call("upsert", { title: "C", coverImageId: upload.data.storageId });
    await call("upsert", { title: "D", contentHtml: `<p><img src="${upload.data.url}"></p>` });
    await call("delete", { path: "a" });
    expect((await call("get", { path: "c" })).json.data.coverUrl).toBe(upload.data.url);
    await call("upsert", { title: "C", coverImageId: null });
    expect(await t.run((ctx) => ctx.storage.getUrl(upload.data.storageId as never))).toBe(upload.data.url);
    await call("upsert", { title: "C", coverImageId: upload.data.storageId });
    await call("delete", { path: "d" });
    await call("delete", { path: "c" });
    expect(await t.run((ctx) => ctx.storage.getUrl(upload.data.storageId as never))).toBeNull();
    // a cover whose file is already gone can still be replaced or deleted
    const e = await call("upsert", { title: "E", coverImageId: upload.data.storageId });
    expect(e.status).toBe(200);
    expect((await call("upsert", { title: "E", coverImageId: null })).status).toBe(200);

    const stats = await call("insights", { days: 7, today: "2026-11-22" });
    expect(stats.json.data.days).toHaveLength(7);
    expect((await call("nonsense")).status).toBe(404);
  });

  it("only ever writes drafts, and leaves published entries alone", async () => {
    const { t, call } = setup();
    // asking to publish does nothing: there's no status to set
    const post = await call("upsert", { title: "Eager", status: "published", contentHtml: "<p>Hi</p>" });
    expect(post.json.data).toMatchObject({ status: "draft", live: false });
    expect((await call("status", { path: "eager", status: "published" })).status).toBe(404);

    // once the author publishes it in the admin, the agent can't touch it
    await t.run((ctx) => ctx.db.patch(post.json.data.id, { status: "published" }));
    await call("upsert", { title: "Other" });
    for (const [op, body] of [
      ["upsert", { title: "Eager", contentHtml: "<p>Overwritten</p>" }],
      ["upsert", { id: post.json.data.id, title: "Renamed" }],
      ["move", { path: "eager", direction: "down" }],
      ["delete", { path: "eager" }],
    ] as const) {
      const res = await call(op, body);
      expect(res.status).toBe(400);
      expect(res.json.error).toMatch(/eager is published, so the agent can't change it/);
    }
    const got = (await call("get", { path: "eager" })).json.data;
    expect(got).toMatchObject({ title: "Eager", status: "published", contentHtml: "<p>Hi</p>" });

    // new parts can still go into a published series, as drafts
    await t.run(async (ctx) => {
      const id = await ctx.db.insert("posts", {
        kind: "series", title: "Live series", slug: "live-series", order: 9, status: "published",
        likeCount: 0, commentCount: 0, updatedAt: Date.now(), publishedAt: Date.now(),
      });
      return id;
    });
    expect((await call("upsert", { title: "Part 2", parent: "live-series" })).json.data).toMatchObject({
      path: "live-series/part-2",
      status: "draft",
    });
  });

  it("sends the test email only for something published", async () => {
    const { call } = setup();
    await call("upsert", { title: "Draft one", contentHtml: "<p>Hi</p>" });
    const res = await call("test-email", { path: "draft-one" });
    expect(res.json.error).toMatch(/Publish the post/);
  });
});
