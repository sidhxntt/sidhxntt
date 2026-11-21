import { NextResponse } from "next/server";
import { trendingTracks } from "@os/lib/music-server";

export async function GET() {
  try {
    return NextResponse.json({ tracks: await trendingTracks() });
  } catch {
    return NextResponse.json({ tracks: [], error: "Top Charts are unavailable right now." });
  }
}
