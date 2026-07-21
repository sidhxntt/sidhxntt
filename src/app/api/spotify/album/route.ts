import { NextRequest, NextResponse } from "next/server";
import { spotifyFetch } from "@/lib/spotify-server";

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyAlbumFull = {
  id: string;
  name: string;
  images: SpotifyImage[];
  external_urls: { spotify: string };
  artists: { name: string }[];
  tracks: {
    items: {
      id: string;
      name: string;
      duration_ms: number;
      preview_url: string | null;
      external_urls: { spotify: string };
      artists: { name: string }[];
    }[];
  };
};

function pickImage(images: SpotifyImage[]): string {
  if (!images?.length) return "";
  const mid = images.find((i) => i.width >= 250 && i.width <= 400);
  return (mid ?? images[Math.min(1, images.length - 1)]).url;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ album: null, tracks: [] });

  try {
    const a = await spotifyFetch<SpotifyAlbumFull>(`/albums/${encodeURIComponent(id)}`);
    const image = pickImage(a.images);
    const albumArtists = a.artists.map((x) => x.name).join(", ");
    const tracks = (a.tracks?.items ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((x) => x.name).join(", "),
      album: a.name,
      image, // album tracks lack their own art — reuse the album's
      durationMs: t.duration_ms,
      previewUrl: t.preview_url ?? null,
      spotifyUrl: t.external_urls.spotify,
    }));
    return NextResponse.json({
      album: { id: a.id, name: a.name, artists: albumArtists, image },
      tracks,
    });
  } catch (e) {
    console.error("Album unavailable:", e);
    return NextResponse.json({
      album: null,
      tracks: [],
      error: "Album unavailable",
    });
  }
}
