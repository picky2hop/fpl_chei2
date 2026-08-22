# Fantasy Multi-Entry Mapping และ Default League Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow one LINE ID to map to multiple FPL Entry IDs while keeping each team separate, and open Fantasy on league `819498` by default with league switching retained inside the Dashboard.

**Architecture:** Keep `fantasy_entry_mappings` as one row per FPL team. Remove only the active user uniqueness constraint, retain the active FPL Entry uniqueness constraint, and keep leaderboard/scoring keyed by FPL Entry ID. Extract default-league selection into a small pure helper so the UI behavior is testable without coupling tests to React rendering.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Supabase/Postgres migrations, Node test runner, ESLint, TypeScript compiler, Next.js build.

**Spec:** `docs/superpowers/specs/2026-08-22-fantasy-multi-entry-default-league-design.md`

## Global Constraints

- Use `npm.cmd` for every npm command.
- Read relevant Next.js guidance in `node_modules/next/dist/docs/` before editing Next.js code.
- Use TDD: write a failing test, run it, implement the smallest change, then rerun the focused test.
- Do not modify, stage, commit, or push unrelated prediction-system changes already present in the worktree.
- Do not apply the new Supabase migration to Production without separate explicit approval.
- Do not expose secrets, tokens, service-role keys, or environment values.
- Preserve the existing Thai-first, mobile-first Fantasy visual language.
- Do not aggregate scores or Awards across multiple FPL Entry IDs belonging to one LINE ID.
- Before completion, run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd exec -- tsc --noEmit`, `npm.cmd run build`, and `git diff --check`.

## File Map

- Create `lib/fantasy/league-selection.ts`: pure default/fallback league selection helper.
- Create `tests/fantasy/league-selection.test.mts`: default and fallback selection tests.
- Create a Supabase CLI-generated migration named `fantasy_mapping_multi_entry`: drop only the active-user unique index.
- Modify `lib/fantasy/repository.ts`: allow multiple active Entries for one user while retaining Entry uniqueness.
- Modify `app/fantasy/fantasy-app.tsx`: default to FPL league `819498`, remove the initial selection screen and separate change-league button, retain the Dashboard league dropdown.
- Modify `tests/fantasy/repository.test.mts`, `tests/api/admin-fantasy-route.test.mts`, `tests/fantasy/dashboard.test.mts`, and `tests/fantasy/league-scoring.test.mts` for the new behavior.

### Task 1: Establish Boundaries Before Editing

**Files:**
- Read only: `AGENTS.md`, `node_modules/next/dist/docs/`, current Fantasy files, and current Fantasy tests.

**Interfaces:**
- Consumes: approved spec.
- Produces: verified Next.js guidance and a worktree boundary that keeps prediction changes untouched.

- [ ] **Step 1: Record current worktree state**

Run:
```powershell
git status --short --branch
git diff --name-only
git diff --cached --name-only
```
Treat all existing prediction-related changes as user-owned. Do not use reset, checkout, clean, or broad staging.

- [ ] **Step 2: Discover and read Next.js guidance**

Run:
```powershell
rg --files node_modules/next/dist/docs | Sort-Object
```
Read the App Router/client-component guidance relevant to `app/fantasy/fantasy-app.tsx` before editing it.

- [ ] **Step 3: Read the current Fantasy implementation and tests completely**

Confirm that the existing ranking and scoring paths use FPL Entry ID as team identity.

### Task 2: Write Failing Mapping Tests

**Files:**
- Modify: `tests/fantasy/repository.test.mts`
- Modify: `tests/api/admin-fantasy-route.test.mts`

**Interfaces:**
- Consumes: `assertActiveMappingUniqueness` and `createAdminFantasyMappingsHandler`.
- Produces: red tests defining the new cardinality.

- [ ] **Step 1: Test one user with multiple active Entries**

Add:
```ts
test("allows one active LINE user to map multiple FPL Entries", () => {
  assert.doesNotThrow(() => assertActiveMappingUniqueness([
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "active" },
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 101, mapping_status: "active" },
  ]));
});
```

- [ ] **Step 2: Retain duplicate-Entry rejection**

Keep a test asserting two active rows with Entry `100` and different users throw `/active mapping already exists for FPL entry/`.

- [ ] **Step 3: Test the mapping API**

Use two unmapped candidates. POST the same `appUserId` with different Entry IDs and assert both responses are `201`. POST an Entry already mapped to another user and assert `409`.

- [ ] **Step 4: Run focused tests and confirm red**

Run:
```powershell
npm.cmd test -- tests/fantasy/repository.test.mts tests/api/admin-fantasy-route.test.mts
```
Expected: the new same-user/multiple-entry behavior fails before implementation.

### Task 3: Implement the Mapping Constraint

**Files:**
- Create: Supabase CLI-generated migration named `fantasy_mapping_multi_entry` under `supabase/migrations/`.
- Modify: `lib/fantasy/repository.ts`.

**Interfaces:**
- Consumes: red tests from Task 2.
- Produces: a migration and domain assertion that enforce only Entry uniqueness.

- [ ] **Step 1: Generate the migration through Supabase CLI**

Run:
```powershell
npm.cmd exec --yes supabase@latest migration new fantasy_mapping_multi_entry
```
Put exactly this SQL in the generated migration:
```sql
drop index if exists public.fantasy_entry_mappings_active_user_idx;
```
Do not alter `fantasy_entry_mappings_active_entry_idx`. Do not apply the migration to Production in this task.

- [ ] **Step 2: Update the assertion**

In `assertActiveMappingUniqueness`, remove the user set and user duplicate check. Keep the Entry set/check and continue ignoring archived rows.

- [ ] **Step 3: Run focused tests and confirm green**

Run:
```powershell
npm.cmd test -- tests/fantasy/repository.test.mts tests/api/admin-fantasy-route.test.mts
```
Expected: one user can map multiple Entries, while one Entry cannot map to multiple users.

### Task 4: Add Testable Default-League Selection

**Files:**
- Create: `lib/fantasy/league-selection.ts`
- Create: `tests/fantasy/league-selection.test.mts`

**Interfaces:**
- Consumes: league rows from `/api/fantasy/leagues`.
- Produces: `DEFAULT_FANTASY_LEAGUE_ID = 819498` and `selectDefaultFantasyLeague(leagues): string | null`.

- [ ] **Step 1: Write red tests**

Cover:
```ts
test("selects active FPL league 819498 first", () => {
  assert.equal(selectDefaultFantasyLeague([
    { id: "league-2", fpl_league_id: 819502, status: "active" },
    { id: "league-1", fpl_league_id: 819498, status: "active" },
  ]), "league-1");
});

test("falls back to the first active league", () => {
  assert.equal(selectDefaultFantasyLeague([
    { id: "archived", fpl_league_id: 819498, status: "archived" },
    { id: "league-2", fpl_league_id: 819502, status: "active" },
  ]), "league-2");
});

test("returns null when no active league exists", () => {
  assert.equal(selectDefaultFantasyLeague([
    { id: "archived", fpl_league_id: 819498, status: "archived" },
  ]), null);
});
```

- [ ] **Step 2: Run the helper test and confirm red**

Run:
```powershell
npm.cmd test -- tests/fantasy/league-selection.test.mts
```

- [ ] **Step 3: Implement the helper**

Return the UUID for active FPL ID `819498`; otherwise return the first active UUID; return `null` when none is active.

- [ ] **Step 4: Run the helper test and confirm green**

Run the same focused command and expect all three cases to pass.

### Task 5: Update the Fantasy App Flow

**Files:**
- Modify: `app/fantasy/fantasy-app.tsx`

**Interfaces:**
- Consumes: `DEFAULT_FANTASY_LEAGUE_ID` and `selectDefaultFantasyLeague`.
- Produces: automatic default loading, Dashboard switching, and no initial selector.

- [ ] **Step 1: Update league typing and initial fetch**

Add `fpl_league_id` to the client league type. After loading the league list, set `leagues` and set `selectedLeagueId` from `selectDefaultFantasyLeague(body.leagues)`.

- [ ] **Step 2: Remove the initial selection card**

Delete the `if (!selectedLeagueId)` selection-card branch. Keep loading while data is being fetched. If no active league exists, render a Thai error state.

- [ ] **Step 3: Keep the Dashboard league dropdown**

Keep the existing Dashboard dropdown bound to `selectedLeagueId`, so both leagues remain switchable. Remove only the separate `เปลี่ยนลีก` button. Preserve Gameweek controls, tabs, ranking, and global player statistics.

- [ ] **Step 4: Run focused Fantasy tests**

Run:
```powershell
npm.cmd test -- tests/fantasy/league-selection.test.mts tests/fantasy/view-model.test.mts
```
Expected: default selection and existing Fantasy view-model behavior pass.

### Task 6: Prove Entry-Based Ranking Does Not Aggregate Users

**Files:**
- Modify: `tests/fantasy/dashboard.test.mts`
- Modify: `tests/fantasy/league-scoring.test.mts`

**Interfaces:**
- Consumes: `buildFantasyDashboard` and `buildLeagueLeaderboard`.
- Produces: regression coverage for two teams sharing one LINE identity.

- [ ] **Step 1: Add legacy dashboard coverage**

Create two active mappings with the same `app_user_id` and different mapping/Entry identities. Provide separate scores and assert two output rows retain their independent points.

- [ ] **Step 2: Add league leaderboard coverage**

Create two membership and score rows for different Entry IDs, map both to the same display user, and assert two rows with independent points and ranks.

- [ ] **Step 3: Run focused ranking tests**

Run:
```powershell
npm.cmd test -- tests/fantasy/dashboard.test.mts tests/fantasy/league-scoring.test.mts
```
Expected: no aggregation and no loss of either team.

### Task 7: Full Verification and Deployment Handoff

**Files:**
- Read-only verification of changed Fantasy files, migration, spec, and plan.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: verified local changes and a safe deployment handoff.

- [ ] **Step 1: Run the full test suite**

```powershell
npm.cmd test
```
Expected: zero failures, including prediction tests.

- [ ] **Step 2: Run lint, TypeScript, build, and diff checks**

Run separately:
```powershell
npm.cmd run lint
npm.cmd exec -- tsc --noEmit
npm.cmd run build
git diff --check
```
Expected: successful exit codes. Line-ending warnings are acceptable only when there are no whitespace errors.

- [ ] **Step 3: Audit the diff boundary**

Run:
```powershell
git diff --name-only
git diff --cached --name-only
git status --short
```
Stage nothing from the other chat.

- [ ] **Step 4: Review the migration**

Confirm it contains only the intended index drop and does not delete rows, alter score/player tables, or grant public access.

- [ ] **Step 5: Stop for deployment approvals**

After verification, ask separately for explicit approval to commit/push the Fantasy changes and to apply the Supabase Production migration.

## Self-Review

- [x] Every approved design requirement maps to a task.
- [x] The plan removes only user uniqueness and retains Entry uniqueness.
- [x] Scores, Awards, and leaderboard rows remain Entry-based.
- [x] The initial selector is removed while Dashboard switching remains.
- [x] Default and fallback league selection have focused tests.
- [x] Next.js guidance is read before client-component edits.
- [x] TDD red/green steps exist for each behavior change.
- [x] Production migration, commit, and push require explicit approval.
- [x] No TODO, TBD, or unspecified implementation placeholder remains.
