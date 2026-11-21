import { describe, expect, it } from "vitest";
import { APP_META } from "@os/components/apps/app-meta";
import { APPS, APP_BY_ID } from "@os/components/apps/registry";
import { DEFAULT_SIZES } from "@os/components/window/WindowManager";

describe("app-meta", () => {
  it("has unique ids", () => {
    const ids = APP_META.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique, non-empty display names", () => {
    const names = APP_META.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n.trim().length).toBeGreaterThan(0);
  });

  it("desktopName is only meaningful for desktop icons", () => {
    for (const a of APP_META) {
      if (a.desktopName !== undefined) expect(a.onDesktop).toBe(true);
    }
  });

  it("keeps a populated dock", () => {
    expect(APP_META.filter((a) => a.inDock).length).toBeGreaterThan(0);
  });
});

describe("registry", () => {
  it("zips every APP_META entry with a component, preserving dock order", () => {
    expect(APPS.map((a) => a.id)).toEqual(APP_META.map((a) => a.id));
    for (const app of APPS) {
      expect(app.component, `app "${app.id}" has no component`).toBeTypeOf("function");
    }
  });

  it("APP_BY_ID indexes every app", () => {
    for (const meta of APP_META) {
      expect(APP_BY_ID[meta.id]).toBeDefined();
      expect(APP_BY_ID[meta.id].name).toBe(meta.name);
    }
  });
});

describe("window manager invariants", () => {
  it("DEFAULT_SIZES covers every app with sane dimensions", () => {
    for (const meta of APP_META) {
      const size = DEFAULT_SIZES[meta.id];
      expect(size, `no default size for "${meta.id}"`).toBeDefined();
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });

  it("DEFAULT_SIZES has no entries for unknown apps", () => {
    const known = new Set(APP_META.map((a) => a.id));
    for (const id of Object.keys(DEFAULT_SIZES)) {
      expect(known.has(id as (typeof APP_META)[number]["id"]), `orphan size entry "${id}"`).toBe(true);
    }
  });
});
