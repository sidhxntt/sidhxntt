# Profile README — setup

Everything below is one-time configuration. The README renders fine without it;
the dynamic sections just stay empty until each piece is wired up.

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
write permission the workflows cannot commit the updated README back.

## Cron schedule

| Workflow | Schedule (UTC) | What it writes |
| --- | --- | --- |
| `waka-readme.yml` | `0 0 * * *` — 00:00 | `<!--START_SECTION:waka-->` block |
| `blog-posts.yml` | `0 6 * * *` — 06:00 | `<!-- BLOG-POST-LIST -->` block |
| `github-activity.yml` | `0 8 * * *` — 08:00 | `<!--START_SECTION:activity-->` block |
| `snake.yml` (existing) | `0 0 * * *` + push to main | `output` branch SVGs |

Each has `workflow_dispatch`, so you can trigger any of them manually from the
Actions tab instead of waiting for the cron.

## WakaTime

No account exists yet, so `waka-readme.yml` will fail on its first scheduled run.

1. Sign up at https://wakatime.com
2. Install the plugin for your editor — https://wakatime.com/plugins
3. Copy the API key from https://wakatime.com/settings/api-key into the
   `WAKATIME_API_KEY` secret
4. Let a day of coding accumulate, then run the workflow manually

Until step 3, either leave the workflow disabled or expect a red X on the daily
run.

## Blog feed

The feed list is `medium.com/feed/@sidhxntt` and `sidhxntt.substack.com/feed` —
both verified live (HTTP 200, valid XML). To add another source, append its URL
to `feed_list` in `.github/workflows/blog-posts.yml`.

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
