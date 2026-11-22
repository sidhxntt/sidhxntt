// Turns on the newsletter's writing agent (the MCP server and CLI in
// extensions/newsletter/agent): makes a new random key, stores it on the
// Convex deployment as NEWSLETTER_AGENT_KEY, and saves it in .env.local for
// the agent to use.
//
//   npm run newsletter:agent-key                          → the dev deployment
//   npm run newsletter:agent-key -- --prod --site-url https://<prod>.convex.site
//                                                         → production (what the live site reads)
//
// Running it again replaces the key; the old one stops working at once.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const prod = argv.includes("--prod");
const siteAt = argv.indexOf("--site-url");
const siteUrl = siteAt >= 0 ? argv[siteAt + 1]?.replace(/\/+$/, "") : undefined;
if (siteAt >= 0 && !/^https:\/\/[\w-]+\.convex\.site$/.test(siteUrl ?? "")) {
  console.error("--site-url should look like https://<deployment>.convex.site");
  process.exit(1);
}

const key = randomBytes(32).toString("base64url");
// "--" so a key that starts with a dash isn't read as an option
execFileSync("npx", ["convex", "env", "set", ...(prod ? ["--prod"] : []), "--", "NEWSLETTER_AGENT_KEY", key], {
  stdio: "inherit",
});

const envFile = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
let env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
const set = (name, value) => {
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  env = re.test(env) ? env.replace(re, line) : `${env.replace(/\n*$/, "\n")}${line}\n`;
};
set("NEWSLETTER_AGENT_KEY", key);
if (siteUrl) set("NEWSLETTER_SITE_URL", siteUrl);
writeFileSync(envFile, env);

console.log(`Agent key set on the ${prod ? "production" : "dev"} deployment and saved in .env.local.`);
if (prod && !siteUrl && !/^NEWSLETTER_SITE_URL=/m.test(env)) {
  console.log(
    "Now add NEWSLETTER_SITE_URL=https://<prod>.convex.site to .env.local (Convex dashboard, Production, Settings, HTTP Actions URL), or the agent will write to the dev deployment.",
  );
}
if (!prod && /^NEWSLETTER_SITE_URL=/m.test(env) && !siteUrl) {
  console.log("Note: .env.local has NEWSLETTER_SITE_URL set; the agent uses that deployment, not dev.");
}
