# Fantasy effective captain and player image fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fantasy scoring and presentation follow FPL's effective captain multiplier, provide a visual fallback when a player image is missing or fails, and show the approved leaderboard scoring warning.

**Architecture:** Keep the existing server-side FPL provider and Fantasy score pipeline. Normalize the effective captain from FPL's `multiplier` on the starting XI, use that normalized role consistently in score calculation and squad presentation, and keep image fallback local to the reusable player-photo component plus the Flex payload builder. No database schema change is needed.

**Tech Stack:** Next.js 16 App Router, React client components, TypeScript, Node test runner, LINE Flex JSON, Supabase-backed existing Fantasy repository.

**Spec:** `docs/superpowers/specs/2026-08-25-fantasy-score-calculation-design.md` plus the approved chat requirements: follow effective FPL captain substitution, fallback icon/emoji for unavailable player photos, and lemon warning text below the leaderboard share button.

## Global Constraints

- Use `npm.cmd` for all npm commands.
- Write and run a failing automated test before each production behavior change.
- Treat FPL `multiplier > 1` on a starting-XI player as the effective captain; the original captain may have `multiplier = 0` on the bench.
- The score remains the sum of the 11 starting players with the effective captain multiplier applied; bench points remain excluded.
- Do not add a Supabase table or migration for this change.
- Do not modify unrelated worktree changes, request or expose secrets, or commit/push without explicit approval.
- Read the relevant Next.js documentation before editing Next.js code.

---

### Task 1: Lock effective-captain behavior with failing tests

**Files:**
- Modify: `tests/fantasy/fpl-client.test.mts`
- Modify: `tests/fantasy/fantasy-score-calculator.test.mts`
- Modify: `tests/fantasy/normalizers.test.mts`

**Interfaces:**
- Consumes: existing `createFantasyFplProvider`, `calculateStartingXiCaptainScore`, and `normalizeEntryCurrentSquad` behavior.
- Produces: regression tests proving that a vice-captain with `multiplier = 2` becomes the effective captain while the original captain with `multiplier = 0` on the bench is not doubled.

- [ ] **Step 1: Add an FPL provider test fixture for auto-substitution.**

Add a second picks scenario to `tests/fantasy/fpl-client.test.mts` where a starting player has `is_vice_captain: true` and `multiplier: 2`, while a bench player has `is_captain: true` and `multiplier: 0`. Assert that the normalized squad exposes the effective captain identity from the starting player and retains the original role metadata needed by the UI.

- [ ] **Step 2: Add the score-calculator regression test.**

Create a 15-player fixture with the effective captain in positions 1–11, the original captain in positions 12–15 with zero multiplier, and assert that the calculated total equals the 11 starting-player points plus the effective captain's points once.

- [ ] **Step 3: Add normalizer assertions for effective and original captain state.**

Assert that a normal squad still reports its selected captain, while the auto-substitution fixture reports the starting-XI player with `multiplier > 1` as `captainPlayerId` and does not report the benched original captain as the active captain.

- [ ] **Step 4: Run the focused tests and confirm RED.**

Run:

```powershell
npm.cmd test -- tests/fantasy/fpl-client.test.mts tests/fantasy/fantasy-score-calculator.test.mts tests/fantasy/normalizers.test.mts
```

Expected: the new auto-substitution assertions fail because the current implementation searches `isCaptain` instead of the effective multiplier.

### Task 2: Normalize and calculate the effective FPL captain

**Files:**
- Modify: `lib/fantasy/types.ts`
- Modify: `lib/fantasy/fpl-client.ts`
- Modify: `lib/fantasy/normalizers.ts`
- Modify: `lib/fantasy/fantasy-score-calculator.ts`
- Test: `tests/fantasy/fpl-client.test.mts`
- Test: `tests/fantasy/fantasy-score-calculator.test.mts`
- Test: `tests/fantasy/normalizers.test.mts`

**Interfaces:**
- Consumes: raw FPL pick fields `is_captain`, `is_vice_captain`, `position`, and `multiplier`.
- Produces: `FantasyEntryCurrentSquad` with an effective `captainPlayerId`, player presentation flags that identify the effective captain, and a calculator that uses starting-XI multipliers.

- [ ] **Step 1: Add explicit original-role fields without changing persisted table shape.**

Extend `FantasySquadPlayer` with optional `wasCaptain?: boolean` and `wasViceCaptain?: boolean`. Keep `isCaptain` as the effective scoring captain flag and `isViceCaptain` as the effective vice-captain display flag. These fields travel inside the existing JSON squad snapshot and require no migration.

- [ ] **Step 2: Normalize raw FPL picks.**

In `normalizeEntryPicks`, preserve raw flags in `wasCaptain`/`wasViceCaptain`, and set the effective `isCaptain` only when the player is in the starting XI and `multiplier > 1`. Set `isViceCaptain` only for a raw vice-captain who is not the effective captain. This prevents an auto-substituted player from showing both labels.

- [ ] **Step 3: Derive squad captain IDs from effective roles.**

In `normalizeEntryCurrentSquad`, derive `captainPlayerId` from the effective `isCaptain` player and keep `viceCaptainPlayerId` from the raw vice-captain metadata when available. Preserve the original role fields for display or future diagnostics.

- [ ] **Step 4: Calculate points from the effective starting-XI multiplier.**

In `calculateStartingXiCaptainScore`, validate that exactly one starting player has `multiplier > 1`, validate all starting points, and calculate the total by summing each starting player’s points multiplied by its FPL multiplier. Continue excluding the bench and return the effective captain’s player ID.

- [ ] **Step 5: Run the focused tests and confirm GREEN.**

Run the same focused command from Task 1. Expected: all existing normal-captain tests and the new auto-substitution tests pass.

### Task 3: Keep app and Flex captain labels consistent

**Files:**
- Modify: `app/fantasy/fantasy-app.tsx`
- Modify: `lib/fantasy/player-presentation.ts`
- Modify: `lib/fantasy/fantasy-share-payload.ts`
- Modify: `tests/fantasy/player-presentation.test.mts`
- Modify: `tests/fantasy/fantasy-share-payload.test.mts`

**Interfaces:**
- Consumes: effective `isCaptain`, `isViceCaptain`, and `multiplier` values from the normalized squad.
- Produces: Popup and LINE Flex showing `กัปตัน ×2` only for the player who actually receives the FPL multiplier.

- [ ] **Step 1: Add a presentation test for the effective captain.**

Assert that display points use the effective captain flag/multiplier and that a benched original captain with `multiplier = 0` is displayed as a normal bench player rather than a doubled captain.

- [ ] **Step 2: Add a Flex payload test for the effective captain label.**

Build a squad containing a substituted captain and assert that the serialized Flex payload contains the effective captain’s doubled label and does not label the benched original captain as `กัปตัน ×2`.

- [ ] **Step 3: Update the existing presentation and Flex builders minimally.**

Use the normalized effective `isCaptain`/`isViceCaptain` values already consumed by the Popup and Flex builders. Do not add another captain-detection rule in the UI layer.

- [ ] **Step 4: Run focused presentation and share tests.**

Run:

```powershell
npm.cmd test -- tests/fantasy/player-presentation.test.mts tests/fantasy/fantasy-share-payload.test.mts
```

Expected: all tests pass.

### Task 4: Add unavailable-player-image fallback and leaderboard warning

**Files:**
- Modify: `app/fantasy/player-photo.tsx`
- Modify: `lib/fantasy/fantasy-share-payload.ts`
- Modify: `app/fantasy/fantasy-app.tsx`
- Create: `tests/fantasy/player-photo.test.mts`
- Modify: `tests/fantasy/fantasy-share-payload.test.mts`
- Modify: `tests/fantasy/fantasy-ui-copy.test.mts`

**Interfaces:**
- Consumes: optional `photoUrl` values and image `onError` events in the client component; optional photo URLs in Flex row builders.
- Produces: a consistent football/player icon fallback in the app and Flex, plus the exact lemon warning below the leaderboard share button.

- [ ] **Step 1: Add the image fallback test first.**

Test the reusable player-photo source contract: missing or failed images render an accessible fallback icon/emoji and do not leave an empty image area. Keep the fallback label tied to the player name for accessibility.

- [ ] **Step 2: Add the Flex fallback assertion.**

Build a player-stat or squad Flex payload with `photoUrl: undefined` and assert that the row contains the approved fallback icon/emoji rather than an invalid image URL.

- [ ] **Step 3: Add the exact leaderboard warning assertion.**

Assert that `app/fantasy/fantasy-app.tsx` contains the exact Thai copy `คะแนนที่เห็น คือ ไม่รวม Bench boost และ Triple Captain` and the lemon color class `text-[#d9ff58]` below the leaderboard share action.

- [ ] **Step 4: Run the new tests and confirm RED.**

Run:

```powershell
npm.cmd test -- tests/fantasy/player-photo.test.mts tests/fantasy/fantasy-share-payload.test.mts tests/fantasy/fantasy-ui-copy.test.mts
```

Expected: the new fallback and warning assertions fail before implementation.

- [ ] **Step 5: Implement the minimal fallback and warning.**

Use the existing `PlayerPhoto` client-side `onError` state to render a consistent football/player icon fallback. Update the Flex payload fallback for missing/invalid URLs to use the same visual concept. Add the warning immediately below the leaderboard share button, styled with `text-[#d9ff58]`, without changing share behavior.

- [ ] **Step 6: Run the new tests and confirm GREEN.**

Run the command from Step 4. Expected: all fallback and UI-copy tests pass.

### Task 5: Full verification and production re-sync handoff

**Files:**
- No additional source files; inspect the complete diff.

- [ ] **Step 1: Run the complete automated test suite.**

Run `npm.cmd test`; expected result is zero failures.

- [ ] **Step 2: Run lint and build.**

Run `npm.cmd run lint` and `npm.cmd run build`; both must exit with code 0.

- [ ] **Step 3: Check whitespace and unrelated changes.**

Run `git diff --check`, then inspect `git diff --stat` and `git status --short` to ensure unrelated user changes remain untouched.

- [ ] **Step 4: Report the required production action without executing it.**

After deployment approval, run `Sync Fantasy Scores` and then `Recalculate Fantasy Scores`. Verify that Entry `8904787` and Entry `8200833` no longer appear in `failedScoreTargets`, and verify the stored scores use `starting_xi_captain_v1`.
