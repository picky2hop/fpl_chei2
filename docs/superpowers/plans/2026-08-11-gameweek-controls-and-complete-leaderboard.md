# Gameweek Controls and Complete Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-gameweek shortcut, percentage bars to fixture-detail views, and GW-only leaderboard filtering for players who completed every prediction in that GW.

**Architecture:** Keep the selected gameweek as the single UI source of truth. Derive the current gameweek from the existing `Gameweek.state` value, derive complete predictors from the existing prediction book and selected fixture IDs, and share one percentage-bar presentation contract between the app detail view and the existing match-detail Flex builder. Do not change scoring, awards, Supabase schema, API contracts, or Production data.

**Tech Stack:** Next.js 16 App Router, React client component, TypeScript, Tailwind CSS, LINE Flex JSON, Node test runner.

## Global Constraints

- The leaderboard filter applies only when the leaderboard mode is `gameweek`; the `season` mode keeps the existing active-participant population.
- A user is complete only when every fixture ID in the selected GW has a valid prediction choice; score totals must not be used for this filter.
- The current-gameweek shortcut uses the existing `Gameweek.state === "current"` value and falls back to the first available gameweek only when no current state exists.
- Percentage bars must use the existing home/draw/away colors, clamp visual widths to 0–100, and leave the existing percentage labels visible.
- Flex width properties remain on Box components only; every generated message must continue to pass `validateFlexMessage`.
- No business-logic, scoring, award, database, API, environment-variable, LIFF, or Supabase contract changes.
- Use `npm.cmd` for npm commands. Do not commit or push without explicit approval.

---

### Task 1: Add pure gameweek and leaderboard helper contracts

**Files:**
- Create: `lib/gameweeks.ts`
- Modify: `lib/predictions.ts`
- Test: `tests/gameweeks.test.mts`
- Test: `tests/predictions.test.mts`

**Interfaces:**
- `getCurrentGameweekId(gameweeks: Array<{ id: number; state: "current" | "past" | "future" }>): number | null`
- `getCompleteLeaderboardEntries<T extends { id: string }>(entries: T[], fixtureIds: string[], predictionBook: Record<number, Record<string, PredictionMap>>, gameweek: number): T[]`
- `normalizePredictionPercentage(value: number): number`

- [x] **Step 1: Write the failing tests**

  Test that the current-gameweek helper selects the entry with `state: "current"`, falls back to the first entry when no current state exists, and returns `null` for an empty list. Test that complete-entry filtering keeps only users with every selected fixture prediction and returns no users when a fixture list is empty. Test that percentage normalization maps values below 0 to 0, values above 100 to 100, and preserves an in-range integer.

- [x] **Step 2: Run the focused tests and verify RED**

  Run `npm.cmd run test -- tests/gameweeks.test.mts tests/predictions.test.mts`. Expected result: failure because the new helper exports do not exist yet.

- [x] **Step 3: Implement the minimal helpers**

  Implement the current-gameweek fallback without reading environment state. Implement complete filtering by calling the existing `isPredictionComplete(fixtureIds, predictionBook[gameweek]?.[entry.id] ?? {})`. Implement percentage normalization with `Math.round` followed by `Math.max(0, Math.min(100, value))`.

- [x] **Step 4: Run the focused tests and verify GREEN**

  Run the same command and confirm all new and existing prediction tests pass.

---

### Task 2: Add percentage bars to the match-detail Flex builder

**Files:**
- Modify: `lib/line/flex.ts`
- Test: `tests/line/flex.test.mts`

**Interfaces:**
- Reuse `normalizePredictionPercentage` from `lib/predictions.ts` only if the existing Flex module can import it without creating a server/client boundary or dependency cycle; otherwise keep the same normalization behavior in a small local presentation helper.

- [x] **Step 1: Write the failing Flex test**

  Build a fixture message with home/draw/away percentages `0`, `25`, and `75`. Inspect the serialized Flex body and assert that the group presentation contains Box width values `0%`, `25%`, and `75%`, that the percentage labels remain present, and that `validateFlexMessage(message)` does not throw. Add an out-of-range case to confirm generated widths are clamped to `0%` and `100%`.

- [x] **Step 2: Run the focused Flex test and verify RED**

  Run `npm.cmd run test -- tests/line/flex.test.mts`. Expected result: the new width assertions fail because the group currently has only the label and predictor rows.

- [x] **Step 3: Implement the Flex percentage track**

  Update `fixturePredictionGroup` so each choice group renders a muted horizontal Box track and a colored inner Box with `width: "${percentage}%"`. Keep the choice pill, percentage text, empty state, nested predictor boxes, child limits, and existing footer unchanged. Do not place `width` on a Text component.

- [x] **Step 4: Run all Flex tests and verify GREEN**

  Run `npm.cmd run test -- tests/line/flex.test.mts` and confirm existing payload validation, long-list, time, logo, and footer tests still pass.

---

### Task 3: Add the current-gameweek button and app detail bars

**Files:**
- Modify: `app/components/prediction-app-final.tsx`

**Interfaces:**
- Consume `getCurrentGameweekId`, `normalizePredictionPercentage`, and the existing `changeGameweek` callback.
- Keep the existing `"use client"` boundary, serializable props, selected modal reset behavior, and active prediction book.

- [x] **Step 1: Add the current-GW control**

  Derive `currentGameweekId` from `gameweeks` and render an accessible button beside the existing picker with text `GW ปัจจุบัน: GW {currentGameweekId}`. Disable it when it is already selected or when no gameweek exists. On click, call the existing gameweek-change path so selected player, fixture, share prompt, errors, and fixture-share status reset consistently.

- [x] **Step 2: Add percentage bars to `FixtureDetail`**

  In each home/draw/away group, keep the current choice pill and percentage label, then add a full-width muted track with a colored fill whose normalized width equals the fixture percentage. Keep predictor rows and empty-state text below the track. Preserve the mobile modal spacing and accessible text labels.

- [x] **Step 3: Run focused app-related checks**

  Run `npm.cmd run lint` and `npm.cmd run build` after the JSX integration. Confirm TypeScript accepts the selected gameweek callback, the nullable current-gameweek fallback, and the existing modal/share props.

---

### Task 4: Filter the leaderboard only in GW mode

**Files:**
- Modify: `app/components/prediction-app-final.tsx`
- Test: `tests/predictions.test.mts`

**Interfaces:**
- Pass selected GW fixture IDs, prediction book, and gameweek into `Leaderboard`.
- Use `getCompleteLeaderboardEntries` only when `mode === "gameweek"`; pass the original `entries` to season mode and to standings share unless the selected mode is explicitly gameweek.

- [x] **Step 1: Add the failing filtering test**

  Extend the helper test with three users: one complete across two fixture IDs, one missing one fixture, and one with no prediction book entry. Assert only the complete user remains. Add an assertion that an empty fixture list returns an empty array.

- [x] **Step 2: Wire the filtered list into the leaderboard**

  Compute `visibleEntries` from the current mode. Render ranks from `visibleEntries`, calculate the share payload from the same list shown on screen, and show a compact empty state such as `ยังไม่มีผู้เล่นที่ทายครบ GW นี้` when GW mode has no complete entries. Keep season mode behavior unchanged.

- [x] **Step 3: Verify the mode boundary**

  Run `npm.cmd run test -- tests/predictions.test.mts`, `npm.cmd run lint`, and `npm.cmd run build`. Confirm no scoring, award, prediction save, API, or Supabase code changes are required.

---

### Task 5: Full verification and scoped review

**Files:**
- Verify: `app/components/prediction-app-final.tsx`
- Verify: `lib/gameweeks.ts`
- Verify: `lib/predictions.ts`
- Verify: `lib/line/flex.ts`
- Verify: `tests/gameweeks.test.mts`
- Verify: `tests/predictions.test.mts`
- Verify: `tests/line/flex.test.mts`

- [x] **Step 1: Run the complete verification set**

  Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`. Record the actual pass counts and build result.

- [x] **Step 2: Review responsive and accessibility behavior**

  Check the current-gameweek button at mobile, tablet, and desktop widths; verify focus-visible styling, button hit area, disabled state, readable percentage labels, and a clear empty leaderboard state. Check that both app and Flex bars use the same outcome colors and percentages.

- [x] **Step 3: Inspect the scoped diff**

  Confirm only the approved UI/helper/test files changed, no API/schema/environment files changed, and all unrelated working-tree changes remain untouched. Do not commit or push until separately approved.
