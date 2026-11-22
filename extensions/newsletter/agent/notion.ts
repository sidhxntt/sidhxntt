// Notion-flavoured Markdown (what the Notion MCP's fetch returns) into plain
// Markdown the newsletter's converter understands. Spec:
// notion://docs/notion-flavored-markdown-spec. Text only: Notion-hosted
// images, files, embeds and child pages are left out and listed, since the
// author adds images in the admin and child pages are pushed as their own
// entries. Code (fenced blocks, `spans`, <code> tags) is never rewritten.

const TOKEN = (i: number) => `\u0000${i}\u0000`;

/** Backticks around `text` that no run inside it can close early. */
function codeSpan(text: string) {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = /^`|`$/.test(text) || text.startsWith(" ") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

// Notion keeps its uploads behind expiring or Notion-only links
const NOTION_FILE = /^(notion-file-block:|attachment:|https?:\/\/(prod-files-secure\.s3|s3\.us-west-2\.amazonaws\.com\/secure\.notion-static|file\.notion\.so|www\.notion\.so\/image|img\.notionusercontent\.com))/i;

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Lines prefixed for a Markdown quote (nested quotes keep their own `>`). */
const quoted = (body: string) =>
  body
    .trim()
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");

export function fromNotionMarkdown(input: string): { body: string; omitted: string[] } {
  const omitted: string[] = [];
  const kept: string[] = [];
  const keep = (s: string) => TOKEN(kept.push(s) - 1);

  // the whole fetch result pasted in: just its <content>
  const inner = /<content>\r?\n?([\s\S]*?)<\/content>/.exec(input);
  let md = inner ? inner[1] : input;

  // code is left exactly as it is
  md = md.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1`*[ \t]*$/gm, (block) => keep(block));
  md = md.replace(/<code>([\s\S]*?)<\/code>/g, (_, text: string) => keep(codeSpan(text)));
  md = md.replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, (span) => keep(span));

  // child pages, databases and folders are their own entries
  md = md.replace(/<(page|database|folder)\b[^>]*>([\s\S]*?)<\/\1>/g, (_, kind: string, title: string) => {
    omitted.push(`${kind === "page" ? "child page" : kind} "${title.replace(/<[^>]+>/g, "").trim()}"`);
    return "";
  });

  // media: Notion's own uploads are left for the admin; outside links stay
  md = md.replace(/<image\b([^>]*)>([\s\S]*?)<\/image>|<image\b([^>]*)\/>/g, (_, a1, caption, a2) => {
    const src = attr(a1 ?? a2 ?? "", "source") ?? "";
    if (!src || NOTION_FILE.test(src)) {
      omitted.push(`image${caption?.trim() ? ` "${caption.trim()}"` : ""}`);
      return "";
    }
    return `![${(caption ?? "").trim()}](${src})`;
  });
  md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (all, caption: string, src: string) => {
    if (!NOTION_FILE.test(src)) return all;
    omitted.push(`image${caption.trim() ? ` "${caption.trim()}"` : ""}`);
    return "";
  });
  md = md.replace(/<(pdf|file|audio|video|embed)\b([^>]*)>([\s\S]*?)<\/\1>|<(pdf|file|audio|video|embed)\b([^>]*)\/>/g, (_, k1, a1, caption, k2) => {
    omitted.push(`${k1 ?? k2}${caption?.trim() ? ` "${caption.trim()}"` : ""}`);
    return "";
  });
  md = md.replace(/<bookmark\b([^>]*)>([\s\S]*?)<\/bookmark>|<bookmark\b([^>]*)\/>/g, (_, a1, caption, a2) => {
    const url = attr(a1 ?? a2 ?? "", "url") ?? attr(a1 ?? a2 ?? "", "source");
    return url ? `[${(caption ?? "").trim() || url}](${url})` : "";
  });
  md = md.replace(/<link-preview\b([^>]*)\/>/g, (_, a: string) => {
    const url = attr(a, "url");
    return url ? `[${url}](${url})` : "";
  });
  md = md.replace(/<(table-of-contents|empty-block|custom-block|external_object_instance)\b[^>]*\/>/g, "");
  md = md.replace(/<external_object_instance\b[^>]*>([\s\S]*?)<\/external_object_instance>/g, "$1");
  md = md.replace(/<synced-block(-reference)?\b[^>]*>([\s\S]*?)<\/synced-block(-reference)?>/g, "$2");

  // containers, innermost first
  for (let changed = true; changed; ) {
    const before = md;
    md = md.replace(/<callout\b([^>]*)>([^]*?)<\/callout>/g, (_, a: string, body: string) => {
      const icon = attr(a, "icon");
      return `\n${quoted(`${icon && !icon.startsWith("/") ? `${icon} ` : ""}${body.trim()}`)}\n`;
    });
    md = md.replace(/<quote\b[^>]*>([^]*?)<\/quote>/g, (_, body: string) => `\n${quoted(body)}\n`);
    md = md.replace(/<toggle\b([^>]*)>([^]*?)<\/toggle>/g, (_, a: string, body: string) => {
      const [title, ...rest] = body.trim().split(/\r?\n/);
      const level = /^h([1-4])$/.exec(attr(a, "heading") ?? "")?.[1];
      const head = level ? `${"#".repeat(Number(level))} ${title}` : `**${title.trim()}**`;
      return `\n${head}\n\n${rest.join("\n").trim()}\n`;
    });
    md = md.replace(/<details\b[^>]*>\s*<summary\b[^>]*>([^]*?)<\/summary>([^]*?)<\/details>/g, (_, s: string, body: string) => `\n**${s.trim()}**\n\n${body.trim()}\n`);
    md = md.replace(/<\/?(columns|column|tabs|tab)\b[^>]*>/g, "\n");
    changed = md !== before;
  }
  md = md.replace(/<todo\b([^>]*)>([\s\S]*?)<\/todo>/g, (_, a: string, text: string) => `- [${attr(a, "checked") === "true" ? "x" : " "}] ${text.trim()}`);
  md = md.replace(/<equation\b[^>]*>([\s\S]*?)<\/equation>/g, (_, tex: string) => `\n$$\n${tex.trim()}\n$$\n`);

  // inline
  md = md.replace(/<mention\b[^>]*>([\s\S]*?)<\/mention>/g, "$1");
  md = md.replace(/<mention(-[a-z]+)?\b[^>]*\/>/g, "");
  md = md.replace(/<mention-[a-z]+\b[^>]*>([\s\S]*?)<\/mention-[a-z]+>/g, "$1");
  md = md.replace(/<date\b([^>]*)\/>/g, (_, a: string) => {
    const start = attr(a, "start");
    const end = attr(a, "end");
    return start ? (end ? `${start} – ${end}` : start) : "";
  });
  md = md.replace(/<span\b[^>]*>([\s\S]*?)<\/span>/g, "$1");
  md = md.replace(/<(\/?)b>/g, "<$1strong>").replace(/<(\/?)i>/g, "<$1em>");
  md = md.replace(/\[\^(https?:\/\/[^\]]+)\]/g, "[source]($1)");

  // block attributes ({color="…"}, {toggle="true"}) and colour/attribute
  // noise on tags the site keeps
  md = md.replace(/[ \t]*\{(?:color|toggle)="[^"]*"(?:\s+\w+="[^"]*")*\}[ \t]*$/gm, "");
  md = md.replace(/<(p|h[1-6]|li|ul|ol|table|tr|th|td|colgroup|col)\b[^>]*?(\s*\/)?>/g, (_, tag: string, self?: string) => `<${tag}${self ? " /" : ""}>`);
  md = md.replace(/^[ \t]*<p \/>[ \t]*$/gm, "");

  md = md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  // restore code
  md = md.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)]);
  return { body: md, omitted };
}

/** A Notion title as plain text: no tags, no stray spaces. */
export function plainTitle(title: string) {
  return unescape(title.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}
