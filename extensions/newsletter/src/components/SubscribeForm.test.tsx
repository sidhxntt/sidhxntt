import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The author never gets the sign-up form; readers do.

let me: null | { isAdmin: boolean } = null;
vi.mock("convex/react", () => ({
  useQuery: () => me,
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: me !== null, isLoading: false }),
}));
vi.mock("../lib/config", () => ({ convexConfigured: true }));

const { SubscribeForm } = await import("./SubscribeForm");

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
  act(() => root!.render(<SubscribeForm />));
  return host;
}

describe("SubscribeForm", () => {
  it("explains instead of offering the form to the author", () => {
    me = { isAdmin: true };
    const el = render();
    expect(el.querySelector("form")).toBeNull();
    expect(el.textContent).toContain("can’t subscribe");
  });

  it("offers the form to readers and visitors", () => {
    me = { isAdmin: false };
    expect(render().querySelector("form input[type=email]")).not.toBeNull();
    act(() => root?.unmount());
    root = null;
    me = null;
    expect(render().querySelector("form")).not.toBeNull();
  });
});
