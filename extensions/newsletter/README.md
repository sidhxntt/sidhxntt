# Newsletter

Siddhant's newsletter at `sidhxntt.dev/newsletter`: nested posts (folders,
series and their parts), a rich-text editor at `/newsletter/admin`, likes,
Reddit-style comments, bookmarks with a reader profile page, Medium-style
stats for the author and email to subscribers. The backend is
[Convex](https://convex.dev); sign-in is Google only; emails go through
[AutoSend](https://autosend.com).

It builds and deploys with the root Next.js app, which mounts it through
one-line route files in `src/app/(newsletter)`.

```
extensions/newsletter
├── convex/              the backend (Convex functions, deployed with `npx convex deploy`)
│   ├── schema.ts          posts (tree), comments (threads), likes, bookmarks, subscribers, stats, auth tables
│   ├── auth.ts            Google sign-in (Convex Auth)
│   ├── lib.ts             who's the admin (ADMIN_EMAIL, Google-verified only)
│   ├── posts.ts           reading by path, the admin's tree, save / move / delete
│   ├── comments.ts        nested comments, edit, delete, moderation
│   ├── likes.ts           likes on posts and comments
│   ├── bookmarks.ts       saving posts, and a reader's profile (saved, liked, comments)
│   ├── analytics.ts       views and reads, and the admin's Insights
│   ├── days.ts            calendar days in India time for the stats
│   ├── crons.ts           clears per-visitor rows the stats no longer need
│   ├── media.ts           image uploads, and copying pasted images into storage
│   ├── subscribers.ts     double opt-in, unsubscribe
│   ├── emails.ts          AutoSend: confirmation and new-post emails
│   └── _generated/        written by `npx convex dev`; keep it committed
├── agent/               writing from Markdown: MCP server, CLI (see agent/README.md)
└── src/                 the pages (imported as @nl/*)
    ├── app/home.tsx       /newsletter, design option D
    ├── app/entry.tsx      /newsletter/<path…>: a post, a series or a folder
    ├── app/topic.tsx      /newsletter/topic/<name>
    ├── app/profile.tsx    /newsletter/profile: saved posts, likes and comments
    ├── app/admin/         /newsletter/admin: dashboard, editor (Tiptap), paste clean-up
    ├── components/        header, comments, likes, subscribe form…
    └── lib/               Convex URL, server-side loading, HTML sanitising
```

## One-time setup

Everything below needs your own accounts, so it's done once by hand.

### 1. Create the Convex project

From the repo root (`convex.json` already points Convex at
`extensions/newsletter/convex`):

```sh
npm run newsletter:dev        # = npx convex dev
```

It asks you to log in, creates a project and a dev deployment, writes
`CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`, and keeps
the functions in sync while it runs. Leave it running next to `npm run dev`.

### 2. Sign-in keys and site URL

In a second terminal:

```sh
npm run newsletter:keys                                  # JWT_PRIVATE_KEY and JWKS
npx convex env set SITE_URL http://localhost:3000
```

### 3. Google sign-in

In [Google Cloud Console](https://console.cloud.google.com/auth/overview), in
a project of your own:

1. Set up the **Google Auth Platform** (app name, support email, audience
   **External**). Then **publish the app** under Audience. While it's in
   "Testing" only the test users you list can sign in, and readers couldn't
   comment.
2. **Clients → Create client → Web application.**
   - Authorized JavaScript origins: `http://localhost:3000` and `https://sidhxntt.dev`
   - Authorized redirect URIs: your deployment's HTTP Actions URL plus
     `/api/auth/callback/google`. That's your `NEXT_PUBLIC_CONVEX_URL` with
     `.convex.cloud` changed to `.convex.site`, for example
     `https://happy-otter-123.convex.site/api/auth/callback/google`. Add one
     for the dev deployment and one for production.
3. Store the client on Convex:

   ```sh
   npx convex env set AUTH_GOOGLE_ID <client id>
   npx convex env set AUTH_GOOGLE_SECRET <client secret>
   ```

Now open `http://localhost:3000/newsletter/admin` and sign in with
`siddhantg2002@gmail.com`. Any other Google account is a reader: it can like
and comment, nothing else. To change the admin, set `ADMIN_EMAIL` on Convex.

### 4. Email (AutoSend)

1. In AutoSend, add and verify the domain you'll send from (for example
   `mail.sidhxntt.dev`, whose DNS records live in GoDaddy), and create an
   API key in the same AutoSend project.
2. Store them on Convex:

   ```sh
   npx convex env set AUTOSEND_API_KEY <key>
   npx convex env set NEWSLETTER_FROM_EMAIL newsletter@mail.sidhxntt.dev
   npx convex env set NEWSLETTER_FROM_NAME "Siddhant Gupta"
   ```

Without an API key nothing is sent; confirmation links are printed in the
Convex logs instead, which is handy locally.

### 5. Production

```sh
npm run newsletter:deploy                                # = npx convex deploy
npm run newsletter:keys -- --prod
npx convex env set --prod SITE_URL https://sidhxntt.dev
npx convex env set --prod AUTH_GOOGLE_ID <client id>
npx convex env set --prod AUTH_GOOGLE_SECRET <client secret>
npx convex env set --prod AUTOSEND_API_KEY <key>
npx convex env set --prod NEWSLETTER_FROM_EMAIL newsletter@mail.sidhxntt.dev
```

Then, in both **Vercel** and **Netlify**, add the environment variable
`CONVEX_DEPLOY_KEY` (Convex dashboard → production deployment → Settings →
Deploy key). The build command, `node scripts/deploy-build.mjs`, uses it to
push the newsletter's functions and point the site at production on every
deploy. Netlify reads that command from `netlify.toml`; in Vercel set it under
Settings → Build and Deployment → Build Command.

Without `NEXT_PUBLIC_CONVEX_URL` the site still builds; the newsletter pages
say it isn't connected yet.

## Writing

- **New post** in the admin. Paste from Notion, Google Docs, Medium or any
  page: headings, bold, italics, links, lists, checklists, quotes, code
  blocks, tables and images keep their formatting. Pasted images are copied
  into Convex storage, so they keep working after the original link expires.
  Notion's image links do expire.
- **Nesting:** make a **Series** (parts read in order, numbered) or a
  **Folder** (a group, like Blogs or Misc), then use **Add inside** on it, or
  pick it under **Inside** in a post's settings. Reorder with the arrows.
- **Publish** makes it public within a minute (pages are cached for 60s).
  Anything inside a draft stays hidden.
- **Email subscribers** appears on a published post: send yourself a test
  first, then send it to everyone confirmed. Each post can be emailed once;
  sending again asks first.
- **Shortcuts:** ⌘S (Ctrl+S) saves without changing whether the post is live.
  The settings button at the top right hides the sidebar for distraction-free
  writing.
- **Insights** (a tab in the admin) shows views and reads by day, read ratio,
  likes, comments and subscriber growth for 7, 30 or 90 days, with each
  story's numbers. A view is one visitor opening a post that day; a read is
  that visitor reaching its end after a fair share of its reading time. Your
  own visits never count. Days run on India time (`convex/days.ts`).
- **Your address can't subscribe:** you write the newsletter, so the
  subscribe form is hidden for you, the backend refuses your email, and it's
  left out of sends and counts.
- **Saving:** readers (and you) can save any post with **Save** and find it
  again under **Saved posts** in the account menu.
- **Comments:** readers sign in with Google. Replies nest to any depth;
  readers edit or delete their own; you can remove any from the post or the
  admin's Comments tab.

## Writing from Markdown

An agent can write posts from Markdown files through the `newsletter` MCP
server, or you can push them with `npm run newsletter -- push <file.md>`.
Setup, the frontmatter and the tools are in [agent/README.md](agent/README.md).

## Tests

`npm test` runs these too:

- `convex/newsletter.test.ts`: the backend on an in-memory Convex
  (convex-test). Covers the admin gate, nested paths, drafts, likes, comment
  threads and subscriptions.
- `convex/agent.test.ts`: the agent endpoints (key check, paths, upsert,
  uploads, publishing, deleting).
- `agent/markdown.test.ts`: Markdown to the editor's HTML and back.
- `convex/analytics.test.ts`: views and reads, Insights, the author being
  kept off the list, and bookmarks with the profile page.
- `src/app/admin/RichText.test.tsx`: pasting Google Docs, Notion-style HTML
  and VS Code code into the real editor.
- `src/components/Comments.test.tsx`: the thread UI.
- `src/lib/render.test.ts`: what reaches readers is sanitised.
