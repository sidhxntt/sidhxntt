import { describe, expect, it } from "vitest";
import { renderPostHtml } from "../src/lib/render";
import {
  fromNotion,
  htmlToMarkdown,
  imageSources,
  markdownLinks,
  markdownToHtml,
  splitFrontmatter,
  toMarkdownFile,
  withId,
} from "./markdown";

const POST = `---
title: How is the code split up?
parent: blogs/software-architectures
topic: Architecture
summary: "Layers, features or services: the first decision."
cover: ./cover.png
status: published
---

# How is the code split up?

Split by **what changes together**, not by what _looks_ alike. See [Conway](https://example.com).

- [x] Draw the dependency graph
- [ ] Find the cycles

| Split | Good for |
|:--|:-:|
| Layers | Small apps |

\`\`\`ts
const user = await auth(req); // 401 if missing
\`\`\`

![The graph](./images/graph.png "Dependencies")

<img src="./images/raw.png" alt="raw">
`;

describe("frontmatter", () => {
  it("reads the settings and leaves the body", () => {
    const { data, body } = splitFrontmatter(POST);
    expect(data).toEqual({
      title: "How is the code split up?",
      parent: "blogs/software-architectures",
      topic: "Architecture",
      summary: "Layers, features or services: the first decision.",
      cover: "./cover.png",
      status: "published",
    });
    expect(body.startsWith("\n# How is")).toBe(true);
    expect(splitFrontmatter("---\ncover: none\ntopic:\n---\nHi").data).toEqual({ cover: null, topic: null });
    expect(() => splitFrontmatter("---\nstatus: live\n---\n")).toThrow(/draft or published/);
    expect(splitFrontmatter("No frontmatter")).toEqual({ data: {}, body: "No frontmatter" });
  });

  it("writes the id in, once", () => {
    const once = withId(POST, "abc123");
    expect(once.startsWith("---\nid: abc123\ntitle:")).toBe(true);
    expect(withId(once, "xyz789")).toBe(once.replace("id: abc123", "id: xyz789"));
    expect(withId("Just text", "abc")).toBe("---\nid: abc\n---\n\nJust text");
  });
});

describe("Markdown to the newsletter's HTML", () => {
  const { body } = splitFrontmatter(POST);
  const images = new Map([
    ["./images/graph.png", "https://x.convex.cloud/api/storage/1"],
    ["./images/raw.png", "https://x.convex.cloud/api/storage/2"],
  ]);

  it("finds every local image", () => {
    expect(imageSources(body)).toEqual(["./images/graph.png", "./images/raw.png"]);
  });

  it("drops a first heading that repeats the title and keeps the editor's shapes", () => {
    const { html, title } = markdownToHtml(body, images, "How is the code split up?");
    expect(title).toBe("How is the code split up?");
    expect(html).not.toContain("<h1>");
    expect(html).toContain(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Draw the dependency graph</p></div></li>',
    );
    expect(html).toContain('<th style="text-align: left">Split</th>');
    expect(html).toContain('<code class="language-ts">const user = await auth(req); // 401 if missing');
    expect(html).toContain('<img src="https://x.convex.cloud/api/storage/1" alt="The graph" title="Dependencies">');
    expect(html).toContain('<img src="https://x.convex.cloud/api/storage/2" alt="raw">');
    // and it survives the sanitiser readers' pages go through
    const shown = renderPostHtml(html);
    expect(shown).toContain('data-type="taskItem"');
    expect(shown).toContain("text-align:left");
    expect(shown).toContain("https://x.convex.cloud/api/storage/1");
  });

  it("takes the title from the first heading when there's none in the frontmatter", () => {
    expect(markdownToHtml("# A title\n\nText").title).toBe("A title");
    expect(markdownToHtml("# Other\n\nText", new Map(), "A title")).toMatchObject({ title: undefined });
  });
});

describe("Notion's Markdown export", () => {
  const PAGE = `# How do the parts talk?

Created: November 3, 2026 9:14 PM
Tags: Architecture, APIs

<aside>
💡 Split by what changes together.

</aside>

Next: [How is data handled?](How%20is%20data%20handled%203a2b1c0d4e5f6a7b8c9d0e1f2a3b4c5d.md) and [docs](https://example.com/a.md).
`;

  it("takes the property lines out and turns callouts into quotes", () => {
    const { body, properties } = fromNotion(PAGE);
    expect(properties).toEqual({ Created: "November 3, 2026 9:14 PM", Tags: "Architecture, APIs" });
    expect(body).not.toContain("Created:");
    expect(body).toContain("> 💡 Split by what changes together.");
    const { html, title } = markdownToHtml(body);
    expect(title).toBe("How do the parts talk?");
    expect(html).toContain("<blockquote>");
    expect(renderPostHtml(html)).toContain("💡 Split by what changes together.");
  });

  it("leaves an ordinary first line alone", () => {
    const { body, properties } = fromNotion("# Title\n\nNote: this is the intro.\n\nMore.\n");
    expect(properties).toEqual({});
    expect(body).toContain("Note: this is the intro.");
  });

  it("finds links to other Markdown files and points them at their posts", () => {
    const href = "How%20is%20data%20handled%203a2b1c0d4e5f6a7b8c9d0e1f2a3b4c5d.md";
    expect(markdownLinks(PAGE)).toEqual([href]);
    const linked = markdownToHtml(fromNotion(PAGE).body, undefined, undefined, new Map([[href, "/newsletter/blogs/data"]]));
    expect(linked.html).toContain('<a href="/newsletter/blogs/data">How is data handled?</a>');
    expect(linked.html).toContain('<a href="https://example.com/a.md">docs</a>');
    const unpushed = markdownToHtml(fromNotion(PAGE).body, undefined, undefined, new Map([[href, ""]]));
    expect(unpushed.html).toContain("Next: How is data handled? and");
  });
});

describe("back to Markdown", () => {
  it("round-trips the parts a post is made of", () => {
    const { body } = splitFrontmatter(POST);
    const md = htmlToMarkdown(markdownToHtml(body).html);
    expect(md).toContain("Split by **what changes together**, not by what _looks_ alike.");
    expect(md).toContain("- [x] Draw the dependency graph\n- [ ] Find the cycles");
    expect(md).toContain("```ts\nconst user = await auth(req); // 401 if missing\n```");
    expect(md).toContain("| Split | Good for |");
    expect(md).toContain("![The graph](./images/graph.png");
  });

  it("writes a file that reads back the same", () => {
    const file = toMarkdownFile({
      id: "abc123",
      title: "Sync vs Async: a primer",
      kind: "post",
      parent: "blogs",
      slug: "sync-vs-async",
      topic: "Architecture",
      summary: null,
      coverUrl: "https://x.convex.cloud/api/storage/9",
      status: "draft",
      contentHtml: "<p>Hello <strong>there</strong>.</p>",
    });
    const { data, body } = splitFrontmatter(file);
    expect(data).toEqual({
      id: "abc123",
      title: "Sync vs Async: a primer",
      parent: "blogs",
      slug: "sync-vs-async",
      topic: "Architecture",
      cover: "https://x.convex.cloud/api/storage/9",
      status: "draft",
    });
    expect(body.trim()).toBe("Hello **there**.");
  });
});
