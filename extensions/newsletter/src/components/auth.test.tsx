import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The header's account area: the Admin button appears only for the admin.

let me: null | { id: string; name: string; email: string; image: null; isAdmin: boolean } = null;
let signedIn = false;

vi.mock("convex/react", () => ({
  useQuery: () => me,
  useConvexAuth: () => ({ isAuthenticated: signedIn, isLoading: false }),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock("../lib/config", () => ({ CONVEX_URL: "https://x.convex.cloud", convexConfigured: true, BASE: "/newsletter" }));

const { AccountButton, SubscribeLink } = await import("./auth");

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
  act(() => root!.render(<AccountButton />));
  return host;
}
const adminLink = (el: HTMLElement) =>
  Array.from(el.querySelectorAll("a")).find((a) => a.textContent === "Admin") as HTMLAnchorElement | undefined;

describe("AccountButton", () => {
  it("shows an Admin button to the admin", () => {
    signedIn = true;
    me = { id: "u", name: "Siddhant Gupta", email: "siddhantg2002@gmail.com", image: null, isAdmin: true };
    expect(adminLink(render())?.getAttribute("href")).toBe("/newsletter/admin");
  });

  it("doesn't show it to readers or signed-out visitors", () => {
    signedIn = true;
    me = { id: "r", name: "Reader", email: "reader@example.com", image: null, isAdmin: false };
    expect(adminLink(render())).toBeUndefined();
    act(() => root?.unmount());
    root = null;
    signedIn = false;
    me = null;
    const el = render();
    expect(adminLink(el)).toBeUndefined();
    expect(el.textContent).toContain("Sign in");
  });
});

describe("SubscribeLink", () => {
  it("is there for readers and hidden from the author", () => {
    signedIn = true;
    me = { id: "r", name: "Reader", email: "reader@example.com", image: null, isAdmin: false };
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root!.render(<SubscribeLink />));
    expect(host.textContent).toBe("Subscribe");
    me = { id: "u", name: "Siddhant Gupta", email: "siddhantg2002@gmail.com", image: null, isAdmin: true };
    act(() => root!.render(<SubscribeLink />));
    expect(host.textContent).toBe("");
  });
});
