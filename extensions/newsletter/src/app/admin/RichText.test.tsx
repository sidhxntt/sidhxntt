import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";

// Pasting into the post editor, through the real ProseMirror paste pipeline.

const stored: string[] = [];
vi.mock("./uploads", () => ({
  isStoredImage: (src: string) => src.startsWith("https://example.convex.cloud/api/storage/"),
  useImageStore: () => ({
    upload: vi.fn(async () => ({ storageId: "s", url: "https://example.convex.cloud/api/storage/up" })),
    store: vi.fn(async (src: string) => {
      stored.push(src);
      return `https://example.convex.cloud/api/storage/copy-${stored.length}`;
    }),
  }),
}));

const { RichText } = await import("./RichText");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom lacks ClipboardEvent, which ProseMirror's paste path creates
  (globalThis as { ClipboardEvent?: unknown }).ClipboardEvent ??= class extends Event {
    clipboardData: DataTransfer | null;
    constructor(type: string, init?: EventInit & { clipboardData?: DataTransfer | null }) {
      super(type, init);
      this.clipboardData = init?.clipboardData ?? null;
    }
  };
  // and these, which ProseMirror calls while scrolling the selection into view; ProseMirror calls them while scrolling the selection into view
  Element.prototype.scrollIntoView ??= () => {};
  document.elementFromPoint ??= () => null;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = host = null;
  stored.length = 0;
});

async function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const changes: string[] = [];
  await act(async () => {
    root!.render(<RichText onChange={(v) => changes.push(v.html)} />);
  });
  const dom = host.querySelector(".ProseMirror") as (HTMLElement & { editor?: Editor }) | null;
  expect(dom?.editor).toBeTruthy();
  return { editor: dom!.editor!, changes };
}

async function paste(editor: Editor, html: string) {
  await act(async () => {
    editor.view.pasteHTML(html);
    await new Promise((r) => setTimeout(r, 0));
  });
  return editor.getHTML();
}

describe("pasting rich text", () => {
  it("keeps Google Docs formatting without making everything bold", async () => {
    const { editor } = await mount();
    const html = await paste(
      editor,
      `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-abc"><h2 dir="ltr"><span style="font-size:16pt;font-weight:400">Why owners matter</span></h2><p dir="ltr"><span style="font-weight:400">Plain, </span><span style="font-weight:700">bold</span><span style="font-weight:400">, </span><span style="font-style:italic">italic</span><span style="font-weight:400"> and </span><span style="text-decoration:underline">underlined</span><span style="font-weight:400"> with </span><span style="font-family:'Courier New';">code()</span><span style="font-weight:400"> and a </span><a href="https://sidhxntt.dev"><span style="text-decoration:underline;color:#1155cc">link</span></a>.</p><ul><li dir="ltr"><p dir="ltr"><span>First</span></p></li><li dir="ltr"><p dir="ltr"><span>Second</span></p></li></ul></b>`,
    );
    expect(html).toContain("<h2>Why owners matter</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<u>underlined</u>");
    expect(html).toContain("<code>code()</code>");
    expect(html).toMatch(/<a [^>]*href="https:\/\/sidhxntt\.dev"[^>]*>link<\/a>/);
    expect(html).toContain("<ul><li><p>First</p></li><li><p>Second</p></li></ul>");
    // the Docs wrapper isn't bold, so "Plain" isn't either
    expect(html).not.toMatch(/<strong>Plain/);
  });

  it("keeps Notion-style blocks: headings, quotes, code with language, tables and checklists", async () => {
    const { editor } = await mount();
    const html = await paste(
      editor,
      `<h1>Title</h1><blockquote><p>A quote</p></blockquote><pre><code class="language-python">print("hi")</code></pre><table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p>Done</p></div></li></ul><hr><ol><li><p>one</p></li></ol>`,
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<blockquote><p>A quote</p></blockquote>");
    expect(html).toContain('<pre><code class="language-python">print("hi")</code></pre>');
    expect(html).toMatch(/<table[^>]*>[\s\S]*<th[^>]*><p>A<\/p><\/th>[\s\S]*<td[^>]*><p>2<\/p><\/td>/);
    expect(html).toMatch(/<li (?=[^>]*data-type="taskItem")(?=[^>]*data-checked="true")[^>]*>/);
    expect(html).toContain("<hr>");
    expect(html).toContain("<ol><li><p>one</p></li></ol>");
  });

  it("turns code pasted from VS Code into a code block", async () => {
    const { editor } = await mount();
    const html = await paste(
      editor,
      `<div style="color: #d4d4d4;background-color: #1e1e1e;font-family: Menlo, Monaco, 'Courier New', monospace;white-space: pre;"><div><span style="color: #569cd6;">const</span><span> x = </span><span style="color: #b5cea8;">1</span>;</div><div><span>console.log(x);</span></div></div>`,
    );
    expect(html).toMatch(/<pre><code[^>]*>const x = 1;\nconsole\.log\(x\);<\/code><\/pre>/);
  });

  it("copies pasted images into the newsletter's storage", async () => {
    const { editor } = await mount();
    await paste(editor, `<p>Before</p><img src="https://prod-files-secure.s3.amazonaws.com/notion/image.png" alt="Diagram"><p>After</p>`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(stored).toEqual(["https://prod-files-secure.s3.amazonaws.com/notion/image.png"]);
    expect(editor.getHTML()).toContain('<img src="https://example.convex.cloud/api/storage/copy-1" alt="Diagram">');
  });
});
