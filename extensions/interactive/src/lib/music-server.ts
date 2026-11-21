// Server-only music catalogue for the Music app, Siri and the Terminal.
//
// Primary source is Apple's public iTunes Search API: no key, and every result
// carries a playable 30-second preview. Spotify is a fallback only — it is used
// when SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are set and iTunes fails —
// because Spotify omits preview_url for apps created after Nov 2024 and its
// development-mode restrictions reject many requests outright.

import { spotifyConfigured, spotifyFetch } from "@os/lib/spotify-server";

/** Wire shape shared with the client (see Track in music-player.ts). */
export type MusicTrack = {
  id: string;
  name: string;
  artists: string;
  album: string;
  image: string;
  durationMs: number;
  previewUrl: string | null;
  url: string;
};

const SEARCH_LIMIT = 10;
const TRENDING_LIMIT = 25;
const COUNTRY = "us";

/* ───────────────────────────── iTunes ───────────────────────────── */

type ITunesTrack = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  previewUrl?: string;
  trackViewUrl?: string;
};

/** iTunes artwork URLs encode their size; ask for 300px instead of 100px. */
function upscaleArtwork(url: string | undefined): string {
  return url ? url.replace(/\/\d+x\d+bb\./, "/300x300bb.") : "";
}

function fromITunes(r: ITunesTrack): MusicTrack | null {
  if (r.kind !== "song" || !r.trackId || !r.trackName) return null;
  return {
    id: `itunes:${r.trackId}`,
    name: r.trackName,
    artists: r.artistName ?? "",
    album: r.collectionName ?? "",
    image: upscaleArtwork(r.artworkUrl100),
    durationMs: r.trackTimeMillis ?? 0,
    previewUrl: r.previewUrl ?? null,
    url: r.trackViewUrl ?? "",
  };
}

async function itunesGet(url: string, revalidate: number): Promise<ITunesTrack[]> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = (await res.json()) as { results?: ITunesTrack[] };
  return data.results ?? [];
}

async function itunesSearch(q: string, limit: number): Promise<MusicTrack[]> {
  const params = new URLSearchParams({ term: q, media: "music", entity: "song", limit: String(limit), country: COUNTRY });
  const results = await itunesGet(`https://itunes.apple.com/search?${params}`, 3600);
  return results.map(fromITunes).filter((t): t is MusicTrack => t !== null);
}

/** Apple Music's live "most played songs" chart, hydrated with previews. */
async function appleChart(limit: number): Promise<MusicTrack[]> {
  const res = await fetch(
    `https://rss.marketingtools.apple.com/api/v2/${COUNTRY}/music/most-played/${limit}/songs.json`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new Error(`Apple chart ${res.status}`);
  const data = (await res.json()) as { feed?: { results?: { id: string }[] } };
  const ids = (data.feed?.results ?? []).map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return [];
  // The chart has no preview URLs; one lookup call fetches them for every id.
  const results = await itunesGet(
    `https://itunes.apple.com/lookup?id=${ids.join(",")}&entity=song&country=${COUNTRY}`,
    3600,
  );
  const byId = new Map(
    results.map(fromITunes).filter((t): t is MusicTrack => t !== null).map((t) => [t.id, t]),
  );
  // keep chart order
  return ids.map((id) => byId.get(`itunes:${id}`)).filter((t): t is MusicTrack => !!t);
}

/** First iTunes match that has a preview, for tracks that arrived without one. */
export async function findPreview(term: string): Promise<MusicTrack | null> {
  const tracks = await itunesSearch(term, 3);
  return tracks.find((t) => t.previewUrl) ?? null;
}

/* ───────────────────────────── Spotify ──────────────────────────── */

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  preview_url?: string | null;
  external_urls: { spotify: string };
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
};

function pickImage(images: SpotifyImage[]): string {
  if (!images?.length) return "";
  const mid = images.find((i) => i.width >= 250 && i.width <= 400);
  return (mid ?? images[Math.min(1, images.length - 1)]).url;
}

async function spotifySearch(q: string): Promise<MusicTrack[]> {
  // development-mode apps reject search limits above 10
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
    `/search?q=${encodeURIComponent(q)}&type=track&limit=${SEARCH_LIMIT}`,
  );
  return (data.tracks?.items ?? []).map((t) => ({
    id: `spotify:${t.id}`,
    name: t.name,
    artists: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    image: pickImage(t.album.images),
    durationMs: t.duration_ms,
    previewUrl: t.preview_url ?? null, // the player resolves a preview via iTunes
    url: t.external_urls.spotify,
  }));
}

/* ───────────────────────────── Public API ───────────────────────── */

/** Runs each source in order and returns the first non-empty result. */
async function firstNonEmpty(label: string, sources: (() => Promise<MusicTrack[]>)[]): Promise<MusicTrack[]> {
  let lastError: unknown = null;
  for (const source of sources) {
    try {
      const tracks = await source();
      if (tracks.length > 0) return tracks;
    } catch (e) {
      lastError = e;
      console.error(`${label}:`, e);
    }
  }
  if (lastError) throw lastError;
  return [];
}

export function searchTracks(q: string): Promise<MusicTrack[]> {
  const sources = [() => itunesSearch(q, SEARCH_LIMIT)];
  if (spotifyConfigured()) sources.push(() => spotifySearch(q));
  return firstNonEmpty("Music search", sources);
}

export function trendingTracks(): Promise<MusicTrack[]> {
  const sources = [() => appleChart(TRENDING_LIMIT), () => itunesSearch("top hits", SEARCH_LIMIT)];
  if (spotifyConfigured()) sources.push(() => spotifySearch(`year:${new Date().getFullYear()}`));
  return firstNonEmpty("Music trending", sources);
}
