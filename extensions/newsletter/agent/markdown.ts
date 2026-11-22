import { Marked, type Tokens } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { parse as parseYaml } from "yaml";
import { fromNotionMarkdown } from "./notion";

// Markdown in, the newsletter's HTML out (the same shapes the editor
// writes, so a pushed post still opens in the admin editor), and back again
// for pulling a post down to a file.

/* ───────────────────────────── frontmatter ────────────────────────────── */

export type Frontmatter = {
  id?: string;
  title?: string;
  kind?: "post" | "series" | "folder";
  parent?: string | null;
  slug?: string;
  topic?: string | null;
  summary?: string | null;
  cover?: string | null | false;
  status?: "draft" | "published";
};

const FENCE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function splitFrontmatter(text: string): { data: Frontmatter; body: string } {
  const m = FENCE.exec(text);
  if (!m) return { data: {}, body: text };
  const parsed: unknown = parseYaml(m[1]) ?? {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The frontmatter must be key: value lines.");
  const raw = parsed as Record<string, unknown>;
  const data: Frontmatter = {};
  const text_ = (k: string) => (raw[k] === undefined ? undefined : raw[k] === null ? null : String(raw[k]).trim());
  if (raw.id !== undefined) data.id = String(raw.id);
  if (raw.title !== undefined) data.title = String(raw.title);
  if (raw.kind !== undefined) {
    const kind = String(raw.kind).toLowerCase();
    if (kind !== "post" && kind !== "series" && kind !== "folder") throw new Error(`kind must be post, series or folder, not ${kind}.`);
    data.kind = kind;
  }
  if (raw.parent !== undefined) data.parent = text_("parent") || null;
  if (raw.slug !== undefined) data.slug = String(raw.slug);
  if (raw.topic !== undefined) data.topic = text_("topic") || null;
  const summary = raw.summary ?? raw.excerpt ?? raw.description;
  if (summary !== undefined) data.summary = summary === null ? null : String(summary).trim() || null;
  if (raw.cover !== undefined) {
    const cover = raw.cover;
    data.cover = cover === null || cover === false || cover === "none" || cover === "" ? null : String(cover);
  }
  if (raw.status !== undefined) {
    const status = String(raw.status).toLowerCase();
    if (status !== "draft" && status !== "published") throw new Error(`status must be draft or published, not ${status}.`);
    data.status = status;
  }
  return { data, body: text.slice(m[0].length) };
}

/** The file with `id: <id>` set in its frontmatter (added if missing). */
export function withId(text: string, id: string): string {
  const m = FENCE.exec(text);
  if (!m) return `---\nid: ${id}\n---\n\n${text}`;
  const lines = m[1].split(/\r?\n/);
  const at = lines.findIndex((l) => /^id\s*:/.test(l));
  if (at >= 0) lines[at] = `id: ${id}`;
  else lines.unshift(`id: ${id}`);
  return `---\n${lines.join("\n")}\n---\n${text.slice(m[0].length)}`;
}

/* ──────────────────────────── Markdown → HTML ─────────────────────────── */

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function marked(images: Map<string, string>, links = new Map<string, string>()) {
  return new Marked({
    gfm: true,
    renderer: {
      // checklists in the editor's own shape
      list(token: Tokens.List) {
        if (!token.items.some((i) => i.task)) return false;
        const items = token.items
          .map((item) => {
            const tokens = item.tokens.filter((t) => t.type !== "checkbox");
            let inner = this.parser.parse(tokens).trim();
            if (!/^<(p|ul|ol|pre|blockquote|h\d|table)\b/.test(inner)) inner = `<p>${inner}</p>`;
            const checked = !!item.checked;
            return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? " checked" : ""}><span></span></label><div>${inner}</div></li>`;
          })
          .join("");
        return `<ul data-type="taskList">${items}</ul>\n`;
      },
      // links to other local Markdown files, pointed at their posts ("" when
      // that post doesn't exist yet: the text stays, without the link)
      link({ href, title, tokens }: Tokens.Link) {
        const to = links.get(href);
        if (to === undefined) return false;
        const text = this.parser.parseInline(tokens);
        return to ? `<a href="${escapeAttr(to)}"${title ? ` title="${escapeAttr(title)}"` : ""}>${text}</a>` : text;
      },
      image({ href, title, text }: Tokens.Image) {
        const src = images.get(href) ?? href;
        return `<img src="${escapeAttr(src)}" alt="${escapeAttr(text)}"${title ? ` title="${escapeAttr(title)}"` : ""}>`;
      },
    },
  });
}

/** Every image a Markdown body points at, Markdown or HTML syntax. */
export function imageSources(markdown: string): string[] {
  const found = new Set<string>();
  const m = new Marked({ gfm: true });
  m.walkTokens(m.lexer(markdown), (t) => {
    if (t.type === "image") found.add((t as Tokens.Image).href);
    if (t.type === "html") for (const x of t.raw.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) found.add(x[1]);
  });
  return [...found];
}

/** Links to other local Markdown files, as written (Notion links its pages this way). */
export function markdownLinks(markdown: string): string[] {
  const found = new Set<string>();
  const m = new Marked({ gfm: true });
  m.walkTokens(m.lexer(markdown), (t) => {
    if (t.type !== "link") return;
    const href = (t as Tokens.Link).href;
    if (!/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(href) && /\.md$/i.test(href.split("#")[0].split("?")[0])) found.add(href);
  });
  return [...found];
}

/* ─────────────────────────── Notion's export ──────────────────────────── */

// Notion database pages export their properties as "Key: value" lines under
// the title. Recognised by at least one of Notion's usual keys, so an
// ordinary first line like "Note: …" is left alone.
const NOTION_KEYS = /^(created|created time|created by|last edited|last edited time|last edited by|tags|status|date|published|author|type|category|topic|summary|description)$/i;

/**
 * Markdown from Notion, tidied: a page fetched through the Notion MCP has its
 * tags converted (see notion.ts); an export's callouts (`<aside>`) become
 * quotes, which the site and the editor keep, and its property lines are
 * taken out and returned. `omitted` lists what was left out (images, child
 * pages…). Plain Markdown comes through unchanged.
 */
export function fromNotion(markdown: string): {
  body: string;
  properties: Record<string, string>;
  omitted: string[];
} {
  const converted = fromNotionMarkdown(markdown);
  let body = converted.body.replace(/^<aside>[ \t]*\r?\n([\s\S]*?)<\/aside>[ \t]*$/gm, (_, inner: string) =>
    inner
      .trim()
      .split(/\r?\n/)
      .map((line) => (line.trim() ? `> ${line}` : ">"))
      .join("\n"),
  );
  const properties: Record<string, string> = {};
  const m = /^(\s*#[ \t]+[^\n]*\n)?(\s*)((?:[A-Z][\w ()-]{0,40}:[ \t]+[^\n]*\n?)+)(?=\s*\n|$)/.exec(body);
  if (m) {
    const lines = m[3].trim().split(/\n/).map((l) => /^([^:]+):[ \t]+(.*)$/.exec(l)!);
    if (lines.some((l) => NOTION_KEYS.test(l[1].trim()))) {
      for (const l of lines) properties[l[1].trim()] = l[2].trim();
      body = body.slice(0, m.index) + (m[1] ?? "") + m[2] + body.slice(m.index + m[0].length);
    }
  }
  return { body, properties, omitted: converted.omitted };
}

/**
 * The post's HTML. `images` maps a source as written (./diagram.png) to the
 * address it was uploaded to. A first `# Heading` is taken as the title
 * (and left out of the body) when there's no title in the frontmatter, or
 * when it repeats that title.
 */
export function markdownToHtml(
  markdown: string,
  images = new Map<string, string>(),
  title?: string,
  links = new Map<string, string>(),
) {
  const m = marked(images, links);
  const tokens = m.lexer(markdown);
  const firstReal = tokens.findIndex((t) => t.type !== "space");
  let foundTitle: string | undefined;
  const first = tokens[firstReal];
  if (first?.type === "heading" && (first as Tokens.Heading).depth === 1) {
    const text = (first as Tokens.Heading).text.trim();
    if (!title || text === title.trim()) {
      foundTitle = text;
      tokens.splice(firstReal, 1);
    }
  }
  let html = m.parser(tokens);
  // table alignment the way the editor stores it
  html = html.replace(/ align="(left|center|right)"/g, ' style="text-align: $1"');
  // <img> written as HTML inside the Markdown
  html = html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (all, a, src, b) =>
    images.has(src) ? `${a}${escapeAttr(images.get(src)!)}${b}` : all,
  );
  return { html: html.trim(), title: foundTitle };
}

/* ──────────────────────────── HTML → Markdown ─────────────────────────── */

export function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    hr: "---",
  });
  td.use(gfm);
  td.addRule("taskItem", {
    filter: (node) => node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem",
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      return `- [${checked ? "x" : " "}] ${content.replace(/^\s*\[[ x]\]\s*/, "").trim().replace(/\n+/g, "\n  ")}\n`;
    },
  });
  td.addRule("taskList", {
    filter: (node) => node.nodeName === "UL" && node.getAttribute("data-type") === "taskList",
    replacement: (content) => `\n\n${content.trim()}\n\n`,
  });
  td.addRule("taskCheckbox", {
    filter: (node) => node.nodeName === "LABEL" && !!node.querySelector("input[type=checkbox]"),
    replacement: () => "",
  });
  td.addRule("fencedWithLanguage", {
    filter: (node) => node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstChild as HTMLElement;
      const lang = /language-([\w+#-]+)/.exec(code.getAttribute("class") ?? "")?.[1] ?? "";
      const text = code.textContent ?? "";
      const fence = text.includes("```") ? "~~~~" : "```";
      return `\n\n${fence}${lang === "plaintext" ? "" : lang}\n${text.replace(/\n$/, "")}\n${fence}\n\n`;
    },
  });
  td.addRule("highlight", { filter: ["mark"], replacement: (content) => `==${content}==` });
  return td.turndown(html).trim() + "\n";
}

/** A post as a Markdown file: frontmatter, then its text. */
export function toMarkdownFile(entry: {
  id: string;
  title: string;
  kind: string;
  parent: string | null;
  slug: string;
  topic: string | null;
  summary: string | null;
  coverUrl: string | null;
  status: string;
  contentHtml: string;
}): string {
  const yamlString = (s: string) => (/^[\w ./-]+$/.test(s) && !/^(true|false|null|yes|no|~)$/i.test(s) ? s : JSON.stringify(s));
  const lines = [
    `id: ${entry.id}`,
    `title: ${yamlString(entry.title)}`,
    ...(entry.kind !== "post" ? [`kind: ${entry.kind}`] : []),
    ...(entry.parent ? [`parent: ${entry.parent}`] : []),
    `slug: ${entry.slug}`,
    ...(entry.topic ? [`topic: ${yamlString(entry.topic)}`] : []),
    ...(entry.summary ? [`summary: ${yamlString(entry.summary)}`] : []),
    ...(entry.coverUrl ? [`cover: ${entry.coverUrl}`] : []),
    `status: ${entry.status}`,
  ];
  const body = entry.contentHtml ? htmlToMarkdown(entry.contentHtml) : "";
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}
