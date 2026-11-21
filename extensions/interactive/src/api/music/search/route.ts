import { NextRequest, NextResponse } from "next/server";
import { searchTracks } from "@os/lib/music-server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 200);
  if (!q) return NextResponse.json({ tracks: [] });
  try {
    return NextResponse.json({ tracks: await searchTracks(q) });
  } catch {
    return NextResponse.json({ tracks: [], error: "Search is unavailable right now." });
  }
}
