import { beforeEach, describe, expect, it, vi } from "vitest";

// All nav channels are module singletons with pending one-shot state, so each
// test gets fresh modules.

beforeEach(() => {
  vi.resetModules();
});

// The four simple request/consume/subscribe channels share one contract.
const simpleChannels = [
  {
    name: "finder-nav",
    load: () => import("@/lib/finder-nav"),
    pick: (m: typeof import("@/lib/finder-nav")) => ({
      request: m.requestFinderLocation,
      consume: m.consumePendingFinderLocation,
      subscribe: m.subscribeFinderNav,
    }),
    value: "trash",
  },
  {
    name: "project-nav",
    load: () => import("@/lib/project-nav"),
    pick: (m: typeof import("@/lib/project-nav")) => ({
      request: m.requestProject,
      consume: m.consumePendingProject,
      subscribe: m.subscribeProjectNav,
    }),
    value: "project-two",
  },
  {
    name: "photo-nav",
    load: () => import("@/lib/photo-nav"),
    pick: (m: typeof import("@/lib/photo-nav")) => ({
      request: m.requestPhoto,
      consume: m.consumePendingPhoto,
      subscribe: m.subscribePhotoNav,
    }),
    value: "p2",
  },
  {
    name: "note-nav",
    load: () => import("@/lib/note-nav"),
    pick: (m: typeof import("@/lib/note-nav")) => ({
      request: m.requestNote,
      consume: m.consumePendingNote,
      subscribe: m.subscribeNoteNav,
    }),
    value: "ideas",
  },
  {
    name: "settings-nav",
    load: () => import("@/lib/settings-nav"),
    pick: (m: typeof import("@/lib/settings-nav")) => ({
      request: m.requestSettingsPane,
      consume: m.consumePendingSettingsPane,
      subscribe: m.subscribeSettingsNav,
    }),
    value: "sound",
  },
] as const;

describe.each(simpleChannels)("$name", (channel) => {
  it("consume with nothing pending returns null", async () => {
    const { consume } = channel.pick((await channel.load()) as never);
    expect(consume()).toBeNull();
  });

  it("request → consume is one-shot (second consume returns null)", async () => {
    const { request, consume } = channel.pick((await channel.load()) as never);
    request(channel.value);
    expect(consume()).toBe(channel.value);
    expect(consume()).toBeNull();
  });

  it("the latest request wins", async () => {
    const { request, consume } = channel.pick((await channel.load()) as never);
    request("first");
    request(channel.value);
    expect(consume()).toBe(channel.value);
  });

  it("a live subscriber takes the request immediately — nothing is parked for later", async () => {
    const { request, consume, subscribe } = channel.pick((await channel.load()) as never);
    const spy = vi.fn();
    subscribe(spy);
    request(channel.value);
    expect(spy).toHaveBeenCalledExactlyOnceWith(channel.value);
    // the subscriber consumed it, so a later mount must not replay it
    expect(consume()).toBeNull();
  });

  it("fans out to every subscriber; unsubscribe stops notifications", async () => {
    const { request, subscribe } = channel.pick((await channel.load()) as never);
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribe(a);
    subscribe(b);
    request(channel.value);
    expect(a).toHaveBeenCalledExactlyOnceWith(channel.value);
    expect(b).toHaveBeenCalledExactlyOnceWith(channel.value);
    offA();
    request("again");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe("view-nav (per-app keying)", () => {
  it("stores one pending view per app, consumed independently", async () => {
    const { requestView, consumePendingView } = await import("@/lib/view-nav");
    requestView("music", "songs");
    requestView("calendar", "week");
    expect(consumePendingView("music")).toBe("songs");
    // consuming music must not clear calendar
    expect(consumePendingView("calendar")).toBe("week");
    expect(consumePendingView("music")).toBeNull();
    expect(consumePendingView("calendar")).toBeNull();
  });

  it("later request for the same app overwrites the earlier one", async () => {
    const { requestView, consumePendingView } = await import("@/lib/view-nav");
    requestView("music", "songs");
    requestView("music", "favourites");
    expect(consumePendingView("music")).toBe("favourites");
    expect(consumePendingView("music")).toBeNull();
  });

  it("unknown app consumes as null", async () => {
    const { consumePendingView } = await import("@/lib/view-nav");
    expect(consumePendingView("terminal")).toBeNull();
  });

  it("a live subscriber takes the request — nothing is parked for later", async () => {
    const { requestView, consumePendingView, subscribeViewNav } = await import("@/lib/view-nav");
    const spy = vi.fn();
    subscribeViewNav(spy);
    requestView("music", "songs");
    expect(spy).toHaveBeenCalledExactlyOnceWith("music", "songs");
    expect(consumePendingView("music")).toBeNull();
  });

  it("subscribers get (app, view); unsubscribe stops them", async () => {
    const { requestView, subscribeViewNav } = await import("@/lib/view-nav");
    const spy = vi.fn();
    const off = subscribeViewNav(spy);
    requestView("calendar", "month");
    expect(spy).toHaveBeenCalledExactlyOnceWith("calendar", "month");
    off();
    requestView("music", "home");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("power", () => {
  it("lockScreen dispatches a portfolio-power event with detail 'lock'", async () => {
    const { lockScreen } = await import("@/lib/power");
    const spy = vi.fn();
    window.addEventListener("portfolio-power", spy);
    lockScreen();
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toBe("lock");
    window.removeEventListener("portfolio-power", spy);
  });
});

describe("recents", () => {
  it("starts empty", async () => {
    const { getRecents } = await import("@/lib/recents");
    expect(getRecents()).toEqual([]);
  });

  it("newest first, and re-opening an app moves it to the front without duplicates", async () => {
    const { recordRecent, getRecents } = await import("@/lib/recents");
    recordRecent("music");
    recordRecent("terminal");
    recordRecent("music");
    expect(getRecents().map((r) => r.appId)).toEqual(["music", "terminal"]);
  });

  it("caps the list at 10 entries", async () => {
    const { recordRecent, getRecents } = await import("@/lib/recents");
    const { APP_META } = await import("@/components/apps/app-meta");
    for (const meta of APP_META) recordRecent(meta.id); // 22 apps
    expect(getRecents()).toHaveLength(10);
    // last recorded app is first
    expect(getRecents()[0].appId).toBe(APP_META[APP_META.length - 1].id);
  });

  it("records a timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const { recordRecent, getRecents } = await import("@/lib/recents");
    recordRecent("safari");
    expect(getRecents()[0]).toEqual({ appId: "safari", at: 1_700_000_000_000 });
    vi.useRealTimers();
  });

  it("notifies subscribers with the new list; unsubscribe stops them", async () => {
    const { recordRecent, subscribeRecents } = await import("@/lib/recents");
    const spy = vi.fn();
    const off = subscribeRecents(spy);
    recordRecent("code");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].map((r: { appId: string }) => r.appId)).toEqual(["code"]);
    off();
    recordRecent("safari");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
