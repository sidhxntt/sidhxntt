# HOT Projects and Rudder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Rudder and its six-image carousel, preserve Media Automations as a normal project, and render HOT project folders red with a fire mark in Finder.

**Architecture:** Portfolio data explicitly owns HOT classification through an optional `hot` flag and owns ordered image paths. The reusable SVG `FolderIcon` accepts a HOT variant, while Finder chooses that variant only for HOT project records. Existing carousel and project-detail behavior remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Vitest, jsdom

---

### Task 1: Define and verify HOT project data

**Files:**
- Modify: `src/data/portfolio.test.ts`
- Modify: `src/data/portfolio.ts`
- Modify: `input/04-projects.json`
- Move: `public/projects/praxis/01.png` to `public/projects/hots/praxis/01.png`
- Add: `public/projects/hots/rudder/01.png` through `06.png`

- [ ] **Step 1: Write failing data tests**

Add assertions that Rudder exists with `hot: true`, exactly six sequential images under `/projects/hots/rudder/`, and repository URL `https://github.com/sidhxntt/rudder`; Praxis is HOT at `/projects/hots/praxis/01.png`; Media Automations exists without HOT classification at `/projects/media-automations/01.png`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/data/portfolio.test.ts`

Expected: FAIL because Rudder and HOT classification do not exist and Praxis still points to the old path.

- [ ] **Step 3: Add the data model and records**

Extend `Project` with `hot?: boolean`; add the documented Rudder record with a concise, evidence-bounded description and verified stack; mark Rudder and Praxis HOT; leave Media Automations non-HOT. Mirror the same fields and paths in `input/04-projects.json`.

- [ ] **Step 4: Install the supplied asset structure**

Copy the user-supplied `public/projects/hots/` tree into the worktree and remove the obsolete `public/projects/praxis/01.png` path there. Do not modify or regenerate the supplied screenshots.

- [ ] **Step 5: Run the focused data tests and verify GREEN**

Run: `npm test -- src/data/portfolio.test.ts`

Expected: PASS.

### Task 2: Render HOT Finder folders

**Files:**
- Create: `src/components/FolderIcon.test.tsx`
- Modify: `src/components/AppIcon.tsx`
- Modify: `src/components/apps/MyFolder.tsx`

- [ ] **Step 1: Write failing folder-icon tests**

Render the default and HOT `FolderIcon` variants with React `createRoot`. Assert the default contains blue folder surfaces and no fire mark; the HOT variant exposes red folder surfaces and a fire mark identifiable by `data-hot-mark="true"`.

- [ ] **Step 2: Run the icon test and verify RED**

Run: `npm test -- src/components/FolderIcon.test.tsx`

Expected: FAIL because `FolderIcon` has no `hot` property or fire mark.

- [ ] **Step 3: Implement the HOT icon variant**

Add `hot?: boolean` to `FolderIcon`. Keep the current geometry; switch its gradients to red when HOT and add a centered, scalable fire glyph within the SVG. Use unique gradient IDs for normal/HOT instances and preserve `aria-hidden` behavior.

- [ ] **Step 4: Connect Finder to project HOT data**

In the `loc === "projects"` mapping, render `<FolderIcon size={px} hot={p.hot} />`. Do not alter parent folders, Pictures, Games, or non-HOT project folders.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/components/FolderIcon.test.tsx src/data/portfolio.test.ts`

Expected: PASS.

### Task 3: Verify integration and quality

**Files:**
- Modify only if verification finds a scoped defect.

- [ ] **Step 1: Verify asset and data invariants**

Run: `find public/projects -maxdepth 3 -type f | sort` and confirm Rudder has six HOTS images, Praxis has one HOTS image, Media Automations remains outside HOTS, and the old Praxis path is absent.

- [ ] **Step 2: Run all automated checks**

Run: `npm test`, `npx tsc --noEmit`, and `npm run build`.

Expected: all tests pass; TypeScript and the production build exit successfully.

- [ ] **Step 3: Run UI quality checks**

Run the Impeccable detector on `src/components/AppIcon.tsx` and `src/components/apps/MyFolder.tsx`. If the in-app Browser is available, verify Finder shows red fire folders for Rudder and Praxis, blue for Media Automations, and Rudder detail advances through six carousel slides.

- [ ] **Step 4: Inspect final scope**

Run: `git diff --check`, `git status --short`, and inspect the complete diff against the approved design.

Expected: no whitespace errors or unrelated source changes; supplied assets remain byte-for-byte unchanged.
