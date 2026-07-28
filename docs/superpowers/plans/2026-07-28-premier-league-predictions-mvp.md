# Premier League Predictions MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Thai Premier League prediction MVP with mock data, gameweek switching, three tabs, and a preview LIFF entry gate.

**Architecture:** Keep the root landing route server-rendered and put browser state in a focused client dashboard component. Store domain types/mock fixtures in `lib/mock-data.ts` and pure prediction transformations in `lib/predictions.ts`, so future Supabase/FPL adapters can replace the data source without rewriting the UI.

**Tech Stack:** Next.js 16.2.12 App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner with Node 24 type stripping, ESLint.

## Global Constraints

- Use Next.js App Router conventions from the installed `node_modules/next/dist/docs/`.
- Keep phase 1 mock-only; do not invent real LIFF, Supabase, FPL, or LINE credentials.
- Use `NEXT_PUBLIC_LIFF_ID` only as a public configuration placeholder.
- Keep the UI compact and mobile-first for approximately 20 users.
- UI copy is Thai and all displayed match times use Asia/Bangkok labels.

---

### Task 1: Establish pure prediction domain helpers with tests

**Files:**
- Create: `lib/predictions.ts`
- Create: `tests/predictions.test.ts`
- Modify: `package.json` scripts to add `test`

**Interfaces:**
- Produces `PredictionChoice`, `PredictionMap`, `applyPrediction`, `isPredictionComplete`, and `getPredictionPercentages` for the dashboard.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "node:test";
import {
  applyPrediction,
  getPredictionPercentages,
  isPredictionComplete,
} from "../lib/predictions";

describe("prediction helpers", () => {
  it("updates one fixture without mutating the existing map", () => {
    const original = { fixture_a: "home" as const };
    const next = applyPrediction(original, "fixture_b", "away");
    expect(next).toEqual({ fixture_a: "home", fixture_b: "away" });
    expect(original).toEqual({ fixture_a: "home" });
  });

  it("only reports complete when every fixture has a choice", () => {
    expect(isPredictionComplete(["a", "b"], { a: "draw" })).toBe(false);
    expect(isPredictionComplete(["a", "b"], { a: "draw", b: "home" })).toBe(true);
  });

  it("calculates percentages and handles an empty audience", () => {
    expect(getPredictionPercentages(["home", "home", "draw", "away"])).toEqual({
      home: 50,
      draw: 25,
      away: 25,
    });
    expect(getPredictionPercentages([])).toEqual({ home: 0, draw: 0, away: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tests/predictions.test.ts`
Expected: FAIL because `lib/predictions.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type PredictionChoice = "home" | "draw" | "away";
export type PredictionMap = Record<string, PredictionChoice>;

export function applyPrediction(
  current: PredictionMap,
  fixtureId: string,
  choice: PredictionChoice,
): PredictionMap {
  return { ...current, [fixtureId]: choice };
}

export function isPredictionComplete(
  fixtureIds: string[],
  predictions: PredictionMap,
): boolean {
  return fixtureIds.length > 0 && fixtureIds.every((fixtureId) => predictions[fixtureId]);
}

export function getPredictionPercentages(choices: PredictionChoice[]) {
  const total = choices.length;
  const counts = { home: 0, draw: 0, away: 0 };
  choices.forEach((choice) => { counts[choice] += 1; });
  return {
    home: total ? Math.round((counts.home / total) * 100) : 0,
    draw: total ? Math.round((counts.draw / total) * 100) : 0,
    away: total ? Math.round((counts.away / total) * 100) : 0,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test tests/predictions.test.ts`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/predictions.ts tests/predictions.test.ts package.json
git commit -m "test: add prediction domain helpers"
```

### Task 2: Add mock domain data and application routes

**Files:**
- Create: `lib/mock-data.ts`
- Create: `app/dashboard/page.tsx`
- Create: `.env.example`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- `mock-data.ts` exports `Gameweek`, `Fixture`, `LeaderboardEntry`, `UserProfile`, `gameweeks`, `fixturesByGameweek`, `leaderboardByGameweek`, and `currentUser`.
- `/dashboard` imports `PredictionApp` and passes serializable mock data.

- [ ] **Step 1: Add typed mock data** with stable IDs, Thai labels, Bangkok-formatted date strings, team crests, three gameweeks, four fixtures per gameweek, and leaderboard entries.
- [ ] **Step 2: Add the dashboard route** as a server page that renders the client app with current user and mock collections.
- [ ] **Step 3: Add `.env.example`** with `NEXT_PUBLIC_LIFF_ID=` and `NEXT_PUBLIC_DEMO_MODE=true`.
- [ ] **Step 4: Replace the starter page and metadata** with the Thai landing route and app title/description.
- [ ] **Step 5: Run `npm run lint` and `npm run build`** and fix only errors caused by this task.
- [ ] **Step 6: Commit** with `git commit -m "feat: add prediction MVP routes and mock data"`.

### Task 3: Build the interactive mobile-first dashboard UI

**Files:**
- Create: `app/components/prediction-app.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `PredictionApp` receives `currentUser`, `gameweeks`, `fixturesByGameweek`, and `leaderboardByGameweek` as serializable props.

- [ ] **Step 1: Build the header and gameweek selector** with user avatar, preview badge, current gameweek summary, and instant dropdown changes.
- [ ] **Step 2: Build the leaderboard tab** with season/current gameweek toggle, rank cards, form dots, score summary, and share button.
- [ ] **Step 3: Build the prediction tab** with fixture cards, Thai date/time, home/draw/away choices, color-highlighted selection, completion counter, and confirm action.
- [ ] **Step 4: Build the result tab** with score/status cards, outcome percentages, and grouped predictor avatars/names for home/draw/away.
- [ ] **Step 5: Add the confirmation modal** for share/no-share preview behavior and prevent confirmation until every fixture is selected.
- [ ] **Step 6: Add responsive visual styling** in `globals.css`, including navy shell, card surfaces, accent colors, focus-visible states, reduced-motion behavior, and fallback-friendly image styles.
- [ ] **Step 7: Run `npm run lint` and `npm run build`**.
- [ ] **Step 8: Commit** with `git commit -m "feat: build interactive prediction dashboard"`.

### Task 4: Verify the complete phase and publish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document local run, preview mode, route map, and phase 2 environment requirements** in `README.md`.
- [ ] **Step 2: Run the full verification commands**: `npm run test`, `npm run lint`, and `npm run build`.
- [ ] **Step 3: Inspect `git diff` and `git status`** to ensure no secrets or generated `.next` output are staged.
- [ ] **Step 4: Initialize Git if needed, set the provided origin, and fetch remote refs** without overwriting local files.
- [ ] **Step 5: Create one final commit** with `git add -A` and `git commit -m "docs: document prediction MVP"`.
- [ ] **Step 6: Push the current branch to `origin`** and verify the remote branch points to the new commit.

### Task 5: Apply approved UX revision and LIFF entry gate

**Files:**
- Create: `app/components/liff-gate.tsx`
- Create: `app/components/detail-modal.tsx`
- Modify: `app/page.tsx`
- Modify: `app/components/prediction-app.tsx`
- Modify: `app/globals.css`
- Modify: `lib/mock-data.ts`
- Modify: `lib/predictions.ts`
- Modify: `.env.example`
- Modify: `package.json` and `package-lock.json` to add the LIFF SDK

**Interfaces:**
- `LiffGate` renders `children` after LIFF init/login or a clearly labeled preview fallback.
- `getUserPredictionDetails` returns fixture-level choices for one user without mutating source data.
- `getFixturePredictionDetails` returns named/avatar-ready choice rows grouped by home/draw/away.

- [ ] **Step 1: Write failing tests** for the two pure detail helpers and run `npm run test` to verify the expected missing-export failure.
- [ ] **Step 2: Implement the minimal detail helpers** and rerun `npm run test` until all tests pass.
- [ ] **Step 3: Add the `@line/liff` SDK and implement `LiffGate`** with automatic `liff.init`, `liff.login`, `liff.getProfile`, preview fallback, loading state, retry state, and no token logging.
- [ ] **Step 4: Add named player/fixture detail modals** with selected-team highlighting and make leaderboard rows and result cards keyboard/click accessible.
- [ ] **Step 5: Move tabs to fixed bottom navigation** with safe-area padding and dark navy background throughout the app.
- [ ] **Step 6: Switch club crest URLs** to `https://resources.premierleague.com/premierleague25/badges-alt/{id}.svg` and keep a text fallback if an image fails.
- [ ] **Step 7: Add the share confirmation popup after saving predictions, use Lucide icons where they improve clarity, and add only necessary transitions** for loading, tab selection, modal entry/exit, and save success; honor `prefers-reduced-motion`.
- [ ] **Step 8: Run `npm run test`, `npm run lint`, and `npm run build`**.
- [ ] **Step 9: Update `docs/project-status.md` and commit** with `git commit -m "feat: refine phase 1 UX and add LIFF gate"`.
