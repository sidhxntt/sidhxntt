# Todo

## GitHub profile README — remaining setup

The README, workflows, and `SETUP.md` are written but uncommitted. Setup is
essentially done — the only thing left is letting WakaTime collect a day of data,
then committing.

- [x] **Enable write permissions for Actions** — Settings → Actions → General →
      Workflow permissions → *Read and write permissions*. Without this,
      `blog-posts.yml`, `github-activity.yml`, and `waka-readme.yml` all run but
      fail to commit the updated README back.

- [x] **WakaTime** — account exists, key wired up, both secrets set.
  - [x] Sign up at https://wakatime.com
  - [x] Install a tracker — `claude-code-wakatime@wakatime` plugin v4.1.0
        installed (user scope), API key at `~/.wakatime.cfg` (mode 600).
        Tracks Claude Code sessions only; add an editor plugin from
        https://wakatime.com/plugins to also capture time spent outside Claude.
  - [x] Add repo secret `WAKATIME_API_KEY` — set 2026-08-18
  - [x] Add repo secret `GH_TOKEN` — set 2026-08-18
  - [ ] Let a day of coding accumulate, then trigger the workflow manually

- [x] **Spotify now-playing** — live. Authorized against the hosted
      spotify-github-profile service, uid wired into the README, card verified
      rendering (`default` theme, cover art, green bar, falls back to recently
      played when offline). No secrets, no workflow.

### Notes

- Workflow YAML is unlinted — neither `pyyaml` nor `actionlint` is installed
  locally. Files are tab-free and follow standard templates, but the first
  scheduled run is the real test. Each workflow has `workflow_dispatch`, so
  trigger them manually from the Actions tab rather than waiting on cron.
- `snake.yml` triggers on push to `main`, as do `ci.yml` and `preview.yml`.
  Expect those to fire when the profile changes land.
- Full context for every item above lives in `SETUP.md`.

## Uncommitted work in tree

- [ ] Review and commit: `README.md`, `SETUP.md`, the three new workflows,
      `input/04-projects.json`, `input/07-music.json`, `src/data/portfolio.ts`,
      `public/projects/media-automations.png`
