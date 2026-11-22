// Cleans rich text pasted into the editor so it keeps its formatting.
//
// Most sources (Notion, Medium, web pages) paste semantic HTML the editor
// reads as is. Some don't:
//   - Google Docs wraps everything in <b style="font-weight:normal" id="docs-internal-guid-…">
//     (which would make the whole paste bold) and marks bold, italics and so
//     on with inline styles on <span>s.
//   - Word, Pages and many sites do the same with inline styles.
//   - VS Code and other editors paste code as styled <div>s.
// This turns all of that into <strong>, <em>, <u>, <s>, <code> and <pre>.

const MONO = /mono|courier|consol|menlo|monaco|sf mono|fira code|jetbrains/i;

function wrapChildren(el: Element, tag: string, doc: Document) {
  const wrapper = doc.createElement(tag);
  while (el.firstChild) wrapper.appendChild(el.firstChild);
  el.appendChild(wrapper);
}

function unwrap(el: Element) {
  el.replaceWith(...Array.from(el.childNodes));
}

export function cleanPastedHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("style, meta, script, link, title, o\\:p").forEach((el) => el.remove());

  // Google Docs' bold-looking wrapper isn't bold
  doc.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
  doc.querySelectorAll("b, strong").forEach((el) => {
    const weight = (el as HTMLElement).style?.fontWeight;
    if (weight === "normal" || weight === "400") unwrap(el);
  });

  // code pasted from editors: monospace blocks that keep their whitespace
  doc.querySelectorAll("div, p").forEach((el) => {
    const style = (el as HTMLElement).style;
    if (!style) return;
    const pre = /pre/.test(style.whiteSpace);
    if (pre && MONO.test(style.fontFamily) && !el.closest("pre")) {
      const lines = Array.from(el.children).length
        ? Array.from(el.children)
            .map((line) => line.textContent ?? "")
            .join("\n")
        : (el.textContent ?? "");
      const block = doc.createElement("pre");
      const code = doc.createElement("code");
      code.textContent = lines;
      block.appendChild(code);
      el.replaceWith(block);
    }
  });

  // links are underlined anyway (Google Docs styles them that way); don't
  // let the editor turn that into an underline mark on the link text
  doc.querySelectorAll("a[style], a [style]").forEach((el) => {
    const style = (el as HTMLElement).style;
    style.textDecoration = "";
    style.textDecorationLine = "";
  });

  // inline styles to marks
  doc.querySelectorAll("span[style], font, a[style]").forEach((el) => {
    const style = (el as HTMLElement).style;
    if (!style) return;
    const decoration = `${style.textDecoration} ${style.textDecorationLine}`;
    const bold = /^(bold|bolder|[6-9]00)$/.test(style.fontWeight);
    const italic = style.fontStyle === "italic";
    const underline = decoration.includes("underline");
    const strike = decoration.includes("line-through");
    const code = MONO.test(style.fontFamily) && !el.closest("pre, code");
    const sup = style.verticalAlign === "super";
    const sub = style.verticalAlign === "sub";
    if (code) wrapChildren(el, "code", doc);
    if (strike) wrapChildren(el, "s", doc);
    if (underline) wrapChildren(el, "u", doc);
    if (italic) wrapChildren(el, "em", doc);
    if (bold) wrapChildren(el, "strong", doc);
    if (sup) wrapChildren(el, "sup", doc);
    if (sub) wrapChildren(el, "sub", doc);
  });

  // Google Docs puts list-item text in <p> inside <li>; fine. It also marks
  // headings with role="heading" on a <p>.
  doc.querySelectorAll('p[role="heading"][aria-level]').forEach((el) => {
    const level = Math.min(4, Math.max(1, Number(el.getAttribute("aria-level")) || 2));
    const h = doc.createElement(`h${level}`);
    while (el.firstChild) h.appendChild(el.firstChild);
    el.replaceWith(h);
  });

  return doc.body.innerHTML;
}
