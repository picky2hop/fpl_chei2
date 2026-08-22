# Fantasy Current-GW Squad Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a clickable Fantasy leaderboard row that shows the selected Entry's current-GW squad while retaining only one latest squad snapshot per Entry.

**Architecture:** Add a server-only current-squad snapshot table keyed by season and FPL Entry, with a JSONB squad payload. Fetch and cache the squad on demand through a protected API; replace the row when the current GW changes. Render the response in a mobile-first modal without changing score or leaderboard identity rules.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Supabase/Postgres migration, FPL API provider, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-22-fantasy-current-squad-popup-design.md`

## Global Constraints

- Use `npm.cmd` for every npm command.
- Use TDD: write a failing test, run it, implement the smallest change, then rerun the focused test.
- Use server-only Supabase access; do not expose secrets or add public table grants.
- Keep scores, awards, historical leaderboard rows, and the prediction app unchanged.
- Store one current squad snapshot per `(season_id, fpl_entry_id)`; never accumulate one row per GW.
- Preserve the existing Thai-first, navy/lime, mobile-first Fantasy visual language.
- Before completion run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd exec -- tsc --noEmit`, `npm.cmd run build`, and `git diff --check`.
- Do not apply the migration or commit/push until separately approved by the user.

### Task 1: Add the current-squad domain contract

**Files:**
- Modify: `lib/fantasy/types.ts`
- Modify: `lib/fantasy/normalizers.ts`
- Test: `tests/fantasy/normalizers.test.mts`

**Interfaces:**
- Produce `FplEntryCurrentSquad`, `FantasyEntryCurrentSquad`, and `normalizeEntryCurrentSquad(input)`.
- The normalized payload contains `gameweekNumber`, `formation`, `captainPlayerId`, `viceCaptainPlayerId`, `starters`, and `bench`.

- [ ] Write a failing test for a valid picks payload preserving captain, vice-captain, starter/bench order, multiplier, and points.
- [ ] Run `npm.cmd test -- tests/fantasy/normalizers.test.mts` and confirm the new test fails because the normalizer is missing.
- [ ] Implement the smallest validated normalizer and types, rejecting missing player IDs or an invalid squad shape.
- [ ] Rerun the focused normalizer test and confirm green.

### Task 2: Add FPL picks retrieval

**Files:**
- Modify: `lib/fantasy/types.ts`
- Modify: `lib/fantasy/fpl-client.ts`
- Test: `tests/fantasy/fpl-client.test.mts`

**Interfaces:**
- Extend `FantasyFplProvider` with `getEntryPicks(entryId: number, gameweekNumber: number): Promise<FplEntryCurrentSquad>`.

- [ ] Add a failing client test asserting the correct Entry/GW picks request is normalized.
- [ ] Run the focused client test and confirm the provider method is missing.
- [ ] Implement the provider request with existing timeout, safe HTTP errors, and response validation.
- [ ] Add a malformed-response test and rerun the focused client suite.

### Task 3: Add current-squad database snapshot and repository access

**Files:**
- Create: `supabase/migrations/20260822104435_fantasy_current_squads.sql`
- Modify: `lib/db/types.ts`
- Modify: `lib/fantasy/repository.ts`
- Test: `tests/fantasy/repository.test.mts`

**Interfaces:**
- Add `getCurrentSquad(input: { seasonId: string; entryId: number }): Promise<FantasyEntryCurrentSquad | null>`.
- Add `upsertCurrentSquad(input: { seasonId: string; entryId: number; squad: FantasyEntryCurrentSquad }): Promise<void>`.

- [ ] Write failing repository tests for returning the current snapshot and overwriting an older GW snapshot.
- [ ] Run the focused repository tests and confirm the repository methods/schema contract is missing.
- [ ] Create the migration through the Supabase CLI workflow, then add the server-only table, unique key, RLS, policy, and indexes.
- [ ] Add the generated/manual Database type entries required by the existing typed Supabase client.
- [ ] Implement repository select and upsert methods with a single row per season/Entry.
- [ ] Rerun focused repository tests.

### Task 4: Add protected current-squad API

**Files:**
- Create: `lib/api/fantasy-team-handler.ts`
- Create: `app/api/fantasy/team/route.ts`
- Modify: `lib/data/fantasy.ts`
- Test: `tests/api/fantasy-team-route.test.mts`

**Interfaces:**
- Add `GET /api/fantasy/team?league=<id>&entry=<id>`.
- Validate auth, positive Entry ID, league membership in current GW, current cache, and safe errors.

- [ ] Add failing handler tests for unauthenticated access, invalid Entry, non-member Entry, cache hit, and cache refresh when cached GW differs; inject `getCurrentSquad` into the handler dependencies so each case is deterministic.
- [ ] Run the focused handler tests and confirm the handler is missing.
- [ ] Implement the handler and server data function using the provider only after membership validation.
- [ ] Ensure cache hit skips FPL and cache refresh upserts only the current snapshot.
- [ ] Rerun focused API tests.

### Task 5: Add the mobile Fantasy squad modal

**Files:**
- Modify: `app/fantasy/fantasy-app.tsx`
- Test: `tests/fantasy/leaderboard-squad-source.test.mts` if a pure helper is needed for click/API state behavior

**Interfaces:**
- Leaderboard rows become accessible buttons.
- Modal state tracks selected Entry, loading, response, and safe error.

- [ ] Add a failing view-model test for `buildCurrentSquadModalState` covering loading, loaded current-GW data, and safe error state.
- [ ] Implement click-to-fetch from `/api/fantasy/team` using the selected league and Entry ID.
- [ ] Render current GW label, team identity, formation, starters, captain/vice-captain, bench, loading, error, close, and backdrop behavior.
- [ ] Keep historical leaderboard selection independent; the popup always labels the current GW.
- [ ] Run focused Fantasy tests and lint the component.

### Task 6: Full verification and deployment handoff

**Files:**
- Read-only audit of changed Fantasy files, migration, spec, and plan.

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd exec -- tsc --noEmit`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check`.
- [ ] Verify the migration only creates the server-only current snapshot table and does not alter prediction tables.
- [ ] Stop and request separate approval to apply the migration and commit/push.
