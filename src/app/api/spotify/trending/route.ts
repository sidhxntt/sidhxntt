import { NextResponse } from "next/server";
import { spotifyFetch } from "@/lib/spotify-server";

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
};

function pickImage(images: SpotifyImage[]): string {
  if (!images?.length) return "";
  // Prefer the ~300px art; fall back to whatever exists.
  const mid = images.find((i) => i.width >= 250 && i.width <= 400);
  return (mid ?? images[Math.min(1, images.length - 1)]).url;
}

function mapTracks(items: SpotifyTrack[]) {
  return items.map((t) => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    image: pickImage(t.album.images),
    durationMs: t.duration_ms,
    // Spotify omits preview_url entirely for apps created after Nov 2024;
    // normalize to null so the client shape is stable.
    previewUrl: t.preview_url ?? null,
    spotifyUrl: t.external_urls.spotify,
  }));
}

async function searchTracks(q: string): Promise<SpotifyTrack[]> {
  // Note: this Spotify app is in restricted dev mode — search limits above 10
  // are rejected with 400 "Invalid limit", so cap at 10.
  const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
    `/search?q=${encodeURIComponent(q)}&type=track&market=US&limit=10`
  );
  return data.tracks?.items ?? [];
}

export async function GET() {
  try {
    let items: SpotifyTrack[] = [];
    try {
      // always the current year — pinning a literal would quietly start
      // serving last year's "trending" every 1 January
      items = await searchTracks(`year:${new Date().getFullYear()}`);
    } catch {
      /* fall through to fallback query */
    }
    if (items.length === 0) {
      items = await searchTracks("top hits");
    }
    return NextResponse.json({ tracks: mapTracks(items) });
  } catch (e) {
    console.error("Trending unavailable:", e);
    return NextResponse.json({
      tracks: [],
      error: "Trending unavailable",
    });
  }
}
