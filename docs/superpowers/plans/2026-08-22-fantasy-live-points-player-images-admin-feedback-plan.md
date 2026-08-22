# Fantasy Live Points, Player Images, and Admin Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh current-GW player points on every valid Fantasy squad popup open, add clear position/player-image presentation, and replace Admin inline result messages with accessible feedback modals.

**Architecture:** Keep the existing one-row-per-season-and-Entry `fantasy_entry_current_squads` snapshot and refresh it on every validated popup request. Normalize player points from FPL `bootstrap-static.event_points` and derive official player image URLs from player IDs. Extract a small shared Admin feedback state/modal boundary so both the general Admin panel and Fantasy Admin panel use the same success/error presentation without changing their APIs or persistence flows.

**Tech Stack:** Next.js 16 App Router, React client components, TypeScript, Supabase server repository, FPL API, Node `node:test`, Tailwind utility classes.

**Spec:** `docs/superpowers/specs/2026-08-22-fantasy-current-squad-popup-design.md`

## Global Constraints

- Refresh FPL data on every valid squad-popup open, including the same GW; do not add TTL or cooldown.
- Keep exactly one current squad snapshot per `(season_id, fpl_entry_id)` and overwrite it with `upsert`.
- Preserve Fantasy ranking/player-stat calculations and the existing prediction/scheduler behavior.
- Do not create a database migration; the existing `squad jsonb` column stores the added squad display fields.
- Use `npm.cmd` for npm commands and read the relevant Next.js guide before Next.js code changes.
- Do not expose secrets, FPL/Supabase internal errors, or raw JSON to users.
- Use `apply_patch` for local edits and do not stage unrelated worktree changes.
- Write failing tests before production implementation for each behavior change.
- Before completion run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd exec -- tsc --noEmit`, `npm.cmd run build`, and `git diff --check`.
- Do not commit or push until the user separately approves the completed implementation.

---

### Task 1: Normalize FPL event points and official player image URLs

**Files:**
- Create: `lib/fantasy/player-image.ts`
- Modify: `lib/fantasy/types.ts`
- Modify: `lib/fantasy/fpl-client.ts`
- Test: `tests/fantasy/fpl-client.test.mts`
- Test: `tests/fantasy/player-image.test.mts`

**Interfaces:**
- Produces `buildFplPlayerPhotoUrl(playerId: number): string` returning `https://resources.premierleague.com/premierleague25/photos/players/110x140/<id>.png`.
- Adds `eventPoints: number` to `FplPlayerSnapshot`.
- Adds `photoUrl: string` to `FantasySquadPlayer`.
- `createFantasyFplProvider().getEntryPicks()` sets each pick’s `points` from the matching bootstrap player’s `event_points` and sets `photoUrl` with `buildFplPlayerPhotoUrl`.

- [ ] **Step 1: Write the failing image URL test**

```ts
test("builds the official FPL player photo URL from an Entry player ID", () => {
  assert.equal(
    buildFplPlayerPhotoUrl(437730),
    "https://resources.premierleague.com/premierleague25/photos/players/110x140/437730.png",
  );
});
```

- [ ] **Step 2: Run the image test to verify it fails**

Run: `npm.cmd test -- tests/fantasy/player-image.test.mts`

Expected: FAIL because `lib/fantasy/player-image.ts` does not exist.

- [ ] **Step 3: Write the failing FPL event-points assertion**

Extend the existing valid `getEntryPicks` fixture so bootstrap player `id: 1` has `event_points: 6`, then assert:

```ts
assert.equal(squad.starters[0].points, 6);
assert.equal(squad.starters[0].photoUrl, "https://resources.premierleague.com/premierleague25/photos/players/110x140/1.png");
```

Expected before implementation: FAIL because current picks normalize `row.points`, while the FPL picks payload has no per-player `points` field.

- [ ] **Step 4: Run the FPL client test to verify the failure is correct**

Run: `npm.cmd test -- tests/fantasy/fpl-client.test.mts`

Expected: the new assertions fail with `null` points or missing photo URL.

- [ ] **Step 5: Implement the minimal normalizer changes**

Add the URL helper, parse `player.event_points` as `eventPoints` in `normalizeBootstrap`, and map `points: player.eventPoints` plus `photoUrl` in `normalizeEntryPicks`. Keep malformed-number validation through the existing `numberValue` path.

- [ ] **Step 6: Run the focused tests to verify they pass**

Run: `npm.cmd test -- tests/fantasy/player-image.test.mts tests/fantasy/fpl-client.test.mts`

Expected: PASS with the player points and URL assertions green.

### Task 2: Refresh same-GW snapshots on every popup open with safe fallback

**Files:**
- Modify: `lib/fantasy/current-squad-service.ts`
- Test: `tests/fantasy/current-squad-service.test.mts`

**Interfaces:**
- `loadCurrentSquad()` always calls `provider.getEntryPicks(entryId, gameweekNumber)` after loading the stored row.
- Successful FPL data is written with `repository.upsertCurrentSquad()` for both same-GW and new-GW requests.
- If the FPL request fails and a stored snapshot matches the requested GW, return the stored snapshot with `cached: true`; if no matching snapshot exists, rethrow the safe upstream error for the API handler.

- [ ] **Step 1: Replace the existing same-GW cache-hit expectation with a failing refresh test**

The test must provide a same-GW stored squad and a different provider squad with updated points, then assert the provider is called once, the repository receives an upsert for the same `gameweekId`, and the result contains the updated provider squad.

- [ ] **Step 2: Run the service test to verify it fails**

Run: `npm.cmd test -- tests/fantasy/current-squad-service.test.mts`

Expected: FAIL because the current implementation returns the stored snapshot without calling FPL when the GW matches.

- [ ] **Step 3: Add the failing upstream-fallback test**

Assert that a provider error with a same-GW stored row returns the stored squad and does not delete or overwrite the stored row.

- [ ] **Step 4: Implement refresh-on-open and fallback**

Call the provider on every request, upsert successful results, and catch only the provider failure path needed for a same-GW fallback. Do not swallow database read/write errors or expose their internal messages.

- [ ] **Step 5: Run the focused service tests**

Run: `npm.cmd test -- tests/fantasy/current-squad-service.test.mts`

Expected: PASS for same-GW refresh, new-GW overwrite, and same-GW fallback.

### Task 3: Add deterministic position tones and player-photo fallback UI

**Files:**
- Create: `lib/fantasy/player-presentation.ts`
- Create: `app/fantasy/player-photo.tsx`
- Modify: `app/fantasy/fantasy-app.tsx`
- Test: `tests/fantasy/player-presentation.test.mts`

**Interfaces:**
- Produces `playerPresentation(position: "GK" | "DEF" | "MID" | "FWD", bench: boolean): { label: string; className: string }`.
- The tone mapping is fixed: GK amber, DEF blue, MID green, FWD violet, and bench slate; bench styling takes precedence while preserving the position label.
- `PlayerPhoto` accepts `{ playerId: number; playerName: string; photoUrl?: string }`, renders the official URL through Next Image, and falls back to initials after image load failure.

- [ ] **Step 1: Write the failing position mapping tests**

```ts
assert.match(playerPresentation("GK", false).className, /amber/);
assert.match(playerPresentation("DEF", false).className, /blue/);
assert.match(playerPresentation("MID", false).className, /green/);
assert.match(playerPresentation("FWD", false).className, /violet/);
assert.match(playerPresentation("FWD", true).className, /slate/);
assert.equal(playerPresentation("FWD", true).label, "FWD · ตัวสำรอง");
```

- [ ] **Step 2: Run the presentation test to verify it fails**

Run: `npm.cmd test -- tests/fantasy/player-presentation.test.mts`

Expected: FAIL because the presentation helper does not exist.

- [ ] **Step 3: Implement the helper and photo fallback component**

Use static Tailwind class strings in `player-presentation.ts` so the existing build can detect them. `PlayerPhoto` should use the URL helper when no explicit URL is supplied and switch to a rounded initials fallback on `onError` without throwing.

- [ ] **Step 4: Update Fantasy UI consumers**

Use `PlayerPhoto` and `playerPresentation()` in the current squad modal for starters and bench. Use `PlayerPhoto` and the same position badge in `PlayerStats` rows, deriving the image URL from each existing `player.playerId`; do not alter stats data, ranking, or league selection.

- [ ] **Step 5: Run the focused presentation tests and lint**

Run: `npm.cmd test -- tests/fantasy/player-presentation.test.mts`; then `npm.cmd run lint`.

Expected: PASS with no lint errors.

### Task 4: Replace Admin inline action messages with an accessible feedback modal

**Files:**
- Create: `lib/admin/feedback.ts`
- Create: `app/admin/admin-feedback-modal.tsx`
- Modify: `app/admin/admin-panel.tsx`
- Modify: `app/admin/fantasy-admin-panel.tsx`
- Test: `tests/admin/feedback.test.mts`

**Interfaces:**
- `AdminFeedback` is `{ tone: "success" | "error"; title: string; message: string }`.
- `feedbackFromAction(input: { ok: boolean; successMessage: string; errorMessage?: string }): AdminFeedback` returns the success message for `ok: true` and the supplied safe error fallback for `ok: false`.
- `AdminFeedbackModal` renders nothing when closed and otherwise renders `role="dialog"`, `aria-modal="true"`, a status-specific title/icon/color, the Thai message, and a close button.

- [ ] **Step 1: Write the failing feedback-state tests**

```ts
test("builds a success feedback state", () => {
  assert.deepEqual(feedbackFromAction({ ok: true, successMessage: "ซิงก์สำเร็จแล้ว" }), {
    tone: "success",
    title: "ดำเนินการสำเร็จ",
    message: "ซิงก์สำเร็จแล้ว",
  });
});

test("builds an error feedback state without exposing internal details", () => {
  assert.deepEqual(feedbackFromAction({ ok: false, successMessage: "ไม่ใช้", errorMessage: "ดำเนินการไม่สำเร็จ" }), {
    tone: "error",
    title: "ดำเนินการไม่สำเร็จ",
    message: "ดำเนินการไม่สำเร็จ",
  });
});
```

- [ ] **Step 2: Run the feedback tests to verify they fail**

Run: `npm.cmd test -- tests/admin/feedback.test.mts`

Expected: FAIL because the feedback helper does not exist.

- [ ] **Step 3: Implement the feedback helper and modal**

Keep server error details out of the helper input; callers pass only the safe response error text. The modal must close only through the explicit close button or backdrop, and must not alter any action state.

- [ ] **Step 4: Refactor both Admin panels to use the modal**

Replace the inline `{message && <p>...}` blocks in `AdminPanel` and `FantasyAdminPanel` with local `feedback` state and `AdminFeedbackModal`. Keep running/disabled behavior unchanged. Route all existing action success and error branches through the helper, covering Manual sync, participation, Fantasy sync, league create/update/archive, mapping create/archive, and awards.

- [ ] **Step 5: Run the focused feedback tests**

Run: `npm.cmd test -- tests/admin/feedback.test.mts`

Expected: PASS for success/error state construction.

### Task 5: Full verification and handoff

**Files:**
- Inspect only: all changed Fantasy/Admin files, spec, and plan

- [ ] **Step 1: Run the complete automated test suite**

Run: `npm.cmd test`

Expected: all tests pass, including same-GW refresh, event points, images, position tones, and Admin feedback state tests.

- [ ] **Step 2: Run lint, type-check, build, and diff checks**

Run:

```powershell
npm.cmd run lint
npm.cmd exec -- tsc --noEmit
npm.cmd run build
git diff --check
```

Expected: lint/build/diff check pass. Any pre-existing unrelated `tsc --noEmit` errors must be recorded without modifying unrelated files.

- [ ] **Step 3: Review the staged-scope boundary**

Run: `git status --short` and `git diff --stat`.

Expected: only the approved Fantasy/Admin implementation files are candidates for a future commit; prediction, scheduler, attachment, and unrelated worktree changes remain untouched.

- [ ] **Step 4: Stop for explicit commit/push approval**

Report the verification evidence and wait for the user to approve commit/push separately.
