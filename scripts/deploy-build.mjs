// The production build command for Vercel and Netlify.
//
// With CONVEX_DEPLOY_KEY set (the newsletter's production deploy key), it
// first pushes the newsletter's Convex functions, then builds the site with
// NEXT_PUBLIC_CONVEX_URL pointing at that deployment (convex deploy sets it).
// Without the key it's a plain `npm run build`.

import { execSync } from "node:child_process";

const cmd = process.env.CONVEX_DEPLOY_KEY
  ? `npx convex deploy --cmd "npm run build"`
  : "npm run build";

console.log(`[deploy-build] ${cmd}`);
execSync(cmd, { stdio: "inherit" });
