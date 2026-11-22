<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`extensions/newsletter/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

<!-- newsletter-agent-start -->
## Writing the newsletter

Posts for sidhxntt.dev/newsletter are Markdown files pushed with the `newsletter` MCP server (registered in `.mcp.json`) or `npm run newsletter -- push <file.md>`. Read `extensions/newsletter/agent/README.md` for the frontmatter and the tools. Check `list_posts` and `list_topics` first, and never delete without being asked. The MCP only writes drafts and can't publish or change a published post: the author reviews drafts and publishes in the admin (Notion → Claude → newsletter MCP → draft → admin review → publish).
<!-- newsletter-agent-end -->
