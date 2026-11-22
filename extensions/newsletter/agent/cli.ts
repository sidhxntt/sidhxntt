#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AgentClient, type Entry } from "./client";
import { loadConfig } from "./config";
import { formatTree, pullMarkdown, pushMarkdown, refFrom, today } from "./ops";

// The same things the MCP server does, from a terminal or a script:
//   npm run newsletter -- push posts/*.md
//   npm run newsletter -- pull blogs/software-architectures/part-1 [-o part-1.md]
//   npm run newsletter -- list | topics
//   npm run newsletter -- move <path or id> up|down
//   npm run newsletter -- delete <path or id> --yes
//   npm run newsletter -- insights [--days 7|30|90]
//   npm run newsletter -- test-email <path or id>

const HELP = `Usage: npm run newsletter -- <command>

  push <file.md...>                       create or update a draft from Markdown
  pull <path|id> [-o file.md]             a post as Markdown (stdout or a file)
  list                                    everything, in reading order
  topics                                  topics in use
  move <path|id> up|down                  reorder a draft among its siblings
  delete <path|id> --yes                  delete a draft
  insights [--days 7|30|90]               stats for the period
  test-email <path|id>                    email a published post to yourself

Everything is saved as a draft: publish from the admin, which is also where
published posts are edited. Settings come from .env.local: NEWSLETTER_AGENT_KEY (npm run newsletter:agent-key)
and NEWSLETTER_SITE_URL (https://<deployment>.convex.site).`;

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("-")));
const args = rest.filter((a, i) => !a.startsWith("-") && !(rest[i - 1] === "-o" || rest[i - 1] === "--days"));
const option = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

function need(what: string) {
  if (!args[0]) throw new Error(`Say which ${what}.\n\n${HELP}`);
  return args[0];
}

async function main() {
  if (!command || command === "help" || flags.has("--help") || flags.has("-h")) {
    console.log(HELP);
    return;
  }
  const client = new AgentClient(loadConfig());
  switch (command) {
    case "push": {
      if (args.length === 0) throw new Error(`Give one or more .md files.\n\n${HELP}`);
      for (const file of args) {
        const res = await pushMarkdown(client, { file });
        const state = res.entry.live ? "live" : res.entry.status;
        console.log(`${res.created ? "Created" : "Updated"} ${res.entry.path} (${state})  ${res.link}`);
        if (res.uploaded) console.log(`  uploaded ${res.uploaded} image${res.uploaded === 1 ? "" : "s"}`);
        if (res.idWritten) console.log(`  wrote id ${res.entry.id} into ${file}`);
        for (const w of res.warnings) console.log(`  note: ${w}`);
      }
      return;
    }
    case "pull": {
      const { markdown } = await pullMarkdown(client, refFrom(need("post")));
      const out = option("-o");
      if (out) {
        writeFileSync(resolve(out), markdown);
        console.log(`Saved to ${out}`);
      } else process.stdout.write(markdown);
      return;
    }
    case "list":
      console.log(formatTree(await client.call<Entry[]>("list")));
      return;
    case "topics":
      console.log((await client.call<string[]>("topics")).join("\n") || "No topics yet.");
      return;
    case "move": {
      const direction = args[1];
      if (direction !== "up" && direction !== "down") throw new Error("Say up or down.");
      const e = await client.call<Entry>("move", { ...refFrom(need("entry")), direction });
      console.log(`${e.path} is now number ${e.order + 1} in its place.`);
      return;
    }
    case "delete": {
      if (!flags.has("--yes")) throw new Error("Deleting can't be undone. Add --yes to go ahead.");
      const res = await client.call<{ deleted: string }>("delete", refFrom(need("entry")));
      console.log(`Deleted ${res.deleted}.`);
      return;
    }
    case "insights": {
      const days = Number(option("--days") ?? 30);
      if (days !== 7 && days !== 30 && days !== 90) throw new Error("--days is 7, 30 or 90.");
      type Totals = Record<string, number>;
      const d = await client.call<{
        current: Totals;
        previous: Totals;
        audience: number;
        stories: { title: string; views: number; reads: number }[];
      }>("insights", { days, today: today() });
      console.log(`Last ${days} days (the ${days} before in brackets)`);
      for (const k of ["views", "reads", "likes", "comments"]) console.log(`  ${k.padEnd(9)} ${d.current[k]} (${d.previous[k]})`);
      console.log(`  subscribers ${d.audience} now; ${d.current.subscribers} joined, ${d.current.unsubscribes} left`);
      for (const s of d.stories.slice(0, 10)) console.log(`  ${String(s.views).padStart(6)} views  ${s.title}`);
      return;
    }
    case "test-email": {
      const res = await client.call<{ to: string; skipped?: boolean }>("test-email", refFrom(need("post")));
      console.log(res.skipped ? "Email isn't set up (no AUTOSEND_API_KEY), so nothing was sent." : `Test sent to ${res.to}.`);
      return;
    }
    default:
      throw new Error(`Unknown command "${command}".\n\n${HELP}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
