import { NextResponse } from "next/server";
import { profile } from "@/data/portfolio";
import { osContext, readBrainDoc } from "@/lib/os-context";

// Messages' brain: Claude Haiku texting as Siddhant. Same full OS context as
// Siri (src/lib/os-context.ts) but with zero actions — knowing everything,
// doing nothing is the whole design; only Siri performs actions. The
// owner-editable persona sheet is input/doc/12-messages.md, read fresh each
// request. The client falls back to the scripted keyword bot in Messages.tsx
// whenever this route errors (no key, network, upstream failure).

const MODEL = "claude-haiku-4-5-20251001";
const MAX_HISTORY = 20;

const FALLBACK_PERSONA = `You are ${profile.name} texting from your phone. First person, casual iMessage tone, 1–3 short sentences, no markdown, never assistant-speak.`;

async function systemPrompt(): Promise<string> {
  const brainDoc = await readBrainDoc("12-messages.md");
  const persona = brainDoc
    ? `## Owner's brain sheet (hand-written; follow its persona and voice rules, ignore its editing notes and code references)
${brainDoc}`
    : `## Persona
${FALLBACK_PERSONA}`;

  return `You are ${profile.name}, texting a visitor inside the Messages app of your own portfolio.

${osContext()}

${persona}

## Hard rules
- Reply with plain text only — the exact chat bubble ${profile.name.split(" ")[0]} would send. No JSON, no markdown, no bullet points.
- You know the whole OS but you can perform NO actions: you cannot open apps, play music, change settings or open links. Only Siri can. Asked to do something → say so in character and point them to Siri.
- Personal facts (jobs, projects, skills, availability) come only from the context above — never invent biography. Anything else — general knowledge, opinions, banter — answer freely as ${profile.name.split(" ")[0]}.
- Keep it short: texting cadence, 1–3 sentences.`;
}

type Turn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
  if (!key) return NextResponse.json({ error: "no key" }, { status: 503 });

  let body: { message?: string; history?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const message = (body.message ?? "").slice(0, 1000).trim();
  if (!message) return NextResponse.json({ error: "empty" }, { status: 400 });

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t): t is Turn => (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string")
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 1000) }));

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
    const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    if (!text) return NextResponse.json({ error: "empty reply" }, { status: 502 });

    return NextResponse.json({ text: text.slice(0, 1200) });
  } catch (err) {
    console.error("[messages] failed:", err);
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
