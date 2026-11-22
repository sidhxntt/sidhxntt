import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Where the agent writes, and with what key. Read from the environment,
// then from the repo's .env.local and .env (so the MCP server works however
// it's started):
//   NEWSLETTER_SITE_URL    the deployment's HTTP actions address,
//                          https://<name>.convex.site (falls back to
//                          NEXT_PUBLIC_CONVEX_SITE_URL, the dev deployment)
//   NEWSLETTER_AGENT_KEY   set by `npm run newsletter:agent-key`
//   NEWSLETTER_PUBLIC_URL  the site to link to; by default the deployment's
//                          SITE_URL (localhost for dev, sidhxntt.dev for prod)

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    let value = m[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    out[m[1]] = value;
  }
  return out;
}

export type AgentConfig = { siteUrl: string; key: string; publicUrl?: string };

export function loadConfig(): AgentConfig {
  const files = { ...readEnvFile(join(REPO_ROOT, ".env")), ...readEnvFile(join(REPO_ROOT, ".env.local")) };
  const get = (name: string) => process.env[name] || files[name] || "";
  const siteUrl = (get("NEWSLETTER_SITE_URL") || get("NEXT_PUBLIC_CONVEX_SITE_URL")).replace(/\/+$/, "");
  const key = get("NEWSLETTER_AGENT_KEY");
  const publicUrl = get("NEWSLETTER_PUBLIC_URL").replace(/\/+$/, "") || undefined;
  if (!siteUrl) {
    throw new Error(
      "Set NEWSLETTER_SITE_URL (https://<deployment>.convex.site) in .env.local, or run `npx convex dev` once so NEXT_PUBLIC_CONVEX_SITE_URL is there.",
    );
  }
  if (!key) throw new Error("No NEWSLETTER_AGENT_KEY. Run `npm run newsletter:agent-key` first.");
  return { siteUrl, key, publicUrl };
}
