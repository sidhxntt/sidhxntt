"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { profile, projects } from "@/data/portfolio";
import { Avatar } from "@/components/Avatar";
import { openExternal } from "@/lib/browser";
import { playClick, playNote } from "@/lib/sounds";
import { useIsMobile } from "@/lib/useIsMobile";

// ── Types & constants ──────────────────────────────────────────────

type Msg = {
  id: string;
  from: "me" | "bot";
  text: string;
  ts: number; // epoch ms
};

const STORAGE_KEY = "portfolio-messages-v1";
const MAX_MSGS = 100;

const FIRST_NAME = profile.name.split(" ")[0];

const OPENING_MESSAGE = `Hey! 👋 I'm ${FIRST_NAME}'s bot. Ask me anything about their work — or tap a suggestion below.`;

const QUICK_REPLIES = [
  "What do you build?",
  "Tell me about your projects",
  "What's your stack?",
  "Are you open to work?",
  "How do I contact you?",
];

// ── Bot brain ──────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function listNames(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function botReply(raw: string): string {
  const input = raw.toLowerCase();
  const has = (...words: string[]) => words.some((w) => input.includes(w));

  // Greetings
  if (/\b(hi|hello|hey|yo|howdy|sup|hola)\b/.test(input) && input.length < 25) {
    return pick([
      `Hey there! 👋 What would you like to know about ${FIRST_NAME}?`,
      "Hi! Ask me anything — projects, stack, availability, you name it.",
      "Hello hello! 😄 What can I tell you about?",
    ]);
  }

  // Thanks
  if (has("thank", "thanks", "thx", "appreciate")) {
    return pick([
      "Anytime! 🙌",
      "You're welcome! Anything else you want to know?",
      `Happy to help — and ${FIRST_NAME} is just an email away: ${profile.email}`,
    ]);
  }

  // Farewell
  if (has("bye", "goodbye", "see you", "later", "cya")) {
    return pick([
      `Catch you later! 👋 Don't be a stranger — ${profile.email}`,
      "Bye! Thanks for stopping by the portfolio 😊",
    ]);
  }

  // Open to work / hiring
  if (has("open to work", "hiring", "hire", "available", "job", "opportunit", "freelance", "work with")) {
    return `${FIRST_NAME} is always up for interesting opportunities! Best move is to email ${profile.email} with a few details. 🚀`;
  }

  // Contact
  if (has("contact", "email", "reach", "get in touch", "connect", "linkedin", "github", "twitter", "social")) {
    const socials = profile.socials.map((s) => s.label).join(", ");
    return `Easiest way is email: ${profile.email} 📬 You'll also find ${FIRST_NAME} on ${socials}.`;
  }

  // Resume
  if (has("resume", "cv")) {
    return `There's a full resume right here on this site — check the Resume app, or grab it at ${profile.resumeUrl}. 📄`;
  }

  // Projects
  if (has("project", "portfolio", "built", "made", "shipped", "work on")) {
    const top = projects.slice(0, 3).map((p) => `${p.name} (${p.tagline.toLowerCase()})`);
    return `A few favorites: ${listNames(top)}. Open the Projects app for the full tour! ✨`;
  }

  // Stack / skills
  if (has("stack", "skill", "tech", "language", "framework", "tools")) {
    return `The daily drivers are ${listNames(profile.skills.slice(0, 5))} — plus ${listNames(profile.skills.slice(5))} when the job calls for it. 🛠️`;
  }

  // What do you build / do
  if (has("what do you build", "what do you do", "build", "develop", "create", "engineer")) {
    return `${FIRST_NAME} is a ${profile.role.toLowerCase()} who builds for the web — mostly with ${listNames(profile.skills.slice(0, 3))}. The Projects app has the receipts. 😄`;
  }

  // Who are you / about
  if (has("who are you", "about you", "who is", "tell me about you", "yourself", "your name")) {
    return `I'm a tiny scripted bot, but the human behind me is ${profile.name} — ${profile.role.toLowerCase()}, based in ${profile.location}. 🤖`;
  }

  // Location
  if (has("where", "location", "based", "live", "from")) {
    return `${FIRST_NAME} is based in ${profile.location} 🌍 — and remote-friendly, naturally.`;
  }

  // How are you
  if (has("how are you", "how's it going", "hows it going", "what's up", "whats up")) {
    return "Running smoothly, zero unhandled exceptions today 😎 What would you like to know?";
  }

  // Default
  return `Good question — email me at ${profile.email} and I'll answer properly 😄`;
}

// ── Helpers ────────────────────────────────────────────────────────

// Claude replies sometimes arrive with light markdown despite the prompt —
// render the inline bits (**bold**, *italic*, `code`, [label](url), bare
// URLs) instead of showing raw asterisks. Anything else stays plain text.
const RICH_TOKEN =
  /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()]+)/g;

/** Preview lines (sidebar / iOS list) want the text minus the syntax. */
function stripRich(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g, "$1");
}

function renderRich(text: string): ReactNode[] {
  return text.split(RICH_TOKEN).map((part, i) => {
    if (i % 2 === 0) return part; // plain text between tokens
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^\*\*([^*\n]+)\*\*$/))) return <strong key={i}>{m[1]}</strong>;
    if ((m = part.match(/^\*([^*\n]+)\*$/))) return <em key={i}>{m[1]}</em>;
    if ((m = part.match(/^`([^`\n]+)`$/)))
      return (
        <code key={i} className="rounded bg-black/10 px-1 font-mono text-[0.85em] dark:bg-white/15">
          {m[1]}
        </code>
      );
    const link = part.match(/^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/);
    const url = link?.[2] ?? part;
    const label = link?.[1] ?? part;
    return (
      <a
        key={i}
        href={url}
        className="underline underline-offset-2"
        onClick={(e) => {
          e.preventDefault();
          openExternal(url);
        }}
      >
        {label}
      </a>
    );
  });
}

let msgCounter = 0;
function newId(): string {
  msgCounter += 1;
  return `${Date.now()}-${msgCounter}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Msg =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as Msg).id === "string" &&
        typeof (m as Msg).text === "string" &&
        typeof (m as Msg).ts === "number" &&
        ((m as Msg).from === "me" || (m as Msg).from === "bot"),
    );
  } catch {
    return [];
  }
}

// ── Component ──────────────────────────────────────────────────────

export function Messages() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // iOS-only: whether the chat screen is pushed on top of the conversation list.
  const [chatOpen, setChatOpen] = useState(false);
  const isMobile = useIsMobile() === true;
  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Mirror of `messages` so send() can build API history without re-creating
  // itself (and the input bar) on every new message.
  const messagesRef = useRef<Msg[]>([]);
  messagesRef.current = messages;

  // Hydrate from localStorage on mount; seed the opening message if empty.
  useEffect(() => {
    const stored = loadHistory();
    setMessages(
      stored.length > 0
        ? stored
        : [{ id: newId(), from: "bot", text: OPENING_MESSAGE, ts: Date.now() }],
    );
    setHydrated(true);
  }, []);

  // Persist (capped) after hydration.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MSGS)));
    } catch {
      // storage full / unavailable — chat still works in-memory
    }
  }, [messages, hydrated]);

  // Auto-scroll to bottom on new messages / typing indicator.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // Clean up pending bot-reply timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    // History before this message — the message itself goes separately.
    const history = messagesRef.current.slice(-20).map((m) => ({
      role: m.from === "me" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));
    setMessages((prev) =>
      [...prev, { id: newId(), from: "me" as const, text, ts: Date.now() }].slice(-MAX_MSGS),
    );
    setInput("");
    playNote(880, 0.12);
    setTyping(true);

    const reply = (t: string) => {
      setTyping(false);
      setMessages((prev) =>
        [...prev, { id: newId(), from: "bot" as const, text: t, ts: Date.now() }].slice(-MAX_MSGS),
      );
      playNote(660, 0.12);
    };
    // Scripted keyword bot, kept at human typing speed — the offline fallback.
    const scripted = () => {
      const timer = setTimeout(() => reply(botReply(text)), 800 + Math.random() * 600);
      timersRef.current.push(timer);
    };

    // Claude answers as Siddhant when the server has a key; any failure — no
    // key (503), network, bad payload — falls back to the scripted bot.
    fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text, history }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { text?: string }) => {
        if (typeof d.text === "string" && d.text.trim()) reply(d.text.trim());
        else scripted();
      })
      .catch(scripted);
  }, []);

  const clearChat = useCallback(() => {
    playClick();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setTyping(false);
    setMessages([{ id: newId(), from: "bot", text: OPENING_MESSAGE, ts: Date.now() }]);
  }, []);

  const last = messages[messages.length - 1];

  // ── Sidebar (desktop only, unchanged) ──
  const sidebar = (
      <aside className="hidden w-56 shrink-0 flex-col border-r border-black/10 bg-[#f0f0f3] dark:border-white/10 dark:bg-neutral-800 sm:flex">
        <div className="p-3 pb-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-black/[0.06] px-2.5 py-1.5 text-[13px] text-neutral-500 dark:bg-white/[0.08] dark:text-neutral-400">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" strokeLinecap="round" />
            </svg>
            Search
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg bg-[#0b84fe] px-2.5 py-2 text-left"
          >
            <Avatar size={36} className="text-[13px] ring-1 ring-white/40" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-white">{profile.name}</span>
                <span className="shrink-0 text-[11px] text-white/70">
                  {last ? formatTime(last.ts) : ""}
                </span>
              </div>
              <p className="truncate text-[12px] text-white/75">
                {last ? (last.from === "me" ? `You: ${stripRich(last.text)}` : stripRich(last.text)) : "iMessage"}
              </p>
            </div>
          </button>
        </div>
      </aside>
  );

  // ── Chat pane — shared between desktop and iOS; desktop classes are unchanged ──
  const chatPane = (
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-black/10 bg-white/80 px-4 py-2.5 dark:border-white/10 dark:bg-neutral-900/80">
          <div className="flex items-center gap-2.5">
            {isMobile && (
              <button
                type="button"
                aria-label="Back to conversations"
                onClick={() => {
                  playClick();
                  setChatOpen(false);
                }}
                className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#0b84fe] transition-colors active:bg-black/[0.06] dark:active:bg-white/[0.08]"
              >
                <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3 5 8l5 5" />
                </svg>
              </button>
            )}
            <Avatar size={32} className={`text-[12px] ${isMobile ? "" : "sm:hidden"}`} />
            <div>
              <div className="text-[13px] font-semibold leading-tight">{profile.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Active now
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className={`rounded-md font-medium text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-200 ${
              isMobile ? "min-h-11 px-2.5 text-[13px]" : "px-2 py-1 text-[11px]"
            }`}
          >
            Clear chat
          </button>
        </header>

        {/* Message list */}
        <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showStamp = !prev || m.ts - prev.ts > 15 * 60 * 1000;
            const mine = m.from === "me";
            return (
              <div key={m.id}>
                {showStamp && (
                  <div className="py-2 text-center text-[10px] font-medium text-neutral-400">
                    {formatTime(m.ts)}
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl leading-snug ${
                      isMobile ? "px-4 py-2 text-[15px]" : "px-3.5 py-2 text-[13px]"
                    } ${
                      mine
                        ? "rounded-br-md bg-[#0b84fe] text-white"
                        : "rounded-bl-md bg-[#e9e9eb] text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100"
                    }`}
                  >
                    {renderRich(m.text)}
                  </div>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-[#e9e9eb] px-4 py-3 dark:bg-neutral-700">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick replies */}
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                playClick();
                send(q);
              }}
              className={`shrink-0 rounded-full border border-black/10 bg-white text-[#0b84fe] transition-colors hover:bg-[#0b84fe]/10 active:bg-[#0b84fe]/20 dark:border-white/10 dark:bg-neutral-800 dark:text-[#3f9bff] ${
                isMobile ? "px-4 py-2 text-[14px]" : "px-3 py-1 text-[12px]"
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div
          className={`flex items-center gap-2 border-t border-black/10 dark:border-white/10 ${
            isMobile ? "px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2" : "px-3 py-2.5"
          }`}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="iMessage"
            className={`min-w-0 flex-1 rounded-full border border-black/15 bg-white outline-none placeholder:text-neutral-400 focus:border-[#0b84fe]/50 dark:border-white/15 dark:bg-neutral-800 dark:placeholder:text-neutral-500 ${
              isMobile ? "px-4 py-2.5 text-[15px]" : "px-3.5 py-1.5 text-[13px]"
            }`}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim()}
            aria-label="Send message"
            className={`flex shrink-0 items-center justify-center rounded-full bg-[#0b84fe] text-white transition-opacity disabled:opacity-30 ${
              isMobile ? "h-11 w-11" : "h-7 w-7"
            }`}
          >
            <svg viewBox="0 0 16 16" className={isMobile ? "h-5 w-5" : "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
            </svg>
          </button>
        </div>
      </section>
  );

  // ── iOS (<768px): conversation list is the root screen; chat pushes on top ──
  if (isMobile && !chatOpen) {
    return (
      <div className="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <div className="px-4 pb-2 pt-5">
          <h1 className="text-[32px] font-bold tracking-tight">Messages</h1>
          <div className="mt-3 flex items-center gap-2 rounded-full bg-black/[0.06] px-3.5 py-2 text-[15px] text-neutral-500 dark:bg-white/[0.08] dark:text-neutral-400">
            <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" strokeLinecap="round" />
            </svg>
            Search
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              playClick();
              setChatOpen(true);
            }}
            className="flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-black/[0.05] dark:active:bg-white/[0.06]"
          >
            <Avatar size={48} className="text-[15px]" />
            <div className="min-w-0 flex-1 border-b border-black/[0.07] pb-2.5 pt-1 dark:border-white/[0.08]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[16px] font-semibold">{profile.name}</span>
                <span className="flex shrink-0 items-center gap-0.5 text-[13px] text-neutral-400">
                  {last ? formatTime(last.ts) : ""}
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 3 5 5-5 5" />
                  </svg>
                </span>
              </div>
              <p className="line-clamp-2 text-[14px] leading-snug text-neutral-500 dark:text-neutral-400">
                {last ? (last.from === "me" ? `You: ${stripRich(last.text)}` : stripRich(last.text)) : "iMessage"}
              </p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        {chatPane}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      {sidebar}
      {chatPane}
    </div>
  );
}
