import { toHtml } from "hast-util-to-html";
import { common, createLowlight } from "lowlight";
import sanitizeHtml from "sanitize-html";

// Turns a post's stored HTML into what readers get: only the tags the editor
// produces survive, links to other sites open in a new tab, and code blocks
// get syntax colours.

const lowlight = createLowlight(common);

const OWN_HOSTS = new Set(["sidhxntt.dev", "www.sidhxntt.dev"]);

const ALIGN = { "text-align": [/^(left|right|center|justify)$/] };

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "del",
    "code", "pre", "blockquote", "ul", "ol", "li", "a", "img", "hr", "br",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
    "mark", "sub", "sup", "span", "label", "input", "div", "figure", "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    code: ["class"],
    ol: ["start"],
    ul: ["data-type"],
    li: ["data-type", "data-checked"],
    input: ["type", "checked", "disabled"],
    th: ["colspan", "rowspan", "style"],
    td: ["colspan", "rowspan", "style"],
    col: ["style", "span"],
    p: ["style"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
  },
  allowedClasses: { code: ["language-*"] },
  allowedStyles: {
    p: ALIGN,
    h1: ALIGN,
    h2: ALIGN,
    h3: ALIGN,
    h4: ALIGN,
    th: ALIGN,
    td: ALIGN,
    col: { width: [/^\d+(\.\d+)?px$/] },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const out: Record<string, string> = { href: attribs.href ?? "" };
      if (attribs.title) out.title = attribs.title;
      try {
        const url = new URL(out.href, "https://sidhxntt.dev");
        if (!OWN_HOSTS.has(url.hostname) && url.protocol.startsWith("http")) {
          out.target = "_blank";
          out.rel = "noopener noreferrer";
        }
      } catch {
        /* leave relative and odd links as they are */
      }
      return { tagName, attribs: out };
    },
    // task-list checkboxes are for show
    input: (tagName, attribs) => ({
      tagName,
      attribs: { type: "checkbox", disabled: "", ...(attribs.checked !== undefined ? { checked: "" } : {}) },
    }),
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy", decoding: "async" } }),
  },
};
// loading/decoding are added by transformTags after filtering, so allow them
(OPTIONS.allowedAttributes as Record<string, string[]>).img.push("loading", "decoding");

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

function decode(s: string) {
  return s.replace(/&(lt|gt|amp|quot|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

function highlight(html: string) {
  return html.replace(
    /<pre><code class="language-([\w+#-]+)">([\s\S]*?)<\/code><\/pre>/g,
    (whole, lang: string, code: string) => {
      if (!lowlight.registered(lang)) return whole;
      const tree = lowlight.highlight(lang, decode(code));
      return `<pre><code class="hljs language-${lang}">${toHtml(tree)}</code></pre>`;
    },
  );
}

export function renderPostHtml(html: string | null | undefined): string {
  if (!html) return "";
  return highlight(sanitizeHtml(html, OPTIONS));
}
