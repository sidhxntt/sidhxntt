import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  try {
    // Note: this Spotify app is in restricted dev mode — search limits above 10
    // are rejected with 400 "Invalid limit", so cap at 10.
    const data = await spotifyFetch<{ tracks: { items: SpotifyTrack[] } }>(
      `/search?q=${encodeURIComponent(q)}&type=track&limit=10`
    );
    const tracks = (data.tracks?.items ?? []).map((t) => ({
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
    return NextResponse.json({ tracks });
  } catch (e) {
    console.error("Search failed:", e);
    return NextResponse.json({
      tracks: [],
      error: "Search failed",
    });
  }
}
