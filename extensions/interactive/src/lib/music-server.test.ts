import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test loads a fresh module so env changes are picked up and the Spotify
// token cache starts empty.
async function load() {
  vi.resetModules();
  return import("@os/lib/music-server");
}

const song = (id: number, extra: Record<string, unknown> = {}) => ({
  wrapperType: "track",
  kind: "song",
  trackId: id,
  trackName: `Song ${id}`,
  artistName: `Artist ${id}`,
  collectionName: `Album ${id}`,
  artworkUrl100: `https://is1.mzstatic.com/image/${id}/100x100bb.jpg`,
  trackTimeMillis: 200_000,
  previewUrl: `https://audio.example/${id}.m4a`,
  trackViewUrl: `https://music.apple.com/song/${id}`,
  ...extra,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.SPOTIFY_CLIENT_ID;
  delete process.env.SPOTIFY_CLIENT_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("searchTracks", () => {
  it("maps iTunes songs to playable tracks without any keys", async () => {
    fetchSpy.mockResolvedValueOnce(json({ results: [song(1), { kind: "music-video", trackId: 9 }] }));
    const { searchTracks } = await load();
    const tracks = await searchTracks("blinding lights");

    expect(fetchSpy.mock.calls[0][0]).toContain("itunes.apple.com/search?term=blinding+lights");
    expect(tracks).toEqual([
      {
        id: "itunes:1",
        name: "Song 1",
        artists: "Artist 1",
        album: "Album 1",
        image: "https://is1.mzstatic.com/image/1/300x300bb.jpg",
        durationMs: 200_000,
        previewUrl: "https://audio.example/1.m4a",
        url: "https://music.apple.com/song/1",
      },
    ]);
  });

  it("throws when iTunes fails and Spotify is not configured", async () => {
    fetchSpy.mockResolvedValueOnce(json({}, 503));
    const { searchTracks } = await load();
    await expect(searchTracks("x")).rejects.toThrow("iTunes 503");
  });

  it("falls back to Spotify when iTunes fails and keys are set", async () => {
    process.env.SPOTIFY_CLIENT_ID = "id";
    process.env.SPOTIFY_CLIENT_SECRET = "secret";
    fetchSpy
      .mockResolvedValueOnce(json({}, 503)) // iTunes
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3600 })) // Spotify token
      .mockResolvedValueOnce(
        json({
          tracks: {
            items: [
              {
                id: "abc",
                name: "Sp Song",
                duration_ms: 1000,
                external_urls: { spotify: "https://open.spotify.com/track/abc" },
                artists: [{ name: "A" }, { name: "B" }],
                album: { name: "Alb", images: [{ url: "img300", width: 300, height: 300 }] },
              },
            ],
          },
        }),
      );
    const { searchTracks } = await load();
    const tracks = await searchTracks("x");
    expect(tracks).toEqual([
      {
        id: "spotify:abc",
        name: "Sp Song",
        artists: "A, B",
        album: "Alb",
        image: "img300",
        durationMs: 1000,
        previewUrl: null,
        url: "https://open.spotify.com/track/abc",
      },
    ]);
  });

  it("returns an empty list (not an error) when nothing matches", async () => {
    fetchSpy.mockResolvedValueOnce(json({ results: [] }));
    const { searchTracks } = await load();
    await expect(searchTracks("zzzz")).resolves.toEqual([]);
  });
});

describe("trendingTracks", () => {
  it("hydrates the Apple chart with one lookup call, keeping chart order", async () => {
    fetchSpy
      .mockResolvedValueOnce(json({ feed: { results: [{ id: "2" }, { id: "1" }] } }))
      .mockResolvedValueOnce(json({ results: [song(1), song(2)] }));
    const { trendingTracks } = await load();
    const tracks = await trendingTracks();

    expect(fetchSpy.mock.calls[0][0]).toContain("rss.marketingtools.apple.com");
    expect(fetchSpy.mock.calls[1][0]).toContain("itunes.apple.com/lookup?id=2,1");
    expect(tracks.map((t) => t.id)).toEqual(["itunes:2", "itunes:1"]);
    expect(tracks.every((t) => t.previewUrl)).toBe(true);
  });

  it("falls back to an iTunes search when the chart is down", async () => {
    fetchSpy
      .mockResolvedValueOnce(json({}, 500)) // chart
      .mockResolvedValueOnce(json({ results: [song(7)] })); // search
    const { trendingTracks } = await load();
    const tracks = await trendingTracks();
    expect(fetchSpy.mock.calls[1][0]).toContain("term=top+hits");
    expect(tracks.map((t) => t.id)).toEqual(["itunes:7"]);
  });
});

describe("findPreview", () => {
  it("returns the first match that has a preview", async () => {
    fetchSpy.mockResolvedValueOnce(json({ results: [song(1, { previewUrl: undefined }), song(2)] }));
    const { findPreview } = await load();
    expect((await findPreview("song"))?.previewUrl).toBe("https://audio.example/2.m4a");
  });
});
