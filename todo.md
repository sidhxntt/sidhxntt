# Todo

## GitHub profile README

Done and verified. Every workflow has run green, all 39 image URLs in the README
return 200, and all four dynamic sections are populated with real content.

- [x] **Actions write permissions** — enabled
- [x] **WakaTime** — account created, `claude-code-wakatime` plugin v4.1.0
      installed, `WAKATIME_API_KEY` and `GH_TOKEN` secrets set, workflow green
- [x] **Spotify now-playing** — hosted spotify-github-profile service, uid
      wired in, card renders with cover art. No secrets, no workflow
- [x] **Blog feed** — Medium, 5 most recent posts rendering
- [x] **GitHub activity feed** — 5 most recent events rendering
- [x] **Self-host the stats services** — the public github-readme-stats (503)
      and github-profile-trophy (402) instances were both dead; both now run
      under this Vercel account and return real data
- [x] **Commit and push** — six commits on `main`

### Known limitations

- **WakaTime Code Time reads "0 secs"** until a tracker logs hours. The Claude
  Code plugin only sees Claude Code sessions. Install an editor plugin from
  https://wakatime.com/plugins to capture the rest — it reuses the same
  `~/.wakatime.cfg`, no extra configuration.
- **Substack posts are not surfaced.** Its Cloudflare layer 403s GitHub Actions
  runner IPs; a browser user agent, three retries, and two public CORS proxies
  were all tried and none worked. Four posts are missing as a result. See
  `SETUP.md` for the full detail.
- **Trigger manual workflow runs one at a time.** All three write `README.md` on
  `main`, and concurrent runs lose a push race.
- **The two Vercel deployments are not git-linked**, so they will not pick up
  upstream fixes on their own. Re-clone and `vercel deploy --prod` to update.
  Note that github-profile-trophy needs a one-line source patch each time — see
  `SETUP.md`.
