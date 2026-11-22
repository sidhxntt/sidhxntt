import { describe, expect, it } from "vitest";
import { renderPostHtml } from "./render";

describe("renderPostHtml", () => {
  it("strips anything the editor can't produce", () => {
    const html = renderPostHtml(
      `<p onclick="alert(1)">Hi<script>alert(2)</script></p><img src="data:image/png;base64,AAAA"><img src="javascript:alert(3)"><iframe src="https://evil.example"></iframe><a href="javascript:alert(4)">x</a>`,
    );
    expect(html).not.toMatch(/onclick|<script|alert|<iframe|data:image|javascript:/);
    expect(html).toContain("<p>Hi</p>");
  });

  it("opens links to other sites in a new tab, and keeps own links", () => {
    const html = renderPostHtml(`<p><a href="https://example.com">out</a> <a href="/newsletter">in</a></p>`);
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">out</a>');
    expect(html).toContain('<a href="/newsletter">in</a>');
  });

  it("keeps alignment, task lists and tables, and colours code", () => {
    const html = renderPostHtml(
      `<p style="text-align: center; color: red">c</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p>t</p></div></li></ul><table><tbody><tr><th colspan="2"><p>h</p></th></tr></tbody></table><pre><code class="language-typescript">const a: number = 1;</code></pre>`,
    );
    expect(html).toContain('<p style="text-align:center">c</p>');
    expect(html).toContain('data-type="taskItem"');
    expect(html).toMatch(/<input type="checkbox" disabled(="")? checked(="")? \/?>/);
    expect(html).toContain('<th colspan="2">');
    expect(html).toContain('<code class="hljs language-typescript"><span class="hljs-keyword">const</span>');
  });
});
