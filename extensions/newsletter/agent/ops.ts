import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { dayKey } from "../convex/days";
import type { AgentClient, Entry, Ref } from "./client";
import { REPO_ROOT } from "./config";
import { plainTitle } from "./notion";
import {
  fromNotion,
  imageSources,
  markdownLinks,
  markdownToHtml,
  splitFrontmatter,
  toMarkdownFile,
  withId,
} from "./markdown";

// What the CLI and the MCP server both do, on top of the client.

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

/** "blogs/software-architectures" is a path; a Convex id is an id. */
export function refFrom(target: string): Ref {
  const t = target.trim();
  return /^[a-z0-9]{25,40}$/.test(t) ? { id: t } : { path: t };
}

const isRemote = (src: string) => /^(https?:)?\/\//i.test(src);

// A path as written in Markdown, on disk. Exports like Notion's escape it
// (%20 for spaces), hand-written files usually don't; try both.
function localPath(baseDir: string, src: string) {
  const plain = resolve(baseDir, src.split("#")[0].split("?")[0]);
  if (existsSync(plain)) return plain;
  try {
    return resolve(baseDir, decodeURI(src.split("#")[0].split("?")[0]));
  } catch {
    return plain;
  }
}

/* Uploaded images are remembered by content, so pushing a post again
   doesn't store its images again. The cache lives in node_modules/.cache. */
const CACHE = join(REPO_ROOT, "node_modules/.cache/newsletter-agent/images.json");
type Cache = Record<string, { storageId: string; url: string }>;
function readCache(): Cache {
  try {
    return JSON.parse(readFileSync(CACHE, "utf8")) as Cache;
  } catch {
    return {};
  }
}
function writeCache(cache: Cache) {
  try {
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  } catch {
    /* a cache that can't be written only costs a re-upload */
  }
}
async function stillThere(url: string) {
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    void res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

export async function uploadImage(client: AgentClient, bytes: Uint8Array, type: string) {
  const cache = readCache();
  const key = `${client.config.siteUrl}|${createHash("sha256").update(bytes).digest("hex")}`;
  const hit = cache[key];
  if (hit && (await stillThere(hit.url))) return { ...hit, reused: true };
  const stored = await client.upload(bytes, type);
  cache[key] = stored;
  writeCache(cache);
  return { ...stored, reused: false };
}

export async function uploadFile(client: AgentClient, file: string) {
  const type = TYPES[extname(file).toLowerCase()];
  if (!type) throw new Error(`${basename(file)} isn't an image this can upload (png, jpg, gif, webp, avif or svg).`);
  if (!existsSync(file)) throw new Error(`Can't find ${file}.`);
  return await uploadImage(client, new Uint8Array(readFileSync(file)), type);
}

async function uploadRemote(client: AgentClient, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download ${url} (${res.status}).`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!type.startsWith("image/")) throw new Error(`${url} isn't an image.`);
  return await uploadImage(client, new Uint8Array(await res.arrayBuffer()), type);
}

export type PushResult = {
  entry: Entry;
  created: boolean;
  link: string;
  uploaded: number;
  warnings: string[];
  idWritten: boolean;
};

/**
 * Create or update an entry from Markdown with frontmatter. Local images
 * (and a local or remote cover) are uploaded and their links rewritten. A
 * file's frontmatter gets the entry's id written into it, so later pushes
 * update the same entry even after a rename or a move.
 */
export async function pushMarkdown(
  client: AgentClient,
  input: { file?: string; markdown?: string; baseDir?: string },
): Promise<PushResult> {
  const file = input.file ? resolve(input.file) : undefined;
  if (!file && input.markdown === undefined) throw new Error("Give a Markdown file or Markdown text.");
  const text = file ? readFileSync(file, "utf8") : input.markdown!;
  const { data, body: raw } = splitFrontmatter(text);
  const baseDir = file ? dirname(file) : resolve(input.baseDir ?? process.cwd());
  const warnings: string[] = [];
  if (data.status === "published") {
    warnings.push("Saved as a draft: `status: published` is ignored here. Publish it from the admin.");
  }

  // from Notion (its MCP or an export): tags, callouts, property lines
  const { body, properties, omitted } = fromNotion(raw);
  if (omitted.length > 0) {
    warnings.push(`Left out (add images in the admin; push child pages as their own entries): ${omitted.join(", ")}.`);
  }
  const prop = (...keys: string[]) => keys.map((k) => properties[k]).find((v) => v?.trim());
  if (data.topic === undefined) {
    const topic = prop("Topic", "Tags", "Category")?.split(",")[0].trim();
    if (topic) data.topic = topic;
  }
  if (data.summary === undefined) {
    const summary = prop("Summary", "Description");
    if (summary) data.summary = summary;
  }
  if (Object.keys(properties).length > 0) {
    warnings.push(
      `Took Notion's property lines out of the text (${Object.keys(properties).join(", ")}); topic and summary come from Topic/Tags and Summary when the frontmatter doesn't set them.`,
    );
  }

  // images in the text
  const images = new Map<string, string>();
  let uploaded = 0;
  for (const src of imageSources(body)) {
    if (isRemote(src)) continue;
    if (src.startsWith("data:")) {
      warnings.push("An image is embedded as data; save it as a file and link to it instead.");
      continue;
    }
    const stored = await uploadFile(client, localPath(baseDir, src));
    images.set(src, stored.url);
    if (!stored.reused) uploaded++;
  }

  // links to other Markdown files: to that post once it's been pushed (its
  // file has an id), else just the text
  const links = new Map<string, string>();
  for (const href of markdownLinks(body)) {
    const target = localPath(baseDir, href);
    const id = existsSync(target) ? splitFrontmatter(readFileSync(target, "utf8")).data.id : undefined;
    const entry = id ? await client.call<Entry>("get", { id }).catch(() => null) : null;
    links.set(href, entry ? `/newsletter/${entry.path}` : "");
    if (!entry) {
      warnings.push(
        `${basename(target)} isn't pushed yet, so its link is plain text for now. Push it, then push this file again.`,
      );
    }
  }

  const converted = markdownToHtml(body, images, data.title, links);
  // a file name is the last resort; drop the 32-character id Notion adds
  const fromName = file ? basename(file, extname(file)).replace(/\s+[0-9a-f]{32}$/i, "").replace(/[-_]+/g, " ") : "";
  const title = plainTitle(data.title ?? converted.title ?? fromName);
  if (!title.trim()) throw new Error("Give it a title: `title:` in the frontmatter, or a first `# Heading`.");

  // the cover
  let coverImageId: string | null | undefined;
  if (data.cover === null) coverImageId = null;
  else if (typeof data.cover === "string") {
    let current: string | null = null;
    if (data.id && isRemote(data.cover)) {
      current = (await client.call<Entry>("get", { id: data.id }).catch(() => null))?.coverUrl ?? null;
    }
    if (current !== data.cover) {
      const stored = isRemote(data.cover)
        ? await uploadRemote(client, data.cover)
        : await uploadFile(client, localPath(baseDir, data.cover));
      coverImageId = stored.storageId;
      if (!stored.reused) uploaded++;
    }
  }

  const hasBody = converted.html.trim() !== "";
  const entry = await client.call<Entry & { created: boolean }>("upsert", {
    id: data.id,
    kind: data.kind,
    title,
    slug: data.slug,
    parent: data.parent,
    topic: data.topic,
    summary: data.summary,
    coverImageId,
    // an empty body leaves the text alone, so frontmatter-only files just
    // change settings
    contentHtml: hasBody ? converted.html : undefined,
  });

  let idWritten = false;
  if (file && data.id !== entry.id) {
    writeFileSync(file, withId(text, entry.id));
    idWritten = true;
  }
  const { created, ...rest } = entry;
  return { entry: rest, created, link: client.linkFor(rest), uploaded, warnings, idWritten };
}

/** An entry as a Markdown file's text, ready to edit and push back. */
export async function pullMarkdown(client: AgentClient, ref: Ref) {
  const entry = await client.call<Entry & { contentHtml: string }>("get", ref);
  return { entry, markdown: toMarkdownFile(entry) };
}

export function today() {
  return dayKey(Date.now());
}

/** The tree as indented lines, for people and agents to read. */
export function formatTree(entries: Entry[]): string {
  if (entries.length === 0) return "Nothing yet.";
  return entries
    .map((e) => {
      const depth = e.path.split("/").length - 1;
      const state = e.live ? "live" : e.status === "published" ? "published, but inside a draft" : "draft";
      const extra = e.kind === "post" ? `, ${e.views} views, ${e.likes} likes, ${e.comments} comments` : "";
      return `${"  ".repeat(depth)}- [${e.kind}] ${e.title}  (${e.path}, ${state}${extra}, id ${e.id})`;
    })
    .join("\n");
}
