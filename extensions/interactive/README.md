# Interactive OS

The macOS / iOS-style portfolio served at `sidhxntt.dev/interactive`.

It is not a separate app. It builds and deploys with the root Next.js project,
which mounts it through a few thin route files. All of the OS's own code lives
here, imported elsewhere as `@os/*`.

```
extensions/interactive/src
├── app/                 layout, globals.css and the two pages
│   ├── layout.tsx         root layout for /interactive (metadata, theme script)
│   └── interactive/
│       ├── page.tsx       /interactive: the MacBook (desktop) or iPhone (phone) frame
│       └── os/page.tsx    /interactive/os: the OS itself, loaded inside the frame
├── api/                 handlers for /api/siri, /api/messages, /api/music/*, /api/proxy
├── components/          desktop, dock, windows, apps, boot screens, iOS home, devices
├── data/                notes, desktop items, notifications, code samples
└── lib/                 stores, navigation, music, Siri, weather, wallpaper…
```

## How the root mounts it

Each route file in the root `src/app` is a one-line re-export:

| Root file | Points to |
|---|---|
| `src/app/(os)/layout.tsx` | `@os/app/layout` |
| `src/app/(os)/interactive/page.tsx` | `@os/app/interactive/page` |
| `src/app/(os)/interactive/os/page.tsx` | `@os/app/interactive/os/page` |
| `src/app/api/<name>/route.ts` | `@os/api/<name>/route` |

To add a page or API route, write it here, then add a matching one-line file
under `src/app`. Route config such as `export const runtime` or `maxDuration`
can't be re-exported, so it has to go in the root file itself.

## Shared with the landing page

These stay in the root `src` because the landing page uses them too. Import
them with `@/`:

- `@/data/portfolio`: profile, projects and jobs (read from `input/*.json`)
- `@/lib/site-metadata`: base metadata and JSON-LD
- `@/components/landing/theme`: the light/dark script the frame page follows
- `@/components/AppIcon`: app and link icons

Content still comes from the root `input/` folder (including `input/doc/*.md`
for Siri and Messages). Images and audio stay in the root `public/` folder.

## Commands

Run everything from the repo root:

```sh
npm run dev     # landing at /, OS at /interactive
npm test        # runs the root tests and this folder's tests
npm run build
```
