// Creates the signing keys Convex Auth needs (JWT_PRIVATE_KEY and JWKS) and
// stores them on the newsletter's Convex deployment.
//
//   node scripts/newsletter-auth-keys.mjs          → the dev deployment
//   node scripts/newsletter-auth-keys.mjs --prod   → the production deployment
//
// Run it once per deployment. Running it again signs everyone out.

import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const prod = process.argv.includes("--prod");
const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });

for (const [name, value] of [
  ["JWT_PRIVATE_KEY", privateKey],
  ["JWKS", jwks],
]) {
  // "--" so the key (which starts with dashes) isn't read as an option
  execFileSync("npx", ["convex", "env", "set", ...(prod ? ["--prod"] : []), "--", name, value], {
    stdio: "inherit",
  });
}
console.log(`Sign-in keys set on the ${prod ? "production" : "dev"} deployment.`);
