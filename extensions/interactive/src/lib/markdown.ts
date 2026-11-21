// Markdown ↔ HTML for the Notes app's live editor.
//
// Notes are *stored* as markdown but never *shown* as markdown: the editor is a
// contenteditable holding real HTML, so the visitor types into formatted text
// and the syntax is invisible. These two functions are the bridge, and they're
// deliberately a matched pair — mdToHtml only emits tags htmlToMd can read back,
// so a round trip is lossless for everything the editor can produce.
//
// Supported: # ## ###, **bold**, *italic*, `code`, [links](url), - bullets,
// 1. numbers, > quotes, checklists, --- rules, | tables |.

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

/** Non-breaking space — contenteditable sprays these in, markdown wants plain. */
const NBSP = String.fromCharCode(160);

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ESCAPES[c]);
}

function inlineToHtml(raw: string): string {
  // Split on code spans and leave their contents alone — a `**` inside
  // backticks is literal text, not bold.
  return escapeHtml(raw)
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
        return `<code>${part.slice(1, -1)}</code>`;
      }
      return part
        .replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, '<img src="$2" alt="$1">')
        .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_]+)__/g, "<u>$1</u>")
        .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    })
    .join("");
}

function tableRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

const isDivider = (line: string) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");

const CHECK_LINE = /^(☐|☑)\s/;

function isBlockStart(line: string): boolean {
  return (
    /^#{1,3}\s/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    CHECK_LINE.test(line) ||
    line.startsWith("> ") ||
    line.trim().startsWith("|") ||
    /^(-{3,}|\*{3,})$/.test(line.trim())
  );
}

/** Markdown → the HTML the contenteditable renders. */
export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Table: a header row followed by a |---|---| divider
    if (line.trim().startsWith("|") && isDivider(lines[i + 1] ?? "")) {
      const head = tableRow(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        body.push(tableRow(lines[i]));
        i += 1;
      }
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inlineToHtml(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${inlineToHtml(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`,
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inlineToHtml(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push("<hr>");
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quote.push(lines[i].slice(2));
        i += 1;
      }
      out.push(`<blockquote>${inlineToHtml(quote.join(" "))}</blockquote>`);
      continue;
    }

    // Checklists are their own thing — Apple Notes shows them as tappable rows
    if (CHECK_LINE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && CHECK_LINE.test(lines[i])) {
        const done = lines[i].startsWith("☑");
        items.push(`<li data-check="${done ? "1" : "0"}">${inlineToHtml(lines[i].slice(2))}</li>`);
        i += 1;
      }
      out.push(`<ul data-checklist="1">${items.join("")}</ul>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].replace(/^[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph: consecutive plain lines join into one block
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${inlineToHtml(para.join(" "))}</p>`);
  }

  return out.join("");
}

/** First line of a note with the syntax stripped — for the list preview. */
export function mdToPlain(md: string): string {
  const line = md
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !isDivider(l));
  if (!line) return "";
  return line
    .replace(/^#{1,3}\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(new RegExp(`^${CHECK_LINE.source}`), "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\||\|$/g, "")
    .trim();
}

/** Inline HTML → markdown, walking the contenteditable's own nodes. */
function inlineToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inlineToMd).join("");

  switch (el.tagName) {
    case "STRONG":
    case "B":
      return inner ? `**${inner}**` : "";
    case "EM":
    case "I":
      return inner ? `*${inner}*` : "";
    // markdown has no underline — __x__ is ours, and mdToHtml reads it back
    case "U":
      return inner ? `__${inner}__` : "";
    case "CODE":
      return inner ? `\`${inner}\`` : "";
    case "A": {
      const href = el.getAttribute("href");
      return href ? `[${inner}](${href})` : inner;
    }
    case "IMG": {
      const src = el.getAttribute("src") ?? "";
      return src ? `![${el.getAttribute("alt") ?? ""}](${src})` : "";
    }
    case "BR":
      return "\n";
    default:
      return inner;
  }
}

/** The editor's DOM → the markdown we persist. */
export function htmlToMd(root: HTMLElement): string {
  const blocks: string[] = [];

  for (const child of Array.from(root.children)) {
    const el = child as HTMLElement;
    const text = () => inlineToMd(el).trim();

    switch (el.tagName) {
      case "H1":
        blocks.push(`# ${text()}`);
        break;
      case "H2":
        blocks.push(`## ${text()}`);
        break;
      case "H3":
        blocks.push(`### ${text()}`);
        break;
      case "HR":
        blocks.push("---");
        break;
      case "BLOCKQUOTE":
        blocks.push(`> ${text()}`);
        break;
      case "UL":
      case "OL": {
        const ordered = el.tagName === "OL";
        const lines = Array.from(el.children).map((li, n) => {
          const body = inlineToMd(li).trim();
          const check = (li as HTMLElement).dataset.check;
          if (check !== undefined) return `${check === "1" ? "☑" : "☐"} ${body}`;
          return ordered ? `${n + 1}. ${body}` : `- ${body}`;
        });
        blocks.push(lines.join("\n"));
        break;
      }
      case "TABLE": {
        const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.children).map((cell) => inlineToMd(cell).trim()),
        );
        if (!rows.length) break;
        const width = rows[0].length;
        blocks.push(
          [
            `| ${rows[0].join(" | ")} |`,
            `| ${Array(width).fill("---").join(" | ")} |`,
            ...rows.slice(1).map((r) => `| ${r.join(" | ")} |`),
          ].join("\n"),
        );
        break;
      }
      default: {
        // <p>, <div>, and whatever the browser invents on Enter
        blocks.push(inlineToMd(el).split(NBSP).join(" ").trimEnd());
      }
    }
  }

  return blocks
    .filter((b) => b.length > 0)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
