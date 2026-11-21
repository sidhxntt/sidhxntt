// Builds the Game OS (extensions/game, a Vite + Three.js app) into public/game
// so Next.js serves it at /game. Runs automatically before `npm run build`, and
// before `npm run dev` when public/game doesn't exist yet.
//
//   SKIP_GAME_BUILD=1 npm run build   → skip it (e.g. for a quick local build)
//
// The game loads most assets by relative path ("sounds/…"), so the built page
// gets <base href="/game/"> and every relative URL resolves under /game/.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const gameDir = path.join(root, "extensions", "game");
const outDir = path.join(root, "public", "game");

if (process.env.SKIP_GAME_BUILD) {
  console.log("[game] SKIP_GAME_BUILD is set; skipping the Game OS build.");
  process.exit(0);
}

// `npm run dev` passes --if-missing: build once, then reuse the existing output.
if (process.argv.includes("--if-missing") && existsSync(path.join(outDir, "index.html"))) {
  process.exit(0);
}

if (!existsSync(path.join(gameDir, "package.json"))) {
  console.warn("[game] extensions/game not found; skipping. /game will return 404 until it is built.");
  process.exit(0);
}

// The game reads VITE_* settings from extensions/game/.env, which is gitignored
// and so missing on CI. Fall back to the defaults in .env.example; anything
// already set in the environment wins.
const env = { ...process.env };
const examplePath = path.join(gameDir, ".env.example");
if (!existsSync(path.join(gameDir, ".env")) && existsSync(examplePath)) {
  for (const line of readFileSync(examplePath, "utf8").split("\n")) {
    const m = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] !== "" && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}

const run = (cmd) => execSync(cmd, { cwd: gameDir, stdio: "inherit", env });

if (!existsSync(path.join(gameDir, "node_modules"))) {
  console.log("[game] installing dependencies…");
  // the game's own readme installs with --force (conflicting peer ranges)
  run("npm ci --force --no-audit --no-fund");
}

console.log("[game] building into public/game…");
run(`npx vite build --base=/game/ --outDir "${outDir}" --emptyOutDir`);

const indexPath = path.join(outDir, "index.html");
const html = readFileSync(indexPath, "utf8");
if (!html.includes("<base ")) {
  writeFileSync(indexPath, html.replace(/<head>/i, '<head>\n    <base href="/game/">'));
}
console.log("[game] done.");
