import { describe, expect, it } from "vitest";
import { renderPostHtml } from "../src/lib/render";
import { markdownToHtml } from "./markdown";
import { fromNotionMarkdown, plainTitle } from "./notion";

// The shape the Notion MCP's fetch returns (from a real page, trimmed), plus
// the other Notion-flavoured blocks a post might use.
const FETCHED = `<page url="https://app.notion.com/p/3eb4">
<ancestor-path></ancestor-path>
<properties>
{"title":"RPC Explained"}
</properties>
<content>
## The idea in one sentence

<b>RPC (Remote Procedure Call) means calling a function that runs somewhere else.</b>

\`\`\`javascript
const order = await placeOrder(userId, items); // <b>not</b> bold
\`\`\`

But with RPC, <code>placeOrder</code> doesn't run here, and <code><div></code> stays literal. It feels <i>local</i>.

| What you want to do | REST | RPC |
| --- | --- | --- |
| Cancel an order | <code>PATCH /orders/42</code> | <code>cancelOrder(42)</code> |

<callout icon="💡" color="yellow_bg">
Check, then act, in one transaction.
</callout>

<toggle heading="h3">Why not REST?

REST thinks in nouns.
</toggle>

## A heading {color="blue"}

<todo checked="true">Read the contract</todo>

See <mention url="https://app.notion.com/p/abc">Sync vs Async</mention> on <date start="2026-09-30" />, in <span color="red">red</span>.

![Diagram](notion-file-block://3eb4-1234)

![Logo](https://example.com/logo.png)

<page url="https://app.notion.com/p/child">
<b>How is the code split up?</b>
</page>

<p />
</content>
</page>`;

describe("Notion-flavoured Markdown", () => {
  const { body, omitted } = fromNotionMarkdown(FETCHED);
  const html = markdownToHtml(body).html;

  it("keeps the text in the newsletter's own shapes", () => {
    expect(html).toContain("<h2>The idea in one sentence</h2>");
    expect(html).toContain("<strong>RPC (Remote Procedure Call) means calling a function that runs somewhere else.</strong>");
    expect(html).toContain("<em>local</em>");
    expect(html).toContain("<code>placeOrder</code>");
    expect(html).toContain("<td><code>cancelOrder(42)</code></td>");
    expect(html).toContain("<h3>Why not REST?</h3>");
    expect(html).toContain("<h2>A heading</h2>");
    expect(html).toContain('data-checked="true"');
    expect(html).toContain("See Sync vs Async on 2026-09-30, in red.");
    expect(html).toMatch(/<blockquote>\s*<p>💡 Check, then act, in one transaction.<\/p>/);
  });

  it("leaves code exactly as written", () => {
    expect(html).toContain("// &lt;b&gt;not&lt;/b&gt; bold");
    expect(html).toContain("<code>&lt;div&gt;</code>");
  });

  it("leaves out Notion's images and child pages, and says so", () => {
    expect(html).not.toContain("notion-file-block");
    expect(html).toContain('<img src="https://example.com/logo.png" alt="Logo">');
    expect(html).not.toContain("How is the code split up?");
    expect(omitted).toEqual(['child page "How is the code split up?"', 'image "Diagram"']);
    expect(body).not.toMatch(/<p \/>|<page|<content>|<properties>/);
  });

  it("survives the site's sanitiser", () => {
    const shown = renderPostHtml(html);
    expect(shown).toContain("<strong>RPC");
    expect(shown).toContain("💡 Check, then act");
  });

  it("leaves ordinary Markdown alone", () => {
    const plain = "# Title\n\nSome **bold** and `<b>code</b>`.\n\n```html\n<b>x</b>\n```\n";
    expect(fromNotionMarkdown(plain)).toEqual({ body: plain, omitted: [] });
  });

  it("cleans titles", () => {
    expect(plainTitle("<b>How do the parts talk?</b>")).toBe("How do the parts talk?");
    expect(plainTitle("Software Architectures ")).toBe("Software Architectures");
  });
});
