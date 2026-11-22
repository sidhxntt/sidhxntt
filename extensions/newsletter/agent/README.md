# Writing agent

Lets an agent (or you, from a terminal) write the newsletter from Markdown
files instead of the admin editor. Two ways in, sharing the same code:

- **MCP server** (`mcp.ts`), for Claude Code, Claude Desktop or any MCP client.
- **CLI** (`cli.ts`): `npm run newsletter -- <command>`.

Both talk to the newsletter's Convex deployment through `/agent/*` endpoints
(`convex/http.ts`, `convex/agent.ts`), guarded by a key. The agent can manage
posts, series and folders, upload images, read stats and send a test email to
you. It can't touch comments or readers, or email subscribers: that stays in
the admin.

**It only ever writes drafts.** Everything it creates or updates is a draft,
and it can't publish. Once you publish an entry in the admin, the agent can't
change, move, unpublish or delete it, so edits you make there (images, say)
are never overwritten by a push. The flow is: write (in Notion, or a file) →
agent pushes a draft → you review in the admin → you publish.

## Setup (once)

1. `npm install`
2. Make the key. For the dev deployment:

   ```sh
   npm run newsletter:agent-key
   ```

   For production (what sidhxntt.dev reads), with the HTTP Actions URL from
   the Convex dashboard (Production, Settings):

   ```sh
   npm run newsletter:agent-key -- --prod --site-url https://<prod>.convex.site
   ```

   This stores `NEWSLETTER_AGENT_KEY` on the deployment and, with
   `NEWSLETTER_SITE_URL`, in `.env.local` (never committed). Running it again
   replaces the key. The agent writes wherever `.env.local` points.
3. Make sure the deployment has the latest functions (`npx convex dev`, or
   `npx convex deploy` for production).

### Claude Code

The repo's `.mcp.json` registers the server; Claude Code asks once to allow
it. Check with `/mcp`.

### Claude Desktop

Settings, Developer, Edit Config, then add (with your paths):

```json
{
  "mcpServers": {
    "newsletter": {
      "command": "/Users/sidhxntt/Desktop/Code/Portfolio/sidhxntt/node_modules/.bin/tsx",
      "args": ["/Users/sidhxntt/Desktop/Code/Portfolio/sidhxntt/extensions/newsletter/agent/mcp.ts"]
    }
  }
}
```

The server finds `.env.local` from its own location, so it works from any
folder. If Claude Desktop can't find `node`, put the full path to `npx` in
`command` and `["--prefix", "<repo>", "tsx", "<repo>/extensions/newsletter/agent/mcp.ts"]`
in `args`.

## A post file

```markdown
---
title: How is the code split up?
parent: blogs/software-architectures
topic: Architecture
summary: Layers, features or services, the first decision every codebase makes.
cover: ./images/cover.png
---

Split by **what changes together**, not by what looks alike.

- [x] Draw the dependency graph
- [ ] Find the cycles

![The graph](./images/graph.png)
```

| Key | Meaning |
| --- | --- |
| `title` | Or start the text with a `# Heading` |
| `kind` | `post` (default), `series` or `folder` |
| `parent` | Path of the folder or series it sits in; leave out for the top level |
| `slug` | The last part of its link; made from the title, and kept on later updates |
| `topic` | Reuse one from `list_topics` / `npm run newsletter -- topics` |
| `summary` | One line for cards, emails and link previews |
| `cover` | A local image, an https URL, or `none` |
| `id` | Written back after the first push; later pushes update that entry |

- Headings, bold, italics, links, lists, checklists, quotes, code blocks
  (with a language), tables and images all come through, in the same shapes
  the editor uses, so pushed posts can still be edited in the admin.
- Local images are uploaded and relinked; the same image isn't uploaded
  twice. Images on other sites are linked as they are.
- Pushing a file again updates the draft. A file with an empty body only
  changes settings, so `parent` or `topic` can be changed without resending
  the text. A `status:` line is ignored: everything stays a draft.
- Keep the files in git: the `id` in each one ties it to its post.

### From Notion

A Notion export (Markdown & CSV) pushes as it is; add frontmatter for
`parent` (and `kind: series` on a series page), or the entry lands at the top
level.

- The `# Title` line becomes the title, and the id Notion adds to file names
  is ignored.
- Image and cover paths can stay `%20`-escaped, as Notion writes them.
- Callouts become quotes. A database page's property lines (`Created:`,
  `Tags:` …) are taken out of the text; `Tags` or `Topic` sets the topic and
  `Summary` the summary, unless the frontmatter does.
- Links to other exported pages point at their posts once those are pushed.
  Push the parts first, then the page that links to them (or push it again).
- Inline math (`$…$`) stays as plain text.

## CLI

```sh
npm run newsletter -- list
npm run newsletter -- push posts/part-1.md            # create or update a draft
npm run newsletter -- push posts/*.md
npm run newsletter -- pull blogs/software-architectures/how-is-the-code-split-up -o part-1.md
npm run newsletter -- move <path or id> up
npm run newsletter -- delete <path or id> --yes
npm run newsletter -- insights --days 30
npm run newsletter -- test-email <path or id>
```

## MCP tools

| Tool | Does |
| --- | --- |
| `list_posts` | The tree, with paths, ids, live or draft, and counts |
| `get_post` | A post as a Markdown file (optionally saved), to edit and push back |
| `push_markdown` | Create or update a draft from a file or Markdown text (e.g. a Notion page) |
| `save_entry` | Create a draft folder or series, or change a draft's settings |
| `move_entry` | Reorder a draft among its siblings |
| `delete_entry` | Delete a draft (needs `confirm: true`) |
| `list_topics`, `get_insights` | Topics in use; stats for 7, 30 or 90 days |
| `upload_image` | Store an image and get its link |
| `send_test_email` | A published post, to your own address only |
