import { readFile } from "node:fs/promises";
import path from "node:path";
import { profile, projects, pictures, linkApps } from "@/data/portfolio";
import { seedNotes } from "@/data/notes";
import { WALLPAPERS } from "@/lib/wallpaper-data";
import { APP_META } from "@/components/apps/app-meta";

// Server-only. The shared half of every Claude-backed surface's system prompt:
// what this OS is, who Siddhant is, what's inside. Siri layers its action
// schema on top; Messages layers its texting persona. The hand-written half
// lives in input/doc/*.md and is read at request time via readBrainDoc.

/** Everything a model needs to know about the OS — apps, files, data, links. */
export function osContext(): string {
  const projectLines = projects
    .map((p) => `  - id "${p.id}": ${p.name} — ${p.tagline}. Tech: ${p.tech.join(", ")}`)
    .join("\n");
  const photoLines = pictures.map((p) => `  - id "${p.id}": "${p.caption}"`).join("\n");
  const wallpaperList = WALLPAPERS.map((w) => `"${w.id}" (${w.name})`).join(", ");
  const linkLines = [
    ...profile.socials.map((s) => `  - ${s.label}: ${s.url}`),
    ...linkApps.map((l) => `  - ${l.name}: ${l.url}`),
  ].join("\n");

  return `"Portfolio OS" is ${profile.name}'s interactive portfolio that looks and behaves like macOS on desktop and iOS on phones.

## The person
${profile.name}, ${profile.role}. Email: ${profile.email}. Location: ${profile.location}. Skills: ${profile.skills.join(", ")}.
Bio: ${profile.bio.join(" ")}

## Apps (AppId → what it is)
- "about": About Me app (Apple Notes clone, editable). Notes: ${seedNotes.map((n) => `"${n.title}"`).join(", ")}, plus "Hello there 👋"
- "projects": Projects app — portfolio case studies
- "pictures": Photos app — photo library
- "resume": Resume/CV viewer (also the desktop file resume.pdf)
- "contact": Contact card with email + social links (desktop file contact.mail)
- "music": Apple-Music-style player (Spotify search, 30s iTunes previews, Trending, My Songs, Favourites)
- "myfolder": Finder (macOS) / Files (iOS)
- "calendar": Calendar with Day/Week/Month/Year views
- "settings": System Settings (panes: general, appearance, wallpaper, display, dock, sound)
- "terminal": working shell with commands like open/close/play/wallpaper
- "messages": iMessage thread with ${profile.name.split(" ")[0]}
- "code": VS-Code-style source viewer showing this site's real code
- "photobooth": Photo Booth using the webcam
- "activity": Activity Monitor (fake processes)
- "weather": Weather app (live Open-Meteo data)
- "safari": Safari browser — all links open here through a server proxy
- Games (each its own app): ${APP_META.filter((a) => a.id.startsWith("game-")).map((a) => `"${a.id}" ${a.name}`).join(", ")}. All support keyboard + touch.

## Finder locations
"recents", "applications", "desktop", "documents", "downloads", "macintoshhd" (storage), "games" (folder listing the games), "trash" (Bin), "projects", "pictures".
Desktop files: about-me.txt (opens About Me), resume.pdf (opens Resume), contact.mail (opens Contact); folders Projects, Pictures, Games.

## Projects
${projectLines}

## Photos (captions)
${photoLines}

## ${profile.name.split(" ")[0]}'s links (the ONLY URLs to use for his profiles — never guess, shorten or substitute)
${linkLines}

## System controls that exist
Wallpapers: ${wallpaperList}. Accents: blue, purple, pink, red, orange, green, graphite. Theme: light/dark. Volume 0–1, brightness 0.4–1 (min 40%). Sounds can be muted.

## How this site is built
Next.js 16, React 19, TypeScript, Tailwind v4 and framer-motion; sounds are Web-Audio-synthesized; the code is visible in the "code" app.`;
}

/**
 * Hand-written brain sheet from input/doc — the owner-editable half of a
 * system prompt. Returns null when the file is missing (e.g. a deploy that
 * skipped the folder) so callers can fall back to a built-in persona.
 */
export async function readBrainDoc(file: string): Promise<string | null> {
  try {
    const text = await readFile(path.join(process.cwd(), "input", "doc", file), "utf8");
    return text.trim() || null;
  } catch {
    return null;
  }
}
