// Server-only Spotify helper (Client Credentials flow). Never import from client code.

type CachedToken = { token: string; expiresAt: number };

let cached: CachedToken | null = null;

async function getAppToken(): Promise<string> {
  // Refresh when missing or less than 60s of life left.
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.token;
  }

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cached.token;
}

/** Fetch a Spotify Web API path (e.g. "/search?q=...") and return parsed JSON. */
export async function spotifyFetch<T = unknown>(path: string): Promise<T> {
  const token = await getAppToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Spotify API error ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}
