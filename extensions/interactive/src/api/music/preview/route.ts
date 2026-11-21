import { NextRequest, NextResponse } from "next/server";
import { findPreview } from "@os/lib/music-server";

// Fallback for tracks that arrived without a preview (Spotify results, or
// tracks saved in a visitor's likes before the switch to iTunes).
export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("term")?.trim().slice(0, 200);
  if (!term) return NextResponse.json({ previewUrl: null });
  try {
    const match = await findPreview(term);
    return NextResponse.json({
      previewUrl: match?.previewUrl ?? null,
      matchedName: match?.name,
      matchedArtist: match?.artists,
    });
  } catch {
    return NextResponse.json({ previewUrl: null });
  }
}
