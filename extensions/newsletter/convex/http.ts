import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

// Serves Convex Auth's OAuth routes, including Google's callback at
// <deployment>.convex.site/api/auth/callback/google
const http = httpRouter();

auth.addHttpRoutes(http);

/* ───────────────────────────── writing agent ─────────────────────────────
   POST <deployment>.convex.site/agent/<op>, with
   "Authorization: Bearer <NEWSLETTER_AGENT_KEY>". Used by the MCP server and
   CLI in extensions/newsletter/agent. Body is JSON, except for /agent/upload,
   which takes an image's bytes. Answers {ok: true, data, site} or
   {ok: false, error}. */

const MAX_UPLOAD = 15 * 1024 * 1024;

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Compare without stopping at the first differing character
function sameKey(given: string, expected: string) {
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (given.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return diff === 0;
}

const str = (x: unknown) => (typeof x === "string" ? x : undefined);
const strOrNull = (x: unknown) => (x === null ? null : str(x));

function ref(body: Record<string, unknown>) {
  return { id: str(body.id), path: str(body.path) };
}

http.route({
  pathPrefix: "/agent/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const key = process.env.NEWSLETTER_AGENT_KEY;
    if (!key || key.length < 32) {
      return reply(503, {
        ok: false,
        error: "Agent access is off. Run `npm run newsletter:agent-key` to set NEWSLETTER_AGENT_KEY.",
      });
    }
    const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!sameKey(given, key)) return reply(401, { ok: false, error: "Wrong or missing agent key." });

    const op = new URL(req.url).pathname.slice("/agent/".length);
    try {
      if (op === "upload") {
        const type = req.headers.get("content-type") ?? "";
        if (!type.startsWith("image/")) return reply(400, { ok: false, error: "Upload an image." });
        const blob = await req.blob();
        if (blob.size === 0 || blob.size > MAX_UPLOAD) {
          return reply(400, { ok: false, error: "Images must be between 1 byte and 15 MB." });
        }
        const storageId = await ctx.storage.store(blob);
        return reply(200, { ok: true, data: { storageId, url: await ctx.storage.getUrl(storageId) } });
      }

      const raw: unknown = await req.json().catch(() => null);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return reply(400, { ok: false, error: "Send a JSON object." });
      }
      const body = raw as Record<string, unknown>;

      let data: unknown;
      switch (op) {
        case "list":
          data = await ctx.runQuery(internal.agent.list, {});
          break;
        case "get":
          data = await ctx.runQuery(internal.agent.get, ref(body));
          break;
        case "topics":
          data = await ctx.runQuery(internal.agent.topics, {});
          break;
        case "upsert": {
          const title = str(body.title);
          if (!title) return reply(400, { ok: false, error: "A title is required." });
          const kind = str(body.kind);
          const cover = body.coverImageId;
          data = await ctx.runMutation(internal.agent.upsert, {
            id: str(body.id),
            kind: kind === "post" || kind === "series" || kind === "folder" ? kind : undefined,
            title,
            slug: str(body.slug),
            parent: strOrNull(body.parent),
            topic: strOrNull(body.topic),
            summary: strOrNull(body.summary),
            // checked as a storage id by the mutation's validator
            coverImageId: cover === null ? null : (str(cover) as never),
            // no status: the agent only writes drafts (see agent.ts)
            contentHtml: str(body.contentHtml),
          });
          break;
        }
        case "move": {
          const direction = str(body.direction);
          if (direction !== "up" && direction !== "down") {
            return reply(400, { ok: false, error: "direction must be up or down." });
          }
          data = await ctx.runMutation(internal.agent.move, { ...ref(body), direction });
          break;
        }
        case "delete":
          data = await ctx.runMutation(internal.agent.remove, ref(body));
          break;
        case "insights": {
          const days = body.days === 7 || body.days === 90 ? body.days : 30;
          const today = str(body.today);
          if (!today) return reply(400, { ok: false, error: "today (YYYY-MM-DD) is required." });
          data = await ctx.runQuery(internal.agent.insights, { days, today });
          break;
        }
        case "test-email": {
          const postId = await ctx.runQuery(internal.agent.idOf, ref(body));
          data = await ctx.runAction(internal.emails.sendTestToAuthor, { postId });
          break;
        }
        default:
          return reply(404, { ok: false, error: `Unknown operation: ${op}` });
      }
      // SITE_URL says which site reads this deployment (localhost for dev),
      // so the agent's links open where the entry actually is
      return reply(200, { ok: true, data, site: process.env.SITE_URL });
    } catch (e) {
      if (e instanceof ConvexError) {
        return reply(400, { ok: false, error: typeof e.data === "string" ? e.data : JSON.stringify(e.data) });
      }
      const message = e instanceof Error ? e.message : String(e);
      // argument validation errors are the caller's fault, not the server's
      const status = /validator|ArgumentValidationError|Invalid argument/i.test(message) ? 400 : 500;
      return reply(status, { ok: false, error: message });
    }
  }),
});

export default http;
