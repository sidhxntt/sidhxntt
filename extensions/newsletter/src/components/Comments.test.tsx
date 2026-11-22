import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The thread UI, with Convex's hooks replaced by fixed data.

const now = Date.now();
const author = (name: string, isAuthor = false) => ({ name, image: null, isAuthor });
const row = (
  id: string,
  parentId: string | null,
  depth: number,
  body: string,
  extra: Partial<{ likeCount: number; createdAt: number; mine: boolean; deleted: "author" | "moderator" | null; replyCount: number; liked: boolean }> = {},
) => ({
  id,
  parentId,
  depth,
  createdAt: extra.createdAt ?? now - 60_000 * (10 - depth),
  editedAt: null,
  deleted: extra.deleted ?? null,
  body: extra.deleted ? null : body,
  author: extra.deleted ? null : author(id === "s1" ? "Siddhant Gupta" : `Reader ${id}`, id === "s1"),
  likeCount: extra.likeCount ?? 0,
  replyCount: extra.replyCount ?? 0,
  liked: extra.liked ?? false,
  mine: extra.mine ?? false,
});

const data = {
  viewer: { id: "me", isAdmin: false, name: "Me", image: null },
  comments: [
    row("a", null, 0, "Feature folders changed how our team works.", { likeCount: 5, createdAt: now - 3_600_000, replyCount: 1 }),
    row("b", "a", 1, "Did shared code end up in a common folder?", { replyCount: 1 }),
    row("s1", "b", 2, "Owners are the fix I keep coming back to.", { replyCount: 1 }),
    row("d3", "s1", 3, "Level three", { replyCount: 1 }),
    row("d4", "d3", 4, "Level four", { replyCount: 1 }),
    row("d5", "d4", 5, "Level five", { replyCount: 1 }),
    row("d6", "d5", 6, "Level six, no more indent", { replyCount: 1 }),
    row("d7", "d6", 7, "Level seven", { mine: true }),
    row("x", null, 0, "", { deleted: "author", replyCount: 1, createdAt: now - 7_200_000 }),
    row("y", "x", 1, "A reply under a deleted comment"),
    row("z", null, 0, "Newest top-level comment", { createdAt: now - 1000, likeCount: 1 }),
  ],
};

vi.mock("convex/react", () => {
  const mutation = () => {
    const fn = Object.assign(vi.fn(async () => null), { withOptimisticUpdate: () => fn });
    return fn;
  };
  return {
    useQuery: () => data,
    useMutation: mutation,
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  };
});
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock("../lib/config", () => ({
  CONVEX_URL: "https://example.convex.cloud",
  convexConfigured: true,
  BASE: "/newsletter",
  href: (p: string[]) => `/newsletter/${p.join("/")}`,
}));

const { Comments } = await import("./Comments");

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = host = null;
});

function render() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<Comments postId="p1" />));
  return host;
}

const topLevel = (el: HTMLElement) => Array.from(el.querySelectorAll(".thread > article")) as HTMLElement[];
const bodyOf = (a: HTMLElement) => a.querySelector(":scope > .c__main > .c__body")?.textContent;
const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click());

describe("Comments", () => {
  it("nests replies, sorts by top and counts live comments", () => {
    const el = render();
    expect(el.querySelector("#comments-title")?.textContent).toBe("10 comments");
    expect(topLevel(el).map(bodyOf)).toEqual([
      "Feature folders changed how our team works.",
      "Newest top-level comment",
      "Deleted by the person who wrote it.",
    ]);
    // seven levels deep, in one branch
    const deepest = el.querySelector('[aria-label="Comment by Reader d7"]')!;
    let depth = 0;
    for (let n = deepest.parentElement; n; n = n.parentElement) if (n.matches("article.c")) depth++;
    expect(depth).toBe(7);
    // past six levels replies stop indenting
    expect(deepest.classList.contains("c--flat")).toBe(true);
    expect(el.querySelector('[aria-label="Comment by Reader d5"]')!.classList.contains("c--flat")).toBe(false);
    // the newsletter's author is marked
    expect(el.querySelector('[aria-label="Comment by Siddhant Gupta"] .c__badge')?.textContent).toBe("Author");
  });

  it("re-sorts by newest and oldest", () => {
    const el = render();
    click(Array.from(el.querySelectorAll(".sort button")).find((b) => b.textContent === "Newest"));
    expect(topLevel(el).map(bodyOf)[0]).toBe("Newest top-level comment");
    click(Array.from(el.querySelectorAll(".sort button")).find((b) => b.textContent === "Oldest"));
    expect(topLevel(el).map(bodyOf)[0]).toBe("Deleted by the person who wrote it.");
  });

  it("collapses a branch from its rail and shows how many replies it hides", () => {
    const el = render();
    const first = topLevel(el)[0];
    click(first.querySelector(":scope > .c__rail"));
    expect(first.classList.contains("c--collapsed")).toBe(true);
    const expand = first.querySelector(".c__expand");
    expect(expand?.textContent).toBe("Show 7 more replies");
    click(expand);
    expect(first.classList.contains("c--collapsed")).toBe(false);
  });

  it("opens a reply box, and offers edit and delete only on your own comments", () => {
    const el = render();
    const first = topLevel(el)[0];
    const tools = () => Array.from(first.querySelector(":scope > .c__main > .c__tools")!.querySelectorAll("button"));
    expect(tools().map((b) => b.textContent)).toEqual(["Like5", "Reply"]);
    click(tools()[1]);
    expect(first.querySelector('textarea[aria-label="Reply to Reader a"]')).not.toBeNull();

    const mine = el.querySelector('[aria-label="Comment by Reader d7"]')!;
    const mineTools = Array.from(mine.querySelector(".c__tools")!.querySelectorAll("button")).map((b) => b.textContent);
    expect(mineTools).toEqual(["Like0", "Reply", "Edit", "Delete"]);

    // a deleted comment keeps its place but has no tools
    const stub = topLevel(el).find((a) => bodyOf(a) === "Deleted by the person who wrote it.")!;
    expect(stub.querySelector(":scope > .c__main > .c__tools")).toBeNull();

    if (process.env.COMMENTS_SNAPSHOT) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:fs").writeFileSync(process.env.COMMENTS_SNAPSHOT, el.innerHTML);
    }
  });
});
