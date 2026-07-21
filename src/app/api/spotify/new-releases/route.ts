import { NextResponse } from "next/server";
import { spotifyFetch } from "@/lib/spotify-server";

type SpotifyImage = { url: string; width: number; height: number };
type SpotifyAlbum = {
  id: string;
  name: string;
  images: SpotifyImage[];
  external_urls: { spotify: string };
  artists: { name: string }[];
};

function pickImage(images: SpotifyImage[]): string {
  if (!images?.length) return "";
  const mid = images.find((i) => i.width >= 250 && i.width <= 400);
  return (mid ?? images[Math.min(1, images.length - 1)]).url;
}

async function fetchNewReleases(): Promise<SpotifyAlbum[]> {
  try {
    const data = await spotifyFetch<{ albums: { items: SpotifyAlbum[] } }>(
      "/browse/new-releases?limit=20"
    );
    return data.albums?.items ?? [];
  } catch {
    // /browse/new-releases returns 403 for newer restricted Spotify apps.
    // Fall back to searching albums tagged "new" (released in the last two
    // weeks), which regular search permissions allow. Limit capped at 10 —
    // this app rejects higher limits with 400.
    const data = await spotifyFetch<{ albums: { items: SpotifyAlbum[] } }>(
      "/search?q=tag%3Anew&type=album&limit=10"
    );
    return data.albums?.items ?? [];
  }
}

export async function GET() {
  try {
    const items = await fetchNewReleases();
    const albums = items.map((a) => ({
      id: a.id,
      name: a.name,
      artists: a.artists.map((x) => x.name).join(", "),
      image: pickImage(a.images),
      spotifyUrl: a.external_urls.spotify,
    }));
    return NextResponse.json({ albums });
  } catch (e) {
    console.error("New releases unavailable:", e);
    return NextResponse.json({
      albums: [],
      error: "New releases unavailable",
    });
  }
}
