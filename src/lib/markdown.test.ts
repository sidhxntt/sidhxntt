import { describe, expect, it } from "vitest";
import { htmlToMd, mdToHtml, mdToPlain } from "./markdown";
import { seedNotes } from "@/data/notes";

/** Round-trips markdown through the editor's DOM the way the app does. */
function roundTrip(md: string): string {
  const el = document.createElement("div");
  el.innerHTML = mdToHtml(md);
  return htmlToMd(el);
}

describe("mdToHtml", () => {
  it("renders headings without showing the hashes", () => {
    const html = mdToHtml("## Career Timeline");
    expect(html).toBe("<h2>Career Timeline</h2>");
    expect(html).not.toContain("#");
  });

  it("renders bold, italic, code and links as tags", () => {
    expect(mdToHtml("**a** *b* `c`")).toBe("<p><strong>a</strong> <em>b</em> <code>c</code></p>");
    expect(mdToHtml("[site](https://x.com/a)")).toBe('<p><a href="https://x.com/a">site</a></p>');
  });

  it("renders underline, which plain markdown has no syntax for", () => {
    expect(mdToHtml("__under__")).toBe("<p><u>under</u></p>");
  });

  it("renders images and round-trips them", () => {
    expect(mdToHtml("![Process](/notes/process.png)")).toBe(
      '<p><img src="/notes/process.png" alt="Process"></p>',
    );
    const el = document.createElement("div");
    el.innerHTML = mdToHtml("![Process](/notes/process.png)");
    expect(htmlToMd(el)).toBe("![Process](/notes/process.png)");
  });

  it("links mailto: as well as http(s)", () => {
    expect(mdToHtml("[mail](mailto:a@b.com)")).toBe('<p><a href="mailto:a@b.com">mail</a></p>');
  });

  it("leaves markdown characters inside code spans alone", () => {
    expect(mdToHtml("`**not bold**`")).toBe("<p><code>**not bold**</code></p>");
  });

  it("escapes HTML in note text", () => {
    expect(mdToHtml("<script>alert(1)</script>")).toContain("&lt;script&gt;");
  });

  it("builds lists, quotes, rules and tables", () => {
    expect(mdToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(mdToHtml("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
    expect(mdToHtml("> quoted")).toBe("<blockquote>quoted</blockquote>");
    expect(mdToHtml("---")).toBe("<hr>");
    expect(mdToHtml("| a | b |\n| --- | --- |\n| 1 | 2 |")).toContain("<th>a</th>");
  });

  it("keeps checklist state", () => {
    expect(mdToHtml("☑ done")).toContain('data-check="1"');
    expect(mdToHtml("☐ todo")).toContain('data-check="0"');
  });
});

describe("round trip", () => {
  it("survives every block type", () => {
    const md = [
      "# Title",
      "",
      "A paragraph with **bold**, *italic*, __underline__ and `code`.",
      "",
      "## Section",
      "",
      "- one",
      "- two",
      "",
      "1. first",
      "2. second",
      "",
      "> a quote",
      "",
      "| Metric | Number |",
      "| --- | --- |",
      "| Uptime | **99.9%** |",
      "",
      "---",
      "",
      "☑ done",
      "☐ todo",
    ].join("\n");
    expect(roundTrip(md)).toBe(md);
  });

  it("survives every seed note unchanged", () => {
    for (const note of seedNotes) {
      expect(roundTrip(note.body), note.title).toBe(note.body);
    }
  });
});

describe("mdToPlain", () => {
  it("strips syntax for the list preview", () => {
    expect(mdToPlain("# Beautiful Interfaces, Powerful Backend.")).toBe(
      "Beautiful Interfaces, Powerful Backend.",
    );
    expect(mdToPlain("- **2+** — Years of Experience")).toBe("2+ — Years of Experience");
    expect(mdToPlain("")).toBe("");
  });

  it("never leaks markdown characters from a seed note", () => {
    for (const note of seedNotes) {
      const preview = mdToPlain(note.body);
      expect(preview, note.title).not.toMatch(/^[#>-]|\*\*|`/);
    }
  });
});
