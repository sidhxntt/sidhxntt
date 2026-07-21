import { NextResponse } from "next/server";
import { profile } from "@/data/portfolio";
import { WALLPAPERS } from "@/lib/wallpaper-data";
import { osContext, readBrainDoc } from "@/lib/os-context";

// Siri's brain, upgraded: Claude Haiku answers with the full context of this
// web OS and picks one of the executor's actions. The shared OS context lives
// in src/lib/os-context.ts; the owner-editable persona sheet is
// input/doc/11-siri.md, read fresh each request. The client falls back to the
// local keyword engine whenever this route errors (no key, network, bad JSON).

const MODEL = "claude-haiku-4-5-20251001";
const MAX_HISTORY = 12;

const FALLBACK_PERSONA =
  "You are helpful, warm and extremely brief (one or two sentences, no markdown).";

/** Everything Siri knows — shared OS context + persona sheet + action schema. */
async function systemPrompt(): Promise<string> {
  const brainDoc = await readBrainDoc("11-siri.md");
  const persona = brainDoc
    ? `## Owner's brain sheet (hand-written; follow its persona and instructions, ignore its editing notes and code references)
${brainDoc}`
    : `## Persona
${FALLBACK_PERSONA}`;

  return `You are Siri on "Portfolio OS". You can DO things by returning an action.

${osContext()}

${persona}

## Rules for links
Any ask for ${profile.name.split(" ")[0]}'s GitHub, LinkedIn, Twitter/X, ProductHunt, Peerlist, Substack, coffee, call booking, Medium or Notion → {"kind":"browse","url":<the exact URL from the links list>}.

## Actions you may return (exactly one, or null)
{"kind":"open","app":AppId} · {"kind":"close","app":AppId} · {"kind":"minimize","app":AppId}
{"kind":"finder","loc":string} — open Finder at a location
{"kind":"spotlight"} · {"kind":"browse","url":"https://…"} — url must be http(s)
{"kind":"play","query":string} — search a song and play its preview
{"kind":"player","op":"pause"|"resume"|"next"|"prev"|"now"}
{"kind":"volume","value":0..1} or {"kind":"volume","delta":±0.15} · {"kind":"mute","on":boolean}
{"kind":"brightness","value":0.4..1} or {"kind":"brightness","delta":±0.15}
{"kind":"wallpaper","id":<one of the wallpaper ids above>} · {"kind":"theme","theme":"light"|"dark"}
{"kind":"accent","id":"blue"|"purple"|"pink"|"red"|"orange"|"green"|"graphite"}
{"kind":"weather"} · {"kind":"time"} · {"kind":"date"} — client fills the live answer; leave "say" EMPTY for these
{"kind":"power","op":"restart"|"shutdown"}
{"kind":"settings","pane":"general"|"appearance"|"wallpaper"|"display"|"dock"|"sound"}
{"kind":"project","id":string} — open one project's detail (use the ids above)
{"kind":"photo","query":string} — open one photo (id or caption words)
{"kind":"note","query":string} — open a note by title words
{"kind":"view","app":"music"|"calendar","view":string,"label":string} — music: home|search|songs|favourites; calendar: day|week|month|year

## Rules
- Reply with ONLY a JSON object: {"say": string, "action": object|null}. No prose outside JSON.
- "say" is what Siri speaks — short, natural, Siri-like. For weather/time/date actions leave "say" as "".
- Use an action whenever the user wants something done; null for pure questions you can answer from context (about ${profile.name.split(" ")[0]}, the apps, the projects, how the site was built…).
- "open the projects folder" → finder loc projects; "open projects" → open app projects. "play snake" → open game-snake; "play <anything else>" → play query.
- Never invent apps, files or actions not listed here.`;
}

type Turn = { role: "user" | "assistant"; content: string };

const VALID_KINDS = new Set([
  "open", "close", "minimize", "finder", "spotlight", "browse", "play", "player",
  "volume", "mute", "brightness", "wallpaper", "theme", "accent", "weather",
  "time", "date", "power", "settings", "project", "photo", "note", "view",
]);

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (!key) return NextResponse.json({ error: "no key" }, { status: 503 });

  let body: { message?: string; history?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const message = (body.message ?? "").slice(0, 500).trim();
  if (!message) return NextResponse.json({ error: "empty" }, { status: 400 });

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t): t is Turn => (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string")
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 500) }));

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: await systemPrompt(),
        messages: [...history, { role: "user", content: message }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    // model may wrap the JSON in fences — take the outermost object
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "no json" }, { status: 502 });

    const parsed = JSON.parse(match[0]) as { say?: unknown; action?: unknown };
    const say = typeof parsed.say === "string" ? parsed.say.slice(0, 600) : "";
    let action: Record<string, unknown> | null = null;
    if (
      parsed.action &&
      typeof parsed.action === "object" &&
      VALID_KINDS.has(String((parsed.action as Record<string, unknown>).kind))
    ) {
      action = parsed.action as Record<string, unknown>;
      // only http(s) may reach Safari
      if (action.kind === "browse" && !/^https?:\/\//.test(String(action.url ?? ""))) action = null;
      // a hallucinated wallpaper id would pass the kind check and then no-op
      // silently in setWallpaper — drop it here instead
      if (action?.kind === "wallpaper" && !WALLPAPERS.some((w) => w.id === action?.id)) action = null;
    }
    return NextResponse.json({ say, action });
  } catch (err) {
    console.error("[siri] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
