import { NextRequest, NextResponse } from "next/server";

type ITunesResult = {
  previewUrl?: string;
  trackName?: string;
  artistName?: string;
};

export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("term")?.trim();
  if (!term) return NextResponse.json({ previewUrl: null });

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=3`
    );
    if (!res.ok) return NextResponse.json({ previewUrl: null });
    const data = (await res.json()) as { results?: ITunesResult[] };
    const match = (data.results ?? []).find((r) => r.previewUrl);
    if (!match?.previewUrl) return NextResponse.json({ previewUrl: null });
    return NextResponse.json({
      previewUrl: match.previewUrl,
      matchedName: match.trackName,
      matchedArtist: match.artistName,
    });
  } catch {
    return NextResponse.json({ previewUrl: null });
  }
}
