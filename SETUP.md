# Profile README — setup

Everything here is already configured and verified working — every workflow has
run green and all 39 image URLs in the README return 200. This document is the
record of how it is wired and what to do if a piece breaks.

## Repository secrets

Add at **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Needed by | Where to get it |
| --- | --- | --- |
| `WAKATIME_API_KEY` | `waka-readme.yml` | https://wakatime.com/settings/api-key |
| `GH_TOKEN` | `waka-readme.yml` | GitHub PAT with `repo` scope — https://github.com/settings/tokens |

`blog-posts.yml` and `github-activity.yml` need no secrets; they use the
built-in `GITHUB_TOKEN`.

## Actions

Settings → Actions → General → **Allow all actions and reusable workflows**, and
under *Workflow permissions* select **Read and write permissions**. Without
write permission the workflows cannot commit the updated README back. This is
already enabled.

## Cron schedule

| Workflow | Schedule (UTC) | What it writes |
| --- | --- | --- |
| `waka-readme.yml` | `0 0 * * *` — 00:00 | `<!--START_SECTION:waka-->` block |
| `blog-posts.yml` | `0 6 * * *` — 06:00 | `<!-- BLOG-POST-LIST -->` block |
| `github-activity.yml` | `0 8 * * *` — 08:00 | `<!--START_SECTION:activity-->` block |
| `snake.yml` (existing) | `0 0 * * *` + push to main | `output` branch SVGs |

Each has `workflow_dispatch`, so you can trigger any of them manually from the
Actions tab instead of waiting for the cron.

**Trigger manual runs one at a time.** All three commit `README.md` on `main`,
so two running together means one push is rejected with "fetch first". Each
workflow has a `concurrency` group keyed on its own name, which stops a workflow
overlapping itself but does not coordinate across the three — a single shared
group was tried and is actively harmful, because GitHub keeps only one pending
run per group and silently cancels the rest. The crons are six to eight hours
apart against jobs that finish in under two minutes, so scheduled runs never
collide.

## WakaTime

Account created, key set, workflow running green. The section renders GitHub
metrics (contributions, repo counts, most productive day) immediately.

**Code Time reads "0 secs" and the weekly blocks say "No Activity Tracked This
Week" — this is expected, not a misconfiguration.** The `claude-code-wakatime`
plugin is working: 258 heartbeats reached the server on the first day. But every
one carries the category `AI Coding`, and WakaTime does not count that toward
coding duration — `/stats/last_7_days` returns `0 secs` with an empty
`categories` array even with those heartbeats stored. Only editor heartbeats
produce Code Time.

The VS Code extension (`wakatime.vscode-wakatime`) is installed and reads the
same `~/.wakatime.cfg`, so it needs no separate key. Code Time starts
accumulating once VS Code is reloaded and files are edited.

For Xcode, install from https://github.com/wakatime/xcode-wakatime — it ships as
a helper app rather than an editor extension, so it is a separate download.

One quirk worth knowing: the action emits the Code Time and Profile Views badges
over plain `http://img.shields.io`. GitHub proxies them through camo and they
render correctly; fetching those URLs directly returns raw SVG markup, which is
the badge source rather than a broken image.

## Blog feed

Medium only — `medium.com/feed/@sidhxntt`, returning 11 posts, of which the
newest 5 are rendered.

**Substack is deliberately excluded.** `sidhxntt.substack.com/feed` is healthy
from a normal machine but its Cloudflare layer returns 403 to GitHub Actions
runner IPs. A browser user agent plus three retries did not get through, and one
failing feed fails the whole job, which left the blog section empty. Public CORS
proxies were evaluated as a workaround and rejected: `api.allorigins.win`
returned 522 or timed out on three of four attempts, and `api.rss2json.com`
emits a JSON shape the action cannot parse. The four Substack posts are simply
not surfaced. Re-add the feed if Substack ever stops blocking datacenter IPs.

To add another source, append its URL to `feed_list` in
`.github/workflows/blog-posts.yml`.

## Spotify (spotify-github-profile)

Already live. Uses the hosted service at
https://spotify-github-profile.kittinanx.com — **no Vercel deploy, no repo
secrets, no workflow**. The service holds the OAuth token and renders the card;
the README just embeds an image URL.

Current config, in the *What's on right now* section:

- `uid=312tlxjs43rzt4nefovwopuraozy`
- `theme=default` — the only theme verified to embed cover art for this account
- `cover_image=true`, `background_color=0d1117`, `bar_color=09e611` to match the
  profile's palette
- `show_offline=false` — falls back to *Recently played* rather than an
  "Offline" card when nothing is playing

If the card ever stops rendering, re-authorize at the service URL above; the uid
is stable but the stored token can expire.

Note on the existing keys: `input/09-spotify-keys.json` holds
`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` placeholders for the portfolio
site's Music app, which uses the *client-credentials* flow. Those are unrelated
to this — the hosted service does its own user OAuth and needs nothing from you
beyond the authorize click.

Self-hosted alternative if you would rather not depend on someone else's
service: fork https://github.com/kittinan/spotify-github-profile (it is a
deployable app, **not** a GitHub Action, despite what some guides claim) or
https://github.com/novatorem/novatorem, deploy to Vercel, and point the `<img>`
at your own host. That route does need `SPOTIFY_CLIENT_ID`,
`SPOTIFY_CLIENT_SECRET`, and a `SPOTIFY_REFRESH_TOKEN` from the
authorization-code flow.

## Self-hosted stats services

The README originally pointed at the shared community instances of
github-readme-stats and github-profile-trophy. Both were down, persistently
rather than transiently:

| Endpoint | Status |
| --- | --- |
| `github-readme-stats.vercel.app` | 503 — the public instance is chronically over its rate limit |
| `github-profile-trophy.vercel.app` | 402 Payment Required — the maintainer's Vercel account hit a billing cap |

Both projects are now deployed under this Vercel account
(`siddhantg2002's projects`) and the README points at them:

| Service | Host | Vercel env vars |
| --- | --- | --- |
| github-readme-stats | `grs-sidhxntt.vercel.app` | `PAT_1` |
| github-profile-trophy | `trophy-sidhxntt.vercel.app` | `GITHUB_TOKEN1`, `GITHUB_API` |

`PAT_1` and `GITHUB_TOKEN1` hold a GitHub PAT and exist to lift the API rate
limit — without one, both services fall back to 60 unauthenticated requests per
hour and start returning 503 again.

Two things worth knowing if you ever redeploy:

- **github-profile-trophy needs a source patch.** `api/index.ts` imports
  `@std/dotenv/load`, a bare specifier resolved through `deno.json`'s import
  map. The `vercel-deno` runtime does not read that map, so the function crashes
  with `ERR_MODULE_NOT_FOUND`. Deleting the import fixes it; Vercel injects env
  vars directly, so nothing is lost.
- **Top languages hides Jupyter Notebook, HTML and CSS.** Unfiltered, the Backup
  repo's notebooks took 49.7% of the card and buried everything else. Filtered,
  it reads TypeScript 62.5%, JavaScript 21.7%, Python 12.2%.

Neither deployment is wired to a git repo, so they will not rebuild on their
own. To pick up upstream changes, re-clone the project and run
`vercel deploy --prod`.
