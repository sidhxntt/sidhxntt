# input/

Fill-in sheets for everything in this portfolio that's still placeholder content.
One file per topic — do them in number order, stop whenever you've had enough.

**An empty string means "needs you". Anything already filled is real; just check it.**

When you're done (or done with a few), tell Claude to *apply the input folder* — each
file names the source file it maps to.

| File | What it covers | Blanks |
|---|---|---|
| `01-site.json` | Browser tab title + link previews | 0 — review only |
| `02-profile.json` | Your name, role, bio, skills | 3 |
| `03-links.json` | GitHub / LinkedIn / Twitter | 3 |
| `04-projects.json` | Project tiles + carousel images | 0 — review only |
| `05-resume.json` | In-app resume entries | 13 |
| `06-photos.json` | Photos app captions | 0 — optional |
| `07-music.json` | Your "My Songs" list | 0 — optional |
| `08-weather.json` | Fallback city | 0 — optional |
| `09-spotify-keys.json` | API keys for the Music app | 2 |
| `10-flavour-text.json` | Where the jokes live | reference only |
| `doc/11-siri.md` | Siri agent context for Claude Haiku (persona, chips, model) | 0 — optional |
| `doc/12-messages.md` | Messages "texting Siddhant" context for Claude Haiku | 0 — optional |
| `13-notes.json` | The Notes app's seed notes | 0 — optional |

Start with `02` and `04` — they're the bulk of what a visitor actually reads.

## Files you have to supply by hand

These aren't text fields — drop the actual files in place:

- **`public/resume.pdf`** — currently a stub whose text reads *"Replace public/resume.pdf"*
- **`src/app/favicon.ico`** — still the default Next.js icon
- **`src/app/opengraph-image.png`** — doesn't exist; without it, shared links unfurl bare (1200×630)
