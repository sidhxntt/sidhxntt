import { beforeEach, describe, expect, it, vi } from "vitest";

// These modules are singletons that read localStorage at import time, so every
// test re-imports them fresh via vi.resetModules().

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const KEY = (k: string) => `portfolio-os:${k}`;

describe("persist", () => {
  it("returns the fallback when nothing is stored", async () => {
    const { loadPersisted } = await import("@/lib/persist");
    expect(loadPersisted("missing", "fallback")).toBe("fallback");
  });

  it("round-trips values through localStorage under the prefixed key", async () => {
    const { loadPersisted, savePersisted } = await import("@/lib/persist");
    savePersisted("answer", { n: 42 });
    expect(window.localStorage.getItem(KEY("answer"))).toBe('{"n":42}');
    expect(loadPersisted<{ n: number }>("answer", { n: 0 })).toEqual({ n: 42 });
  });

  it("returns the fallback for corrupt JSON", async () => {
    const { loadPersisted } = await import("@/lib/persist");
    window.localStorage.setItem(KEY("bad"), "{not json");
    expect(loadPersisted("bad", "fallback")).toBe("fallback");
  });

  it("returns the fallback when validation rejects the stored value", async () => {
    const { loadPersisted } = await import("@/lib/persist");
    window.localStorage.setItem(KEY("v"), JSON.stringify("nope"));
    expect(loadPersisted<"a" | "b">("v", "a", (x): x is "a" | "b" => x === "a" || x === "b")).toBe("a");
  });

  it("accepts the stored value when validation passes", async () => {
    const { loadPersisted } = await import("@/lib/persist");
    window.localStorage.setItem(KEY("v"), JSON.stringify("b"));
    expect(loadPersisted<"a" | "b">("v", "a", (x): x is "a" | "b" => x === "a" || x === "b")).toBe("b");
  });

  it("savePersisted swallows storage errors (private mode / quota)", async () => {
    const { savePersisted } = await import("@/lib/persist");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => savePersisted("k", "v")).not.toThrow();
  });
});

describe("theme store", () => {
  it("defaults to light", async () => {
    const { getTheme } = await import("@/lib/theme");
    expect(getTheme()).toBe("light");
  });

  it("set → get → persists, and survives a fresh import", async () => {
    const { getTheme, setTheme } = await import("@/lib/theme");
    setTheme("dark");
    expect(getTheme()).toBe("dark");
    expect(window.localStorage.getItem(KEY("theme"))).toBe('"dark"');

    vi.resetModules();
    const fresh = await import("@/lib/theme");
    expect(fresh.getTheme()).toBe("dark");
  });

  it("falls back to light when the stored value is invalid", async () => {
    window.localStorage.setItem(KEY("theme"), JSON.stringify("purple"));
    const { getTheme } = await import("@/lib/theme");
    expect(getTheme()).toBe("light");
  });

  it("notifies subscribers, and unsubscribe stops notifications", async () => {
    const { setTheme, subscribeTheme } = await import("@/lib/theme");
    const spy = vi.fn();
    const off = subscribeTheme(spy);
    setTheme("dark");
    expect(spy).toHaveBeenCalledExactlyOnceWith("dark");
    off();
    setTheme("light");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("accent store", () => {
  it("defaults to blue and exposes its hex color", async () => {
    const { getAccent, getAccentColor } = await import("@/lib/accent");
    expect(getAccent()).toBe("blue");
    expect(getAccentColor()).toBe("#3b82f6");
  });

  it("set updates color lookup and persists", async () => {
    const { setAccent, getAccentColor } = await import("@/lib/accent");
    setAccent("green");
    expect(getAccentColor()).toBe("#22c55e");
    expect(window.localStorage.getItem(KEY("accent"))).toBe('"green"');

    vi.resetModules();
    const fresh = await import("@/lib/accent");
    expect(fresh.getAccent()).toBe("green");
  });

  it("rejects an unknown persisted accent", async () => {
    window.localStorage.setItem(KEY("accent"), JSON.stringify("magenta"));
    const { getAccent } = await import("@/lib/accent");
    expect(getAccent()).toBe("blue");
  });

  it("ACCENTS ids are unique and colors are hex", async () => {
    const { ACCENTS } = await import("@/lib/accent");
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(ACCENTS.length);
    for (const a of ACCENTS) expect(a.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("subscribe / unsubscribe round-trip", async () => {
    const { setAccent, subscribeAccent } = await import("@/lib/accent");
    const spy = vi.fn();
    const off = subscribeAccent(spy);
    setAccent("pink");
    expect(spy).toHaveBeenCalledExactlyOnceWith("pink");
    off();
    setAccent("red");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("wallpaper store", () => {
  it("defaults to the default wallpaper", async () => {
    const { getWallpaper } = await import("@/lib/wallpaper");
    expect(getWallpaper()).toBe("canyon");
  });

  it("set persists and survives a fresh import", async () => {
    const { setWallpaper } = await import("@/lib/wallpaper");
    // deliberately not the default, so the assertion proves persistence
    setWallpaper("green-field");
    vi.resetModules();
    const fresh = await import("@/lib/wallpaper");
    expect(fresh.getWallpaper()).toBe("green-field");
  });

  it("rejects an unknown persisted wallpaper", async () => {
    window.localStorage.setItem(KEY("wallpaper"), JSON.stringify("beach"));
    const { getWallpaper } = await import("@/lib/wallpaper");
    expect(getWallpaper()).toBe("canyon");
  });

  it("subscribe / unsubscribe round-trip", async () => {
    const { setWallpaper, subscribeWallpaper } = await import("@/lib/wallpaper");
    const spy = vi.fn();
    const off = subscribeWallpaper(spy);
    setWallpaper("canyon");
    expect(spy).toHaveBeenCalledExactlyOnceWith("canyon");
    off();
    setWallpaper("green-field");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("dock store", () => {
  it("has macOS-ish defaults", async () => {
    const { getDockSettings } = await import("@/lib/dock");
    expect(getDockSettings()).toEqual({ size: 52, magnification: 0.7, autoHide: false });
  });

  it("clamps size to 40..64 and magnification to 0..1", async () => {
    const { getDockSettings, setDockSize, setDockMagnification } = await import("@/lib/dock");
    setDockSize(100);
    expect(getDockSettings().size).toBe(64);
    setDockSize(10);
    expect(getDockSettings().size).toBe(40);
    setDockMagnification(2);
    expect(getDockSettings().magnification).toBe(1);
    setDockMagnification(-1);
    expect(getDockSettings().magnification).toBe(0);
  });

  it("persists the whole settings object and survives a fresh import", async () => {
    const { setDockSize, setDockAutoHide } = await import("@/lib/dock");
    setDockSize(48);
    setDockAutoHide(true);
    vi.resetModules();
    const fresh = await import("@/lib/dock");
    expect(fresh.getDockSettings()).toEqual({ size: 48, magnification: 0.7, autoHide: true });
  });

  it("rejects a malformed persisted object", async () => {
    window.localStorage.setItem(KEY("dock"), JSON.stringify({ size: "big" }));
    const { getDockSettings } = await import("@/lib/dock");
    expect(getDockSettings()).toEqual({ size: 52, magnification: 0.7, autoHide: false });
  });

  it("notifies subscribers with the full settings object; unsubscribe stops them", async () => {
    const { setDockAutoHide, subscribeDock } = await import("@/lib/dock");
    const spy = vi.fn();
    const off = subscribeDock(spy);
    setDockAutoHide(true);
    expect(spy).toHaveBeenCalledExactlyOnceWith({ size: 52, magnification: 0.7, autoHide: true });
    off();
    setDockAutoHide(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("ui store (brightness)", () => {
  it("defaults to 1", async () => {
    const { getBrightness } = await import("@/lib/ui");
    expect(getBrightness()).toBe(1);
  });

  it("clamps to the 0.4..1 range", async () => {
    const { getBrightness, setBrightness } = await import("@/lib/ui");
    setBrightness(0.1);
    expect(getBrightness()).toBe(0.4);
    setBrightness(2);
    expect(getBrightness()).toBe(1);
    setBrightness(0.75);
    expect(getBrightness()).toBe(0.75);
  });

  it("persists the clamped value, not the raw input", async () => {
    const { setBrightness } = await import("@/lib/ui");
    setBrightness(0);
    expect(window.localStorage.getItem(KEY("brightness"))).toBe("0.4");
  });

  it("rejects an out-of-range persisted value", async () => {
    window.localStorage.setItem(KEY("brightness"), "0.2");
    const { getBrightness } = await import("@/lib/ui");
    expect(getBrightness()).toBe(1);
  });

  it("accepts an in-range persisted value", async () => {
    window.localStorage.setItem(KEY("brightness"), "0.7");
    const { getBrightness } = await import("@/lib/ui");
    expect(getBrightness()).toBe(0.7);
  });

  it("subscribers receive the clamped value; unsubscribe stops them", async () => {
    const { setBrightness, subscribeBrightness } = await import("@/lib/ui");
    const spy = vi.fn();
    const off = subscribeBrightness(spy);
    setBrightness(0);
    expect(spy).toHaveBeenCalledExactlyOnceWith(0.4);
    off();
    setBrightness(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
