# Project Image Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organize every project screenshot under its project-ID folder and display each project's ordered images as an accessible carousel.

**Architecture:** Project data owns a non-empty ordered `images` array, with the first path serving as the card thumbnail. A focused `ProjectCarousel` component owns slide state and input handling; `Projects` composes it into the existing detail view. Static assets use the predictable `public/projects/<id>/<number>.png` convention.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, jsdom

---

### Task 1: Migrate project assets and data

**Files:**
- Create: `src/data/portfolio.test.ts`
- Modify: `src/data/portfolio.ts`
- Move: `public/projects/*.png` to `public/projects/<project-id>/01.png`

- [ ] **Step 1: Write the failing project-image invariant test**

Create a test that imports `projects` and asserts each record has a non-empty `images` array, every path begins with `/projects/${project.id}/`, every filename begins with a zero-padded ordinal, and no path is reused.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/data/portfolio.test.ts`

Expected: FAIL because project records still expose `preview` rather than `images`.

- [ ] **Step 3: Move the existing screenshots**

Create one folder per exact project ID and move the existing file to `01.png`:

```text
praxis.png             -> praxis/01.png
praxis_pro.png         -> praxis-pro/01.png
gitbundle.png          -> gitbundle/01.png
devtools.png           -> dev-tools/01.png
devxp.png              -> devxp/01.png
vcb.png                -> vibe-coding-bundle/01.png
mock-me.png             -> mock-me/01.png
optimac.png             -> optimac/01.png
media-automations.png   -> media-automations/01.png
```

- [ ] **Step 4: Replace `preview` with `images`**

Change `Project` to declare `images: [string, ...string[]]` and update all project records to ordered arrays such as:

```ts
images: ["/projects/praxis/01.png"],
```

- [ ] **Step 5: Run the focused invariant test**

Run: `npm test -- src/data/portfolio.test.ts`

Expected: PASS.

### Task 2: Build the carousel with test-first interactions

**Files:**
- Create: `src/components/apps/ProjectCarousel.tsx`
- Create: `src/components/apps/ProjectCarousel.test.tsx`
- Modify: `src/components/apps/Projects.tsx`

- [ ] **Step 1: Write failing component tests**

Render `ProjectCarousel` with one and three image paths using `createRoot` and React `act`. Assert that one image hides navigation; multiple images show `Slide 1 of 3`; Next and Previous wrap; dot buttons select a slide; ArrowRight and ArrowLeft navigate; and a changed `projectId` resets the carousel to slide one.

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm test -- src/components/apps/ProjectCarousel.test.tsx`

Expected: FAIL because `ProjectCarousel` does not exist.

- [ ] **Step 3: Implement the focused component**

Create `ProjectCarousel` with this public contract:

```ts
type ProjectCarouselProps = {
  projectId: string;
  projectName: string;
  images: readonly string[];
};
```

The component must:

- keep the active index in local state;
- reset it when `projectId` changes;
- wrap previous/next navigation;
- listen for Left/Right Arrow only while mounted;
- detect horizontal pointer movement of at least 40px as a swipe;
- render contained `next/image` slides with a brief directional transition;
- hide arrows, dots, and counter for a single image;
- label arrows, dots, the gallery region, and the current slide accessibly;
- suppress transition animation under `prefers-reduced-motion`.

- [ ] **Step 4: Integrate the carousel**

Replace both uses of `project.preview` in `Projects.tsx`: cards use `project.images[0]`, while details render:

```tsx
<ProjectCarousel
  projectId={project.id}
  projectName={project.name}
  images={project.images}
/>
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/components/apps/ProjectCarousel.test.tsx src/data/portfolio.test.ts`

Expected: PASS.

### Task 3: Verify repository-wide correctness

**Files:**
- Modify only if verification exposes a feature regression.

- [ ] **Step 1: Confirm no old project image paths remain**

Run: `rg 'project\.preview|/projects/(praxis|praxis_pro|gitbundle|devtools|devxp|vcb|mock-me|optimac|media-automations)\.png' src input README.md`

Expected: no matches.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 5: Inspect the final diff and asset tree**

Run: `git diff --check && find public/projects -maxdepth 2 -type f | sort && git status --short`

Expected: no whitespace errors; nine project-ID folders each contain `01.png`; changes are limited to the carousel feature, tests, assets, and planning documentation.
