# Fantasy Flex Timestamps and Team Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Thai share timestamps, popup totals, and FPL club abbreviations to Fantasy Flex team views while moving the Team of the Week action directly below the Player of the Week cards.

**Architecture:** Keep the existing client share actions and Flex payload builders as the single path for all Fantasy shares. Extend the existing FPL player metadata with an optional club short name, calculate display totals through shared presentation helpers, and pass one timestamp created at the share click through every payload builder; no database schema or persistence flow changes are required.

**Tech Stack:** Next.js 16.2.12, React client components, TypeScript, LINE Flex Message payloads, Node test runner, ESLint.

**Spec:** Approved in chat on 2026-08-24; this bounded change preserves the existing Fantasy weekly-features design and does not add a new database table.

## Global Constraints

- Use `npm.cmd` for npm commands.
- Do not change Supabase schema or production data.
- Keep unrelated worktree changes unstaged and unmodified.
- Generate share time at the moment a share action starts, in `Asia/Bangkok`, formatted as `แชร์เมื่อ DD/MM/YYYY พ.ศ.  น.`, for example `แชร์เมื่อ 24/08/2569 21:45 น.`.
- Add the same timestamp to every bubble in a multi-bubble share.
- Team of the Week total is the sum of the 11 raw FPL points with no captain multiplier.
- Use FPL team `short_name` for Flex rows and fall back to the full club name when unavailable.

---

### Task 1: Extend player metadata and centralize totals/time formatting

**Files:**
- Modify: `lib/fantasy/types.ts`
- Modify: `lib/fantasy/fpl-client.ts`
- Modify: `lib/fantasy/player-presentation.ts`
- Modify: `lib/fantasy/squad-layout.ts`
- Test: `tests/fantasy/fpl-client.test.mts`
- Test: `tests/fantasy/player-presentation.test.mts`

**Interfaces:**
- `FplPlayerSnapshot.clubShortName?: string` and `FantasySquadPlayer.clubShortName?: string` remain optional so old stored squad snapshots remain readable.
- Add `fantasyPlayersTotalPoints(players: FantasySquadPlayer[]): number | null` to return the sum of display points, preserving captain multiplication for friend squads.
- Add `fantasySquadTotalPoints(squad: FantasyEntryCurrentSquad): number | null` as the starter-only total used by the friend team view.
- Add `formatFantasyShareTimestamp(date?: Date): string` returning the Thai Bangkok timestamp used by share actions.

- [ ] **Step 1: Write the failing tests**

  Add tests that assert:

  ```ts
  assert.equal(formatFantasyShareTimestamp(new Date("2026-08-24T14:45:00.000Z")), "แชร์เมื่อ 24/08/2569 21:45 น.");
  assert.equal(fantasyPlayersTotalPoints([
    { ...player, points: 6, isCaptain: true },
    { ...player, points: 2, isCaptain: false },
  ]), 14);
  ```

  Extend the FPL bootstrap fixture response with `teams[].short_name` and assert the normalized player exposes that value as `clubShortName`.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run:

  ```powershell
  npm.cmd test -- tests/fantasy/fpl-client.test.mts tests/fantasy/player-presentation.test.mts
  ```

  Expected: failure because the new metadata/helper behavior does not yet exist.

- [ ] **Step 3: Implement the minimal shared helpers**

  Preserve the existing full club name. Normalize FPL team objects as `{ name, shortName }`, copy `short_name` when present, and use `clubName` as the fallback. Add the point-total helpers and Bangkok timestamp formatter without changing database rows or API contracts.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run the same command and confirm all focused tests pass.

---

### Task 2: Update all Fantasy Flex payloads

**Files:**
- Modify: `lib/fantasy/fantasy-share-payload.ts`
- Test: `tests/fantasy/fantasy-share-payload.test.mts`

**Interfaces:**
- Each `buildFantasy*ShareFlex` input accepts optional `sharedAt?: string`; when absent it uses `formatFantasyShareTimestamp()`.
- `buildFantasySquadShareFlex` and `buildFantasyTeamOfWeekShareFlex` keep their current player highlighting and add the shared timestamp at the bottom of every resulting bubble.

- [ ] **Step 1: Write the failing payload tests**

  Add deterministic tests using `sharedAt: "แชร์เมื่อ 24/08/2569 21:45 น."` that assert:

  - leaderboard, player stats, friend squad, Team of the Week, and Top/Bottom payloads contain the timestamp;
  - all four player-stat bubbles contain the same timestamp;
  - friend/team-of-week player rows serialize as player name, club short name, then score;
  - friend squad includes its total and Team of the Week includes the raw 11-player total;
  - Flex validation still succeeds.

- [ ] **Step 2: Run the focused payload tests and verify RED**

  Run:

  ```powershell
  npm.cmd test -- tests/fantasy/fantasy-share-payload.test.mts
  ```

  Expected: failures for the missing timestamp, club abbreviation, and Team of the Week total behavior.

- [ ] **Step 3: Implement the minimal payload changes**

  Append the timestamp as the final body item in every bubble. Change `squadPlayer` to render exactly the player name, `clubShortName ?? clubName`, and display points, while retaining the Player of the Week highlight and captain label. Add a right-aligned total to both team headers; friend squads use the shared starter total and Team of the Week sums all 11 raw players.

- [ ] **Step 4: Run the focused payload tests and verify GREEN**

  Re-run the focused payload test command and confirm it passes.

---

### Task 3: Generate the timestamp at share-click time

**Files:**
- Modify: `lib/fantasy/fantasy-share-actions.ts`
- Test: `tests/fantasy/fantasy-share-actions.test.mts`

**Interfaces:**
- Existing public share functions keep their signatures and create one `sharedAt` value before invoking the corresponding payload builder.
- The generated value is passed unchanged to the builder so multi-bubble messages share one timestamp.

- [ ] **Step 1: Write the failing action test**

  Capture the message passed to `shareTargetPicker` and assert that a successful `shareFantasyTeamOfWeek` call contains `แชร์เมื่อ` and a Thai date/time suffix. Keep the existing cancellation and error assertions.

- [ ] **Step 2: Run the focused action test and verify RED**

  Run:

  ```powershell
  npm.cmd test -- tests/fantasy/fantasy-share-actions.test.mts
  ```

  Expected: failure because the action currently builds a payload without an explicit share timestamp.

- [ ] **Step 3: Implement the minimal action plumbing**

  Add a small helper that merges `{ sharedAt: formatFantasyShareTimestamp() }` into each share input before calling the existing builder. Do not add a second LINE API call or persist the timestamp.

- [ ] **Step 4: Run the focused action test and verify GREEN**

  Re-run the focused action test and confirm it passes.

---

### Task 4: Update the Fantasy UI placement and popup totals

**Files:**
- Modify: `app/fantasy/fantasy-app.tsx`
- Test: `tests/fantasy/fantasy-weekly-ui-copy.test.mts`

**Interfaces:**
- `CurrentSquadModal` displays the shared starter total beside the GW/formation badges.
- `TeamOfWeekModal` displays the sum of its 11 raw players beside the GW/source badges.
- `LegacyPlayerStats` receives `onOpenTeamOfWeek` and renders `WeeklyFeatureCards` immediately below the Player of the Week/popular cards; `PlayerStats` no longer renders that section after the entire stats panel.

- [ ] **Step 1: Write the failing UI tests**

  Add source-level assertions that the Team of the Week action is rendered from the Player Stats section directly after the popular-card grid, and that both modal components reference a total-points value and the `คะแนนรวม` label.

- [ ] **Step 2: Run the focused UI tests and verify RED**

  Run:

  ```powershell
  npm.cmd test -- tests/fantasy/fantasy-weekly-ui-copy.test.mts
  ```

  Expected: failure because the button currently renders after the full stats panel and the modals do not show totals.

- [ ] **Step 3: Implement the minimal UI changes**

  Import the shared total helpers, add total summary boxes to both modals, pass the existing Player of the Week highlight set through unchanged, and move the Team of the Week button section into the position immediately after the popular feature cards.

- [ ] **Step 4: Run the focused UI tests and verify GREEN**

  Re-run the focused UI test and confirm it passes.

---

### Task 5: Full verification and handoff

**Files:**
- No additional production files.

- [ ] **Step 1: Run the complete automated test suite**

  ```powershell
  npm.cmd test
  ```

  Expected: all tests pass with zero failures.

- [ ] **Step 2: Run lint and production build**

  ```powershell
  npm.cmd run lint
  npm.cmd run build
  ```

  Expected: both commands exit successfully.

- [ ] **Step 3: Check whitespace and worktree scope**

  ```powershell
  git diff --check
  git status --short
  ```

  Expected: no whitespace errors; only the intended feature files are changed by this task, and unrelated pre-existing changes remain untouched.

- [ ] **Step 4: Report results and wait for explicit commit/push approval**

  Report the verified files and command results. Do not commit or push until the user explicitly requests it.
