# Portfolio-Integrated GRS and Trophy Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate GitHub Readme Stats and GitHub Profile Trophy into the portfolio Next.js application so one Netlify deployment serves the portfolio and these stable paths:

- `https://sidhxntt.dev/services/grs`
- `https://sidhxntt.dev/services/grs/top-langs`
- `https://sidhxntt.dev/services/trophy`

**Architecture:** Keep one Netlify site, `sidhxntt`, as the only production deployment. Port the two services behind small, isolated Next.js route handlers and service modules; do not proxy to the currently separate sites because those sites currently serve the portfolio application rather than the intended cards. The handlers remain stateless: GitHub is the source of truth, Netlify environment variables hold credentials, and short-lived response caching avoids unnecessary API calls.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Netlify, GitHub API, Vitest, existing `npm run build` workflow.

**Spec:** This document is the self-contained implementation specification for the integrated-services change.

## Global Constraints

- Work only on `chore/vercel-netlify-ci`; do not modify or delete the existing Vercel projects.
- Do not commit or print `PAT_1`, `GITHUB_TOKEN1`, or `GITHUB_API` values.
- Keep the service implementation stateless; do not write generated stats, tokens, or user data to the deployment filesystem.
- Preserve the existing portfolio UI and all existing routes.
- Use the existing Netlify site `sidhxntt` and its custom domain `sidhxntt.dev` for the integrated deployment.
- Keep `grs-sidhxntt`, `trophy-sidhxntt`, and the existing Vercel projects available as rollback fallbacks until live parity is verified.
- Run `npm test`, `npx tsc --noEmit`, and `npm run build` before claiming completion.

---

### Task 1: Establish the source and response contract

**Files:**
- Inspect: `src/app/**`, `src/lib/**`, `package.json`, `README.md`, `SETUP.md`
- Inspect: the source or deployment artifacts corresponding to the current GRS and Trophy projects
- Create: `docs/superpowers/specs/2026-10-20-integrated-services-contract.md`
- Test: baseline commands listed below

**Interfaces:**
- Consumes: current portfolio route conventions and the existing GRS/Trophy behavior.
- Produces: a checked-in contract defining request parameters, response content types, cache policy, error SVGs, and environment-variable names for Tasks 2–7.

- [ ] **Step 1: Record the current baseline.**

  Run:

  ```bash
  npm test
  npx tsc --noEmit
  npm run build
  ```

  Expected: all existing tests, type checking, and the production build pass before service work begins.

- [ ] **Step 2: Inspect the current service behavior.**

  Capture the successful response shape and status for:

  ```text
  GET /api?username=sidhxntt
  GET /api/top-langs?username=sidhxntt
  GET /?username=sidhxntt&theme=dracula
  ```

  Use the known upstream/current source rather than treating the current portfolio HTML response as the service implementation. Record required query parameters, optional theme/layout parameters, rate-limit behavior, and whether each response is SVG, JSON, or HTML.

- [ ] **Step 3: Document the contract.**

  The contract must state:

  - `/services/grs` returns the stats-card response.
  - `/services/grs/top-langs` returns the language-card response.
  - `/services/trophy` returns the trophy-card response.
  - Query parameters are preserved and validated before reaching GitHub.
  - Successful card responses use the correct image content type.
  - GitHub failures return a valid, cacheable fallback SVG with a non-secret error label rather than leaking tokens or stack traces.
  - Cache duration, stale behavior, and rate-limit handling are explicit.

- [ ] **Step 4: Commit the contract.**

  ```bash
  git add docs/superpowers/specs/2026-10-20-integrated-services-contract.md
  git commit -m "docs: define integrated stats service contract"
  ```

---

### Task 2: Create shared service primitives and safe configuration

**Files:**
- Create: `src/services/github/client.ts`
- Create: `src/services/github/types.ts`
- Create: `src/services/cards/cache.ts`
- Create: `src/services/cards/svg.ts`
- Modify: `src/lib/**` only if an existing shared fetch/cache helper is the established location
- Test: `src/services/github/client.test.ts`, `src/services/cards/cache.test.ts`, `src/services/cards/svg.test.ts`

**Interfaces:**
- Consumes: the contract from Task 1.
- Produces: typed GitHub request helpers and safe card utilities used by both services.

- [ ] **Step 1: Write failing tests for configuration and request behavior.**

  Test that:

  - the GRS client reads `PAT_1` only on the server;
  - the Trophy client reads `GITHUB_TOKEN1` and `GITHUB_API` only on the server;
  - missing variables produce a controlled service error;
  - GitHub requests include authentication without exposing the token in thrown errors or logs;
  - only allowlisted query parameters are forwarded;
  - cache keys include the route and relevant query parameters.

- [ ] **Step 2: Implement the typed client.**

  Define a small interface such as:

  ```ts
  export type GitHubRequest = {
    path: string;
    query?: Record<string, string>;
  };

  export async function githubFetch<T>(request: GitHubRequest): Promise<T>;
  ```

  Use server-only environment access, bounded timeouts, response-status checks, and redacted errors. Do not put secrets in module-level client code that can be bundled into browser JavaScript.

- [ ] **Step 3: Implement stateless caching.**

  Use request/edge cache semantics or a bounded in-memory cache only as an optimization. A deployment must remain correct when the cache is empty. Configure a short TTL for successful cards and a shorter TTL for fallback responses. Never persist cache contents as committed files or build artifacts.

- [ ] **Step 4: Implement SVG escaping and fallback rendering.**

  Escape all user/API-derived text before inserting it into SVG. Add deterministic fallback SVGs for missing users, GitHub rate limits, upstream failures, and invalid query parameters.

- [ ] **Step 5: Run focused tests and commit.**

  ```bash
  npx vitest run src/services/github/client.test.ts src/services/cards/cache.test.ts src/services/cards/svg.test.ts
  git add src/services
  git commit -m "feat: add safe shared primitives for integrated cards"
  ```

---

### Task 3: Integrate GitHub Readme Stats

**Files:**
- Create: `src/services/grs/stats.ts`
- Create: `src/services/grs/languages.ts`
- Create: `src/services/grs/theme.ts`
- Create: `src/app/services/grs/route.ts`
- Create: `src/app/services/grs/top-langs/route.ts`
- Test: `src/services/grs/*.test.ts`, `src/app/services/grs/route.test.ts`, `src/app/services/grs/top-langs/route.test.ts`

**Interfaces:**
- Consumes: `githubFetch`, cache, SVG utilities, and the Task 1 contract.
- Produces: server-only handlers for `/services/grs` and `/services/grs/top-langs`.

- [ ] **Step 1: Write route tests first.**

  Mock GitHub responses and assert:

  - a valid username produces the expected SVG content type and card labels;
  - `theme=dracula` and other supported options are applied;
  - unsupported parameters are ignored or rejected according to the contract;
  - rate-limit and upstream failures return the fallback SVG;
  - repeated equivalent requests use the same cache key;
  - no token appears in the response, error, or log payload.

- [ ] **Step 2: Port the stats computation.**

  Preserve the existing card semantics: commits, pull requests, issues, repositories, and contribution totals where available. Keep GitHub API calls in the service module rather than in the route handler.

- [ ] **Step 3: Port the language computation.**

  Preserve the existing filtering for Jupyter Notebook, HTML, and CSS documented in `SETUP.md`, and preserve the current language ranking/layout behavior.

- [ ] **Step 4: Add the route handlers.**

  Return `Response` objects with the correct SVG content type, cache headers, and safe fallback behavior. The handlers must work without a browser session and must not depend on local files surviving deployment.

- [ ] **Step 5: Run focused tests and commit.**

  ```bash
  npx vitest run src/services/grs src/app/services/grs
  git add src/services/grs src/app/services/grs
  git commit -m "feat: integrate GitHub readme stats routes"
  ```

---

### Task 4: Integrate GitHub Profile Trophy

**Files:**
- Create: `src/services/trophy/data.ts`
- Create: `src/services/trophy/render.ts`
- Create: `src/services/trophy/theme.ts`
- Create: `src/app/services/trophy/route.ts`
- Test: `src/services/trophy/*.test.ts`, `src/app/services/trophy/route.test.ts`

**Interfaces:**
- Consumes: `githubFetch`, cache, SVG utilities, and the Task 1 contract.
- Produces: a server-only handler for `/services/trophy`.

- [ ] **Step 1: Write route tests first.**

  Mock GitHub API responses and assert:

  - a valid username produces the expected trophy SVG;
  - supported theme, row, column, and margin options are preserved;
  - invalid values fall back to safe bounds;
  - missing credentials, rate limits, and upstream failures return a valid fallback SVG;
  - SVG text and attributes are escaped;
  - secrets never appear in output or errors.

- [ ] **Step 2: Port the trophy data and ranking logic.**

  Preserve the current achievement calculations and the special source compatibility fix documented in `SETUP.md`; remove any runtime dependency on a deployment-specific dotenv import and read Netlify environment variables directly.

- [ ] **Step 3: Add the route handler.**

  Return the trophy SVG with deterministic output, cache headers, and the same query semantics expected by the current README embed.

- [ ] **Step 4: Run focused tests and commit.**

  ```bash
  npx vitest run src/services/trophy src/app/services/trophy
  git add src/services/trophy src/app/services/trophy
  git commit -m "feat: integrate github profile trophy route"
  ```

---

### Task 5: Configure the single Netlify deployment

**Files:**
- Modify: `netlify.toml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `SETUP.md`
- Test: Netlify configuration and CI validation

**Interfaces:**
- Consumes: the three route handlers from Tasks 3–4.
- Produces: one deployable portfolio site with service runtime configuration and secret documentation.

- [ ] **Step 1: Keep the existing portfolio build as the only build.**

  Use the existing `npm run build` command. Do not add a second build pipeline or copy generated service output into `public/`; the service routes must be built as part of the same Next.js application.

- [ ] **Step 2: Configure runtime behavior.**

  Set the Node version and Netlify Next.js settings in `netlify.toml` without storing secret values. Ensure the deployment supports server-rendered route handlers and does not convert the app to a static export.

- [ ] **Step 3: Configure production secrets in the existing `sidhxntt` Netlify site.**

  Set these as production/runtime secrets using the Netlify CLI:

  ```text
  PAT_1
  GITHUB_TOKEN1
  GITHUB_API
  ```

  Verify names and scopes only; never print values.

- [ ] **Step 4: Keep CI checks ahead of deployment.**

  Require type checking, tests, and the production build to pass before the production deploy job. A portfolio change must not publish a partially built service.

- [ ] **Step 5: Document deployment behavior.**

  Explain in `SETUP.md` that each portfolio deploy rebuilds the service code, but does not reset GitHub data or secrets. Only ephemeral in-memory/CDN cache state may clear; the next request repopulates it from GitHub.

- [ ] **Step 6: Commit configuration.**

  ```bash
  git add netlify.toml .github/workflows/deploy.yml SETUP.md
  git commit -m "ci: deploy integrated portfolio services together"
  ```

---

### Task 6: Update README consumers and preserve URL compatibility

**Files:**
- Modify: `README.md`
- Modify: `src/data/portfolio.ts` only if the URLs are represented there
- Test: URL/reference search and rendered README checks

**Interfaces:**
- Consumes: the stable route contract from Tasks 3–5.
- Produces: portfolio embeds that use the custom-domain paths.

- [ ] **Step 1: Replace the old service URLs.**

  Change the README embeds to:

  ```text
  https://sidhxntt.dev/services/grs
  https://sidhxntt.dev/services/grs/top-langs
  https://sidhxntt.dev/services/trophy
  ```

- [ ] **Step 2: Preserve query parameters.**

  Keep the existing username, theme, layout, language-filter, row, column, and margin parameters required by each card. Do not hardcode secrets or tokens into Markdown.

- [ ] **Step 3: Check for stale references.**

  Run:

  ```bash
  rg -n "grs-sidhxntt|trophy-sidhxntt|github-readme-stats|github-profile-trophy" README.md SETUP.md src input
  ```

  Any remaining old URL must be intentional and documented as a fallback.

- [ ] **Step 4: Commit consumer changes.**

  ```bash
  git add README.md src/data/portfolio.ts
  git commit -m "docs: use portfolio paths for stats cards"
  ```

---

### Task 7: Verify deployment safety and live parity

**Files:**
- Modify: tests or route code only when a verification failure identifies a concrete defect
- Test: full local suite, live endpoint checks, and deployment inspection

**Interfaces:**
- Consumes: the integrated routes, single Netlify site, and fallback deployments.
- Produces: evidence that deployments do not reset service behavior and that the custom paths render usable cards.

- [ ] **Step 1: Run the complete local gate.**

  ```bash
  npm test
  npx tsc --noEmit
  npm run build
  git diff --check
  ```

  Expected: all commands pass with no secret-like values in tracked files.

- [ ] **Step 2: Test live service responses.**

  Verify status, content type, SVG validity, and representative query parameters for:

  ```text
  https://sidhxntt.dev/services/grs?username=sidhxntt
  https://sidhxntt.dev/services/grs/top-langs?username=sidhxntt
  https://sidhxntt.dev/services/trophy?username=sidhxntt&theme=dracula
  ```

- [ ] **Step 3: Test failure behavior.**

  Exercise an unknown username, invalid layout values, missing optional parameters, GitHub rate-limit responses, and a simulated upstream failure. Confirm each produces a valid fallback without exposing credentials.

- [ ] **Step 4: Confirm deploy persistence semantics.**

  Trigger a harmless portfolio redeploy and verify:

  - the three routes remain available;
  - Netlify environment variables remain present;
  - no service data was stored in `.next`, `public`, or the repository;
  - only temporary cache entries were refreshed;
  - the portfolio UI remains unchanged.

- [ ] **Step 5: Compare with the fallback services.**

  Compare representative cards against the existing Vercel/separate Netlify deployments. Keep the fallbacks online until the output is equivalent enough for the README use case.

- [ ] **Step 6: Commit verification notes.**

  Record URLs, build IDs, and test results without recording tokens or response bodies that contain private data:

  ```bash
  git add docs/superpowers/specs/2026-10-20-integrated-services-contract.md
  git commit -m "docs: record integrated service verification"
  ```

---

### Task 8: Roll out and retire only redundant Netlify sites

**Files:**
- Modify: none unless the verification checklist requires a documented change
- External systems: Netlify `sidhxntt` site, `grs-sidhxntt` site, `trophy-sidhxntt` site

**Interfaces:**
- Consumes: passing live verification from Task 7.
- Produces: one production deployment with reversible fallback coverage.

- [ ] **Step 1: Merge only the implementation branch after review.**

  Confirm the branch contains only the integrated-service commits and does not include the user’s unrelated pre-existing worktree changes.

- [ ] **Step 2: Deploy the merged portfolio.**

  Confirm the `sidhxntt` Netlify site publishes from `main` and the custom-domain routes pass the live checks again.

- [ ] **Step 3: Keep Vercel untouched.**

  Do not remove, rename, or modify `grs-sidhxntt` or `trophy-sidhxntt` on Vercel. They remain rollback references unless the user separately requests a cleanup.

- [ ] **Step 4: Retire the two redundant Netlify sites only with explicit approval.**

  After the integrated routes have served successfully through an observation window, the separate Netlify sites may be disabled or deleted. This is a destructive external action and must be confirmed immediately before execution; otherwise leave them available as fallbacks.

- [ ] **Step 5: Define rollback.**

  If the integrated service routes fail, restore the previous README URLs or temporarily point the portfolio paths back to the known-good separate Netlify sites. Roll back the code deployment through Netlify’s previous deploy, without changing Vercel.

## Completion Checklist

- [ ] GRS and Trophy source behavior is integrated into the portfolio app, not merely proxied to the current incorrect deployments.
- [ ] One Netlify site serves the portfolio and all three service paths.
- [ ] `PAT_1`, `GITHUB_TOKEN1`, and `GITHUB_API` are production/runtime secrets on the `sidhxntt` site.
- [ ] Service routes are stateless and safe when caches are empty.
- [ ] GitHub API requests have bounded timeouts, safe errors, and short-lived caching.
- [ ] SVG output is escaped and has correct content types.
- [ ] Portfolio deploys do not erase persistent service data because no persistent service data is stored.
- [ ] README uses the `sidhxntt.dev/services/...` paths.
- [ ] Tests, typecheck, build, live endpoint checks, and failure-path checks pass.
- [ ] Existing Vercel projects remain untouched.
- [ ] Separate Netlify fallbacks are retained until explicit cleanup approval.
