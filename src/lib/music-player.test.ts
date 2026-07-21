import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/lib/music-player";

// The player is a module singleton that owns an HTMLAudioElement, so each test
// gets a fresh module and a stubbed global Audio (no real playback).

class FakeAudio {
  src = "";
  volume = 1;
  muted = false;
  currentTime = 0;
  duration = NaN;
  paused = true;
  private handlers: Record<string, Array<() => void>> = {};

  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  addEventListener(type: string, fn: () => void) {
    (this.handlers[type] ??= []).push(fn);
  }
  dispatch(type: string) {
    (this.handlers[type] ?? []).forEach((fn) => fn());
  }
}

let audios: FakeAudio[] = [];
const lastAudio = () => audios[audios.length - 1];

const mkTrack = (id: string, overrides: Partial<Track> = {}): Track => ({
  id,
  name: `Song ${id}`,
  artists: "Artist",
  album: "Album",
  image: "",
  durationMs: 30_000,
  previewUrl: `https://previews.example/${id}.m4a`,
  spotifyUrl: `https://open.spotify.com/track/${id}`,
  ...overrides,
});

const t1 = mkTrack("t1");
const t2 = mkTrack("t2");
const t3 = mkTrack("t3");

type Player = typeof import("@/lib/music-player");
let mp: Player;

/** Wait until the async startTrack pipeline has made `id` current. */
const untilCurrent = (id: string) =>
  vi.waitFor(() => expect(mp.getState().current?.id).toBe(id));

beforeEach(async () => {
  audios = [];
  vi.resetModules();
  window.localStorage.clear();
  vi.stubGlobal(
    "Audio",
    class extends FakeAudio {
      constructor() {
        super();
        audios.push(this);
      }
    },
  );
  mp = await import("@/lib/music-player");
});

describe("initial state", () => {
  it("starts idle with sensible defaults", () => {
    expect(mp.getState()).toMatchObject({
      current: null,
      queue: [],
      playing: false,
      shuffle: false,
      repeat: false,
      volume: 0.8,
      loadingTrackId: null,
      noPreviewId: null,
    });
  });

  it("does not create an audio element until something plays", () => {
    expect(audios).toHaveLength(0);
  });
});

describe("play", () => {
  it("plays a track with an inline preview url (no fetch needed)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    mp.play(t1, [t1, t2, t3]);
    await untilCurrent("t1");

    const s = mp.getState();
    expect(s.playing).toBe(true);
    expect(s.queue).toEqual([t1, t2, t3]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lastAudio().src).toBe(t1.previewUrl);
    expect(lastAudio().play).toHaveBeenCalled();
  });

  it("playing the current track again toggles pause/resume", async () => {
    mp.play(t1, [t1, t2]);
    await untilCurrent("t1");

    mp.play(t1); // toggle → pause
    expect(mp.getState().playing).toBe(false);
    expect(lastAudio().pause).toHaveBeenCalled();

    mp.play(t1); // toggle → resume
    expect(mp.getState().playing).toBe(true);
  });

  it("resolves missing previews through the iTunes proxy and caches the result", async () => {
    const noPreview = mkTrack("np", { previewUrl: null });
    const fetchSpy = vi.fn(async (url: string) => ({
      json: async () => ({ previewUrl: "https://itunes.example/np.m4a" }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    mp.play(noPreview, [noPreview]);
    await untilCurrent("np");
    expect(lastAudio().src).toBe("https://itunes.example/np.m4a");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/itunes/preview?term=Song%20np%20Artist");

    // switching away and back re-uses the preview cache — no second fetch
    mp.play(t1, [t1, noPreview]);
    await untilCurrent("t1");
    mp.play(noPreview);
    await untilCurrent("np");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("flags tracks with no preview instead of playing", async () => {
    const dead = mkTrack("dead", { previewUrl: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => ({ previewUrl: null }) })),
    );

    mp.play(dead, [dead]);
    await vi.waitFor(() => expect(mp.getState().noPreviewId).toBe("dead"));
    expect(mp.getState().current).toBeNull();
    expect(mp.getState().playing).toBe(false);
    expect(audios).toHaveLength(0); // never touched the audio element
  });

  it("treats a failed preview lookup as no preview", async () => {
    const dead = mkTrack("err", { previewUrl: null });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));

    mp.play(dead, [dead]);
    await vi.waitFor(() => expect(mp.getState().noPreviewId).toBe("err"));
    expect(mp.getState().playing).toBe(false);
  });
});

describe("queue stepping", () => {
  beforeEach(async () => {
    mp.play(t1, [t1, t2, t3]);
    await untilCurrent("t1");
  });

  it("next advances in order", async () => {
    mp.next();
    await untilCurrent("t2");
    mp.next();
    await untilCurrent("t3");
  });

  it("next wraps from the last track to the first", async () => {
    mp.next();
    await untilCurrent("t2");
    mp.next();
    await untilCurrent("t3");
    mp.next();
    await untilCurrent("t1");
  });

  it("prev wraps from the first track to the last", async () => {
    mp.prev();
    await untilCurrent("t3");
  });

  it("shuffle always picks a different track", async () => {
    mp.setShuffle(true);
    expect(mp.getState().shuffle).toBe(true);
    // with 2 tracks in queue, shuffle must pick "the other one" every time
    mp.setQueue([t1, t2]);
    for (let i = 0; i < 5; i++) {
      const before = mp.getState().current!.id;
      mp.next();
      const expected = before === "t1" ? "t2" : "t1";
      await untilCurrent(expected);
    }
  });

  it("stepping does nothing with an empty queue", async () => {
    mp.setQueue([]);
    mp.next();
    mp.prev();
    // nothing to advance to — still on t1
    expect(mp.getState().current?.id).toBe("t1");
  });
});

describe("audio element wiring", () => {
  beforeEach(async () => {
    mp.play(t1, [t1, t2]);
    await untilCurrent("t1");
  });

  it("timeupdate events publish progress (duration falls back to 30s)", () => {
    const a = lastAudio();
    a.currentTime = 12;
    a.dispatch("timeupdate");
    expect(mp.getState().progress).toEqual({ time: 12, duration: 30 });
  });

  it("ended + repeat restarts the same track", () => {
    mp.setRepeat(true);
    const a = lastAudio();
    a.currentTime = 29;
    a.play.mockClear();
    a.dispatch("ended");
    expect(a.currentTime).toBe(0);
    expect(a.play).toHaveBeenCalledTimes(1);
    expect(mp.getState().current?.id).toBe("t1");
  });

  it("ended without repeat advances to the next track", async () => {
    lastAudio().dispatch("ended");
    await untilCurrent("t2");
  });

  it("ended with a single-track queue just stops", async () => {
    mp.setQueue([t1]);
    lastAudio().dispatch("ended");
    expect(mp.getState().playing).toBe(false);
    expect(mp.getState().current?.id).toBe("t1");
  });

  it("only one audio element is ever created", async () => {
    mp.next();
    await untilCurrent("t2");
    expect(audios).toHaveLength(1);
  });
});

describe("controls", () => {
  it("pause is a no-op before anything played", () => {
    expect(() => mp.pause()).not.toThrow();
    expect(mp.getState().playing).toBe(false);
  });

  it("pause stops playback", async () => {
    mp.play(t1, [t1]);
    await untilCurrent("t1");
    mp.pause();
    expect(mp.getState().playing).toBe(false);
    expect(lastAudio().paused).toBe(true);
  });

  it("toggle is a no-op with no current track", () => {
    mp.toggle();
    expect(mp.getState().playing).toBe(false);
  });

  it("setVolume clamps to 0..1 and applies to the element", async () => {
    mp.play(t1, [t1]);
    await untilCurrent("t1");
    mp.setVolume(1.5);
    expect(mp.getState().volume).toBe(1);
    expect(lastAudio().volume).toBe(1);
    mp.setVolume(-0.2);
    expect(mp.getState().volume).toBe(0);
    mp.setVolume(0.5);
    expect(lastAudio().volume).toBe(0.5);
  });

  it("setQueue / setShuffle / setRepeat update state", () => {
    mp.setQueue([t2, t3]);
    mp.setShuffle(true);
    mp.setRepeat(true);
    expect(mp.getState()).toMatchObject({ queue: [t2, t3], shuffle: true, repeat: true });
  });
});

describe("subscription", () => {
  it("notifies with the new immutable state; unsubscribe stops notifications", () => {
    const spy = vi.fn();
    const off = mp.subscribe(spy);
    const before = mp.getState();
    mp.setShuffle(true);
    expect(spy).toHaveBeenCalledTimes(1);
    const after = spy.mock.calls[0][0];
    expect(after.shuffle).toBe(true);
    expect(after).not.toBe(before); // new object, old snapshot untouched
    expect(before.shuffle).toBe(false);
    off();
    mp.setRepeat(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
