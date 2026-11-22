#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AgentClient, type Entry, type Ref } from "./client";
import { loadConfig } from "./config";
import { formatTree, pullMarkdown, pushMarkdown, today, uploadFile } from "./ops";

// The newsletter as MCP tools, for an agent that writes posts from Markdown.
// Runs over stdio: `npx tsx extensions/newsletter/agent/mcp.ts` (the repo's
// .mcp.json does this for Claude Code). Logs go to stderr; stdout is the
// protocol.

const FRONTMATTER_HELP = `Frontmatter (all optional):
  title: Post title            (or use a first "# Heading")
  kind: post | series | folder (default post)
  parent: blogs/software-architectures   (path of a folder or series; omit for the top level)
  slug: link-name              (default: made from the title; kept on later updates)
  topic: Architecture
  summary: One line for cards, emails and link previews
  cover: ./cover.png           (local file or https URL; "none" removes it)
  id: ...                      (written back automatically after the first push)
Everything is saved as a draft; the author publishes from the admin.
Published entries can't be changed here. Local images in the text are
uploaded and relinked. An empty body leaves an existing draft's text alone,
so frontmatter-only pushes change settings.`;

const ref = {
  id: z.string().optional().describe("The entry's id"),
  path: z.string().optional().describe('Or its path, like "blogs/software-architectures/how-is-the-code-split-up"'),
};

function refOf(args: Ref): Ref {
  if (!args.id && !args.path) throw new Error("Give an id or a path.");
  return { id: args.id, path: args.path };
}

function text(t: string) {
  return { content: [{ type: "text" as const, text: t }] };
}

function fail(e: unknown) {
  return { content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }], isError: true };
}

function summary(e: Entry, link: string) {
  const state = e.live ? "live" : e.status === "published" ? "published but inside a draft, so not live yet" : "draft";
  return `${e.kind} "${e.title}" at ${e.path} (${state}), id ${e.id}\n${link}`;
}

let client: AgentClient | null = null;
function api() {
  client ??= new AgentClient(loadConfig());
  return client;
}

async function run<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    return fail(e);
  }
}

const server = new McpServer(
  { name: "newsletter", version: "1.0.0" },
  {
    instructions: `Siddhant's newsletter at sidhxntt.dev/newsletter: folders (like Blogs) hold series and posts; a series holds parts read in order.
Write each post as a Markdown file with frontmatter and push it with push_markdown; pushing the same file again updates it.
From Notion: fetch the page with the Notion MCP and pass its content as \`markdown\`, with frontmatter giving the title (from the page's properties) and parent. Notion's tags are converted; its images, files and child pages are left out (the author adds images in the admin; push each child page as its own entry). A Notion page with child pages is a series (or a folder), its children the parts. To update a draft pushed earlier, pass its id from list_posts.
Start with list_posts to see the tree and list_topics to reuse topics. Create a missing folder or series with save_entry first.
Everything is saved as a draft, and this server can't publish: the author reviews drafts and publishes them in the admin. Give them the draft's link.
Published entries are read-only here (the author edits them in the admin), so to revise a live post, tell the author rather than pushing.
Never delete unless asked. Emailing subscribers is left to the author in the admin; send_test_email only reaches the author.`,
  },
);

server.registerTool(
  "list_posts",
  {
    title: "List the newsletter",
    description:
      "Every folder, series and post in reading order, with its path, whether it's live, its id and its counts.",
    annotations: { readOnlyHint: true },
  },
  () =>
    run(async () => {
      const entries = await api().call<Entry[]>("list");
      return { ...text(formatTree(entries)), structuredContent: { entries } };
    }),
);

server.registerTool(
  "get_post",
  {
    title: "Get a post as Markdown",
    description:
      "One entry as a Markdown file (frontmatter with its id and settings, then its text), ready to edit and push back. Pass save_to to write it to a file.",
    inputSchema: {
      ...ref,
      save_to: z.string().optional().describe("A .md file path to write it to"),
    },
    annotations: { readOnlyHint: true },
  },
  (args) =>
    run(async () => {
      const { markdown } = await pullMarkdown(api(), refOf(args));
      if (args.save_to) {
        const file = resolve(args.save_to);
        writeFileSync(file, markdown);
        return text(`Saved to ${file}.\n\n${markdown}`);
      }
      return text(markdown);
    }),
);

server.registerTool(
  "push_markdown",
  {
    title: "Create or update from Markdown",
    description: `Create or update a draft post, series or folder from Markdown. Pass a file (preferred: its id is written back so later pushes update the same entry) or the Markdown text, such as a page fetched from Notion. Pushing again updates the draft in place; nothing is duplicated.\n\n${FRONTMATTER_HELP}`,
    inputSchema: {
      file: z.string().optional().describe("Path to a .md file"),
      markdown: z.string().optional().describe("Or the Markdown itself, with frontmatter"),
      base_dir: z.string().optional().describe("Where relative image paths in `markdown` start from"),
    },
    annotations: { idempotentHint: true },
  },
  (args) =>
    run(async () => {
      const res = await pushMarkdown(api(), {
        file: args.file,
        markdown: args.markdown,
        baseDir: args.base_dir,
      });
      const lines = [
        `${res.created ? "Created" : "Updated"} ${summary(res.entry, res.link)}`,
        res.uploaded ? `Uploaded ${res.uploaded} image${res.uploaded === 1 ? "" : "s"}.` : "",
        res.idWritten ? "Wrote its id into the file's frontmatter." : "",
        ...res.warnings,
      ];
      return { ...text(lines.filter(Boolean).join("\n")), structuredContent: { ...res } };
    }),
);

server.registerTool(
  "save_entry",
  {
    title: "Create or change an entry's settings",
    description:
      "Create a folder or series as a draft (or change a draft's title, place, topic or summary) without Markdown. Found by id, or else by parent and title, so it's safe to repeat.",
    inputSchema: {
      id: z.string().optional(),
      title: z.string(),
      kind: z.enum(["post", "series", "folder"]).optional(),
      parent: z.string().nullable().optional().describe("Folder or series path; null for the top level"),
      slug: z.string().optional(),
      topic: z.string().nullable().optional(),
      summary: z.string().nullable().optional(),
    },
    annotations: { idempotentHint: true },
  },
  (args) =>
    run(async () => {
      const entry = await api().call<Entry & { created: boolean }>("upsert", args);
      return text(`${entry.created ? "Created" : "Updated"} ${summary(entry, api().linkFor(entry))}`);
    }),
);

server.registerTool(
  "move_entry",
  {
    title: "Reorder",
    description: "Move a draft up or down among its siblings (parts of a series read in this order).",
    inputSchema: { ...ref, direction: z.enum(["up", "down"]) },
    annotations: { idempotentHint: false },
  },
  (args) =>
    run(async () => {
      const entry = await api().call<Entry>("move", { ...refOf(args), direction: args.direction });
      return text(`Moved ${args.direction}: ${entry.path} is now number ${entry.order + 1} in its place.`);
    }),
);

server.registerTool(
  "delete_entry",
  {
    title: "Delete",
    description:
      "Delete a draft. It can't be undone. A folder or series must be empty first; published entries can't be deleted here. Only call this when the author has asked for the deletion.",
    inputSchema: { ...ref, confirm: z.literal(true).describe("Must be true") },
    annotations: { destructiveHint: true },
  },
  (args) =>
    run(async () => {
      const res = await api().call<{ deleted: string }>("delete", refOf(args));
      return text(`Deleted ${res.deleted}.`);
    }),
);

server.registerTool(
  "list_topics",
  { title: "Topics", description: "Topics already in use, to reuse rather than invent near-duplicates.", annotations: { readOnlyHint: true } },
  () => run(async () => text((await api().call<string[]>("topics")).join("\n") || "No topics yet.")),
);

server.registerTool(
  "upload_image",
  {
    title: "Upload an image",
    description: "Store a local image and get its address, for linking by hand. push_markdown already does this for images in a post.",
    inputSchema: { file: z.string() },
  },
  (args) => run(async () => text((await uploadFile(api(), resolve(args.file))).url)),
);

server.registerTool(
  "get_insights",
  {
    title: "Stats",
    description: "Views, reads, likes, comments and subscribers for the last 7, 30 or 90 days, compared with the period before, and each story's numbers.",
    inputSchema: { days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional() },
    annotations: { readOnlyHint: true },
  },
  (args) =>
    run(async () => {
      type Totals = Record<"views" | "reads" | "likes" | "comments" | "subscribers" | "unsubscribes", number>;
      const days = args.days ?? 30;
      const data = await api().call<{
        current: Totals;
        previous: Totals;
        audience: number;
        stories: { title: string; path: string[]; views: number; reads: number; likes: number; comments: number }[];
      }>("insights", { days, today: today() });
      const c = data.current;
      const p = data.previous;
      const lines = [
        `Last ${days} days (previous ${days} in brackets):`,
        `Views ${c.views} (${p.views}), reads ${c.reads} (${p.reads}), likes ${c.likes} (${p.likes}), comments ${c.comments} (${p.comments})`,
        `Subscribers now ${data.audience}; ${c.subscribers} joined, ${c.unsubscribes} left`,
        "",
        "Stories by views:",
        ...data.stories.map(
          (s) => `- ${s.title} (${s.path.join("/")}): ${s.views} views, ${s.reads} reads, ${s.likes} likes, ${s.comments} comments`,
        ),
      ];
      return { ...text(lines.join("\n")), structuredContent: data };
    }),
);

server.registerTool(
  "send_test_email",
  {
    title: "Send a test email",
    description:
      "Email a published post to the author's own address only, to check how it looks. Sending to subscribers is done by the author from the admin.",
    inputSchema: ref,
  },
  (args) =>
    run(async () => {
      const res = await api().call<{ to: string; skipped?: boolean }>("test-email", refOf(args));
      return text(res.skipped ? "Email isn't set up on the deployment (no AUTOSEND_API_KEY), so nothing was sent." : `Test sent to ${res.to}.`);
    }),
);

await server.connect(new StdioServerTransport());
console.error("newsletter MCP server ready");
