# FPL Fantasy App Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with TDD. Use the approved `superpowers:test-driven-development` workflow before every implementation change. Do not commit or push until the user explicitly authorizes it.

**Goal:** Build the read-only FPL Fantasy analytics app at `/fantasy`, with LINE-to-FPL mapping, manual snapshot sync, custom season totals, historical leaderboards, awards, and current-GW player statistics.

**Architecture:** Add a separate `lib/fantasy/*` domain and four Fantasy tables plus typed server repositories. Reuse the existing LIFF/session/app-user/admin boundaries and generic `job_runs`, but keep Fantasy score data and API routes separate from predictions and fixture sync. Fetch FPL data server-side, normalize all player/team snapshots, upsert by season/GW/external identity, and derive all displayed rankings from stored snapshots.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase Postgres/RLS, existing `@supabase/supabase-js` server client, existing LINE LIFF authentication, Node built-in test runner.

## Global Constraints

- Do not change production data during development or tests; use fake providers, test fixtures, test database transactions, or rollback-based verification.
- Use `npm.cmd` for every npm command.
- Read the relevant Next.js guide in `node_modules/next/dist/docs/` before editing Next.js files.
- Use the `supabase:supabase` skill for every Supabase migration, schema, RLS, RPC, or database verification task.
- Keep Fantasy isolated from `predictions`, `prediction_events`, existing `gameweek_scores`, and the prediction scoring engine.
- Keep all FPL and Supabase service-key access server-only; never expose secrets, tokens, or server environment values to the browser.
- Preserve all existing unrelated working-tree changes.
- Use TDD: add a failing automated test, run it to confirm failure, implement the smallest change, then rerun the focused test before moving on.
- Use the existing mobile-first visual language, colors, controls, navigation, and `GW ปัจจุบัน` behavior from the Prediction App.
- Do not commit or push until the user explicitly authorizes it.

---

## File Map and Responsibilities

Create these focused modules:

- `lib/fantasy/types.ts`: shared domain/input/output types with no database calls.
- `lib/fantasy/fpl-client.ts`: server-only FPL provider adapter and response validation.
- `lib/fantasy/normalizers.ts`: pure conversion from FPL payloads to database rows.
- `lib/fantasy/scoring.ts`: pure season totals, leaderboards, awards projections, and player-stat ranking.
- `lib/fantasy/repository.ts`: typed persistence boundary for mappings, snapshots, awards, and sync status.
- `lib/fantasy/sync-service.ts`: orchestration, bounded provider calls, job lifecycle, and partial-failure handling.
- `lib/fantasy/dashboard.ts`: read model for `/api/fantasy`.
- `lib/fantasy/view-model.ts`: pure UI shaping for the two Fantasy tabs and navigation state.

Modify these existing surfaces only where required:

- `lib/db/types.ts`: add generated/manual TypeScript definitions for the Fantasy tables and RPC results.
- `app/page.tsx`: replace the disabled Fantasy button with a link to `/fantasy` while preserving the existing Landing layout.
- `app/admin/admin-panel.tsx`: mount the separate Fantasy admin section without changing prediction sync or participant behavior.
- `app/api/*/route.ts` and `lib/api/*-handler.ts`: add isolated Fantasy user/admin handlers following existing route/handler patterns.
- `app/fantasy/page.tsx` and `app/fantasy/fantasy-app.tsx`: add the protected page and client UI.
- the timestamped migration file produced by `supabase migration new fantasy_analytics_core`: create Fantasy schema, indexes, constraints, RLS, and atomic write functions.
- `tests/fantasy/*.test.mts`: add domain, provider, persistence-contract, sync, API, and view-model coverage.

Do not modify existing prediction components, prediction routes, fixture sync behavior, or unrelated dirty files.

---

### Task 1: Define Fantasy Domain Contracts and FPL Provider Adapter

**Files:**
- Create: `lib/fantasy/types.ts`
- Create: `lib/fantasy/fpl-client.ts`
- Create: `lib/fantasy/normalizers.ts`
- Create: `tests/fantasy/fpl-client.test.mts`
- Create: `tests/fantasy/normalizers.test.mts`

**Interfaces:**

Define these exported contracts in `lib/fantasy/types.ts` before using them elsewhere:

```ts
export type FplEntryHistoryEvent = {
  event: number;
  points: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

export type FplEntrySummary = {
  entryId: number;
  teamName: string;
  managerName: string;
};

export type FplPlayerSnapshot = {
  playerId: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  clubId: number;
  clubName: string;
  status: string;
  selectedByPercent: number;
  transfersInEvent: number;
  transfersOutEvent: number;
  form: number;
};

export type FplBootstrapSnapshot = {
  currentGameweek: number;
  latestFinishedGameweek: number | null;
  players: FplPlayerSnapshot[];
  mostCaptainedPlayerId: number | null;
  mostViceCaptainedPlayerId: number | null;
};

export type FantasyFplProvider = {
  getEntrySummary(entryId: number): Promise<FplEntrySummary>;
  getEntryHistory(entryId: number): Promise<FplEntryHistoryEvent[]>;
  getBootstrap(): Promise<FplBootstrapSnapshot>;
};
```

- [ ] **Step 1: Write failing provider and normalization tests.** Cover successful `entry/{id}/history/`, entry validation, bootstrap current-GW selection, numeric string coercion, invalid payload rejection, and conversion of all 700 fake players rather than only top 5.

Example assertion:

```ts
test("normalizes every player into a GW snapshot row", () => {
  const rows = normalizePlayerSnapshot({ seasonId: "season-1", gameweekId: "gw-1", snapshot: fakeBootstrapWithPlayers(700), syncedAt: "2026-08-17T00:00:00.000Z" });
  assert.equal(rows.length, 700);
  assert.equal(rows[0].fpl_player_id, 1);
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail.**

Run: `npm.cmd run test -- tests/fantasy/fpl-client.test.mts tests/fantasy/normalizers.test.mts`

Expected: FAIL because the provider, normalizer, and fixtures do not exist yet.

- [ ] **Step 3: Implement the server-only FPL adapter.**

Use the existing `getServerEnv().fplApiBaseUrl` pattern and AbortController timeout handling from `lib/sync/fpl-client.ts`, but keep the Fantasy adapter independent. Fetch:

```text
GET /api/entry/{entryId}/
GET /api/entry/{entryId}/history/
GET /api/bootstrap-static/
```

Do not fetch `picks` or `transfers` for MVP because the approved UI does not show squad detail and transfer statistics are global `transfers_in_event`/`transfers_out_event` fields. Validate the provider payload before returning normalized data and classify HTTP, timeout, invalid JSON, and invalid shape errors without storing response bodies.

- [ ] **Step 4: Implement pure normalizers.**

Convert FPL positions to `GK`, `DEF`, `MID`, `FWD`; convert numeric strings to numbers; select `is_current`, or the highest finished event when no current event exists; preserve the raw provider player status; and return all player rows with the selected/form/transfer fields.

- [ ] **Step 5: Run the focused tests and confirm they pass.**

Run: `npm.cmd run test -- tests/fantasy/fpl-client.test.mts tests/fantasy/normalizers.test.mts`

Expected: PASS, with existing tests unchanged.

---

### Task 2: Add Fantasy Database Schema and Typed Persistence Contract

**Files:**
- Create: the timestamped migration file produced by `supabase migration new fantasy_analytics_core`
- Modify: `lib/db/types.ts`
- Create: `lib/fantasy/repository.ts`
- Create: `tests/fantasy/repository.test.mts`

**Interfaces:**

Define the repository boundary so orchestration and handlers do not call Supabase tables directly:

```ts
export type FantasyRepository = {
  listActiveMappings(seasonId: string): Promise<FantasyEntryMapping[]>;
  listMappings(seasonId: string): Promise<FantasyEntryMapping[]>;
  createMapping(input: CreateFantasyMappingInput): Promise<FantasyEntryMapping>;
  replaceMapping(mappingId: string, input: CreateFantasyMappingInput): Promise<FantasyEntryMapping>;
  archiveMapping(mappingId: string): Promise<void>;
  applySync(input: ApplyFantasySyncInput): Promise<FantasySyncWriteResult>;
  getDashboard(input: FantasyDashboardQuery): Promise<FantasyDashboardData>;
  replaceAwards(input: ReplaceFantasyAwardsInput): Promise<void>;
  getSyncStatus(seasonId: string): Promise<FantasySyncStatus>;
};
```

- [ ] **Step 1: Write failing row and uniqueness tests.** Test one active mapping per `(season, app_user)`, one active mapping per `(season, fpl_entry_id)`, archived mapping retention, same-GW score/player upsert identity, and different-GW snapshot identity.

Example:

```ts
test("repeated player sync upserts 700 rows, while a second GW adds 700 rows", () => {
  const first = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw1", players: fakePlayers(700) });
  const sameGw = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw1", players: fakePlayers(700, { formDelta: 1 }) });
  const nextGw = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw2", players: fakePlayers(700) });
  assert.equal(uniqueSnapshotKeys([...first, ...sameGw]).size, 700);
  assert.equal(uniqueSnapshotKeys([...first, ...nextGw]).size, 1400);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails.**

Run: `npm.cmd run test -- tests/fantasy/repository.test.mts`

Expected: FAIL because Fantasy row builders and repository contracts do not exist.

- [ ] **Step 3: Create the migration with Supabase CLI discovery.**

Run the current CLI help first, then create the migration with the CLI command required by the Supabase skill:

```text
supabase --help
supabase migration new fantasy_analytics_core
```

In the generated migration, create:

- `fantasy_entry_mappings`
- `fantasy_gameweek_scores`
- `fantasy_player_gameweek_stats`
- `fantasy_awards`

Add foreign keys to `seasons`, `gameweeks`, and `app_users`; unique indexes for the approved mapping/snapshot identities; indexes for current-GW ranking and historical leaderboard reads; RLS on every table; and no browser grants. Reuse `job_runs` with `job_type = 'fantasy_sync'` rather than creating a duplicate job log table.

- [ ] **Step 4: Add atomic database functions.**

Add security-invoker functions with explicit JSON shape validation:

```sql
public.apply_fantasy_sync(
  p_job_run_id uuid,
  p_synced_at timestamptz,
  p_scores jsonb,
  p_players jsonb,
  p_mapping_results jsonb
) returns jsonb
```

The function must upsert scores and player snapshots, update valid mapping metadata, preserve failed mapping snapshots, and return counts/details. Add a separate security-invoker function to replace all awards for one `(season_id, gameweek_id)` atomically. Do not use `SECURITY DEFINER` as a permission workaround.

- [ ] **Step 5: Update `lib/db/types.ts`.**

Add `Row`, `Insert`, `Update`, relationships, and RPC result types for all Fantasy tables/functions, matching the migration exactly. Do not regenerate or alter unrelated table definitions.

- [ ] **Step 6: Implement the typed repository.**

Keep database details inside `lib/fantasy/repository.ts`. Ensure `applySync` sends normalized rows to the atomic function, `replaceMapping` archives the old mapping without deleting snapshots, and `getDashboard` returns archived rows only when they have historical data for the requested view.

- [ ] **Step 7: Run focused tests and database static checks.**

Run: `npm.cmd run test -- tests/fantasy/repository.test.mts`

Then run the current Supabase help/advisor commands required by the installed CLI; inspect RLS, indexes, function security, and privileges read-only. Do not apply the migration to production.

Expected: PASS for repository contract tests and no unrelated schema/type changes.

---

### Task 3: Implement Fantasy Sync Orchestration and Scoring

**Files:**
- Create: `lib/fantasy/scoring.ts`
- Create: `lib/fantasy/sync-service.ts`
- Create: `lib/fantasy/sync-errors.ts`
- Create: `tests/fantasy/scoring.test.mts`
- Create: `tests/fantasy/sync-service.test.mts`

**Interfaces:**

```ts
export function sumFantasySeasonPoints(scores: Array<{ points: number }>): number;

export function buildFantasyLeaderboard(input: {
  rows: FantasyScoreRow[];
  mappings: FantasyEntryMapping[];
  selectedGameweekId: string;
}): FantasyLeaderboardEntry[];

export function rankPlayerStats(input: {
  players: FantasyPlayerStatRow[];
  currentGameweekId: string;
}): FantasyPlayerStatGroups;

export type FantasySyncDependencies = {
  now: () => Date;
  provider: FantasyFplProvider;
  repository: FantasyRepository;
  createJob: (input: FantasyJobStart) => Promise<{ id: string }>;
  finishJob: (input: FantasyJobFinish) => Promise<void>;
};

export function runFantasySync(dependencies: FantasySyncDependencies): Promise<FantasySyncResult>;
```

- [ ] **Step 1: Write failing scoring tests.** Cover `points` sum with a nonzero `event_transfers_cost`, missing GW score as zero, archived/new Entry separation, current-GW fallback, four position groups, top-five tie expansion, and current-only player statistics.

Example:

```ts
test("season total ignores transfer cost", () => {
  assert.equal(sumFantasySeasonPoints([{ points: 72 }, { points: 45 }]), 117);
});
```

- [ ] **Step 2: Run scoring tests and confirm failure.**

Run: `npm.cmd run test -- tests/fantasy/scoring.test.mts`

Expected: FAIL because the pure scoring functions do not exist.

- [ ] **Step 3: Implement pure scoring and ranking functions.**

Sort GW and season leaderboards by points descending. Include every mapped row with no score as zero. Keep archived mappings separate. For player stats, filter the selected current-GW snapshot to FPL-selectable players, group by the four positions, sort by the requested metric, and include all rows tied at the fifth metric value. Use the FPL captain/vice IDs as single-item groups.

- [ ] **Step 4: Run scoring tests and confirm pass.**

Run: `npm.cmd run test -- tests/fantasy/scoring.test.mts`

Expected: PASS.

- [ ] **Step 5: Write failing sync orchestration tests.**

Use fake provider/repository dependencies to test:

- one bootstrap fetch per sync
- history fetch for every active mapping with bounded concurrency
- same-GW idempotent writes
- different-GW snapshot writes
- invalid Entry retained with `last_validation_status = 'error'`
- valid mappings still persist when one mapping fails
- bootstrap failure preserves the previous player snapshot and marks stale
- job run starts, finishes, and releases the lock

- [ ] **Step 6: Run sync tests and confirm failure.**

Run: `npm.cmd run test -- tests/fantasy/sync-service.test.mts`

Expected: FAIL because the sync orchestrator does not exist.

- [ ] **Step 7: Implement `runFantasySync`.**

Load the active season and mappings, call `getEntrySummary` during mapping validation, call all histories with a maximum of four in-flight requests, call bootstrap once, normalize all rows, call `repository.applySync`, recompute totals from stored score rows, and write `job_runs` with `job_type = 'fantasy_sync'`. Return a safe result containing counts, current GW, `stale`, and failed mappings; never include provider response bodies or secrets.

- [ ] **Step 8: Run sync tests and confirm pass.**

Run: `npm.cmd run test -- tests/fantasy/sync-service.test.mts`

Expected: PASS, including partial failure and stale preservation scenarios.

---

### Task 4: Add User Fantasy Read Model and API

**Files:**
- Create: `lib/fantasy/dashboard.ts`
- Create: `lib/api/fantasy-handler.ts`
- Create: `app/api/fantasy/route.ts`
- Create: `tests/fantasy/dashboard.test.mts`
- Create: `tests/api/fantasy-route.test.mts`

**Interfaces:**

```ts
export type FantasyDashboardQuery = {
  seasonId: string;
  gameweekNumber?: number;
};

export type FantasyDashboardResponse = {
  season: { id: string; name: string };
  currentGameweek: number;
  selectedLeaderboardGameweek: number;
  sync: { lastSyncedAt: string | null; stale: boolean; message: string | null };
  leaderboard: { gameweek: FantasyLeaderboardEntry[]; season: FantasyLeaderboardEntry[] };
  awards: { champions: FantasyAwardEntry[]; woodenSpoons: FantasyAwardEntry[] };
  playerStats: FantasyPlayerStatGroups;
  globalCaptain: FantasyPlayerStatEntry | null;
  globalViceCaptain: FantasyPlayerStatEntry | null;
};
```

- [ ] **Step 1: Write failing dashboard and handler tests.** Cover default current GW, explicit historical GW, latest-finished fallback, current-only player stats, stale payload, 401 unauthenticated response, and 500 safe error response.

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `npm.cmd run test -- tests/fantasy/dashboard.test.mts tests/api/fantasy-route.test.mts`

Expected: FAIL because the read model, handler, and route do not exist.

- [ ] **Step 3: Implement the dashboard read model.**

Load the active season, current/fallback GW, mappings, scores, awards, player snapshots, and sync status through the repository. Use latest `app_users.display_name`/`avatar_url` at read time. For an archived mapping, include it only where its historical score rows exist; keep it separate from a replacement Entry.

- [ ] **Step 4: Implement the pure route handler and route file.**

`GET /api/fantasy` must call `requireUser()`, parse an optional integer `gameweek` in the 1–38 range, resolve the active season, and return the read model. Return only generic Thai-safe error messages; never return provider or database error bodies.

- [ ] **Step 5: Run focused tests and confirm pass.**

Run: `npm.cmd run test -- tests/fantasy/dashboard.test.mts tests/api/fantasy-route.test.mts`

Expected: PASS without changing `/api/dashboard` or `/api/predictions` behavior.

---

### Task 5: Add Admin Fantasy Mapping, Sync, and Award APIs

**Files:**
- Create: `lib/api/admin-fantasy-handler.ts`
- Create: `app/api/admin/fantasy/mappings/route.ts`
- Create: `app/api/admin/fantasy/mappings/[id]/replace/route.ts`
- Create: `app/api/admin/fantasy/mappings/[id]/archive/route.ts`
- Create: `app/api/admin/fantasy/sync/route.ts`
- Create: `app/api/admin/fantasy/awards/route.ts`
- Create: `tests/api/admin-fantasy-route.test.mts`

**Interfaces:**

```ts
type CreateMappingBody = { appUserId: string; fplEntryId: number };
type ReplaceMappingBody = { fplEntryId: number };
type ReplaceAwardsBody = {
  gameweekId: string;
  championMappingIds: string[];
  woodenSpoonMappingIds: string[];
};
```

- [ ] **Step 1: Write failing admin route tests.** Cover admin-only access, invalid IDs, FPL validation before insert, duplicate active mapping rejection, replace preserving old mapping, archive preserving scores, sync invocation, and awards replacement with multiple recipients.

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `npm.cmd run test -- tests/api/admin-fantasy-route.test.mts`

Expected: FAIL because the admin handlers and routes do not exist.

- [ ] **Step 3: Implement the pure admin handler.**

Inject `requireAdmin`, repository, provider, and sync dependencies so tests do not touch Supabase or FPL. Validate `fplEntryId` as a positive safe integer, verify the entry summary before persistence, and return generic error messages.

- [ ] **Step 4: Implement mapping routes.**

Create selects an existing LINE `app_users` row and validates the Entry. Replace atomically archives the old mapping and creates the new mapping without deleting old score rows. Archive only marks the mapping archived.

- [ ] **Step 5: Implement sync and awards routes.**

`POST /api/admin/fantasy/sync` starts one manual sync and rejects a concurrent run. `GET` returns latest run/stale status. `PUT /api/admin/fantasy/awards` validates the current-season GW and all mapping IDs, then replaces champion/wooden-spoon rows atomically.

- [ ] **Step 6: Run focused tests and confirm pass.**

Run: `npm.cmd run test -- tests/api/admin-fantasy-route.test.mts`

Expected: PASS, with the existing participant/admin tests still passing.

---

### Task 6: Build the User Fantasy UI and Landing Navigation

**Files:**
- Modify: `app/page.tsx`
- Create: `app/fantasy/page.tsx`
- Create: `app/fantasy/fantasy-app.tsx`
- Create: `lib/fantasy/view-model.ts`
- Create: `tests/fantasy/view-model.test.mts`

**Interfaces:**

```ts
export type FantasyTab = "leaderboard" | "player-stats";
export type LeaderboardMode = "gameweek" | "season";

export function buildFantasyViewModel(
  payload: FantasyDashboardResponse,
  state: { tab: FantasyTab; mode: LeaderboardMode; selectedGameweek: number },
): FantasyViewModel;
```

- [ ] **Step 1: Re-read Next.js App Router docs before editing the page files.** Review the installed docs for project structure, layouts/pages, linking/navigation, client/server components, and route handlers. Preserve the existing `LiffProvider` client boundary.

- [ ] **Step 2: Write failing view-model tests.** Cover default current GW, historical selection, `GW ปัจจุบัน` reset behavior, tab/mode switching, stale banner, archived row labels, and current-only player stats.

- [ ] **Step 3: Run the focused tests and confirm failure.**

Run: `npm.cmd run test -- tests/fantasy/view-model.test.mts`

Expected: FAIL because the Fantasy view-model does not exist.

- [ ] **Step 4: Implement the view-model and page shell.**

Create a client component that fetches `/api/fantasy`, renders loading/error/empty/stale states, defaults to current GW + gameweek leaderboard, and exposes navigation links to `/`, `/dashboard`, and the current-GW reset control.

- [ ] **Step 5: Implement the two tabs using existing visual language.**

Reuse the Prediction App navy/lime palette, rounded cards, typography, button treatment, spacing, mobile max-width, accessible labels, status roles, and the existing current-GW button pattern. Do not alter the existing prediction component to share Fantasy state.

- [ ] **Step 6: Replace the disabled Landing button with `Link href="/fantasy"`.**

Keep the existing text and visual styling, change only the interaction/status copy needed to make Fantasy available, and preserve the prediction CTA unchanged.

- [ ] **Step 7: Run focused tests and UI checks.**

Run: `npm.cmd run test -- tests/fantasy/view-model.test.mts`; then run the development app and manually verify `/`, `/fantasy`, navigation, current-GW reset, stale state, and mobile layout without using production data.

Expected: PASS and no changes to the Prediction App behavior.

---

### Task 7: Extend the Existing Admin UI with Fantasy Controls

**Files:**
- Modify: `app/admin/admin-panel.tsx`
- Create: `app/admin/fantasy-admin-panel.tsx`
- Create: `tests/fantasy/admin-view-model.test.mts`

- [ ] **Step 1: Write failing admin UI shaping tests.** Cover mapping list states, replace/archive confirmation state, sync running/success/partial/error states, current-season GW award selection, multi-select recipients, and disabled controls during sync.

- [ ] **Step 2: Run the focused test and confirm failure.**

Run: `npm.cmd run test -- tests/fantasy/admin-view-model.test.mts`

Expected: FAIL because the Fantasy admin component/view-model does not exist.

- [ ] **Step 3: Implement `FantasyAdminPanel` as an isolated component.**

Fetch mapping/sync/award data from the new admin APIs. Use the existing admin copy and styling. The mapping form must select an existing active LINE user, accept Entry ID, show verified team/manager preview before save, and offer explicit replace/archive actions.

- [ ] **Step 4: Mount the component in `AdminPanel` without changing existing controls.**

Keep fixture sync and participant management behavior and state intact. Use separate Fantasy state variables so a Fantasy sync cannot disable or overwrite prediction admin controls.

- [ ] **Step 5: Run the focused test and lint.**

Run: `npm.cmd run test -- tests/fantasy/admin-view-model.test.mts`, then `npm.cmd run lint`.

Expected: PASS with existing admin route tests unchanged.

---

### Task 8: Full Regression, Supabase Verification, and Handoff

**Files:**
- Modify only files identified by the preceding tasks if a test exposes an implementation defect.
- Verify: `docs/superpowers/specs/2026-08-16-fantasy-app-design.md`
- Verify: `docs/superpowers/plans/2026-08-17-fantasy-app-implementation.md`

- [ ] **Step 1: Run all automated tests.**

Run: `npm.cmd run test`

Expected: all existing tests and Fantasy tests pass, including server-boundary and production-only-path checks.

- [ ] **Step 2: Run lint.**

Run: `npm.cmd run lint`

Expected: no new lint errors.

- [ ] **Step 3: Run the production build.**

Run: `npm.cmd run build`

Expected: Next.js production build succeeds with `/fantasy` and all API routes generated correctly.

- [ ] **Step 4: Run whitespace and scope checks.**

Run: `git diff --check`; inspect `git status --short` and `git diff --stat`.

Expected: no whitespace errors, no unrelated dirty files modified, no secret/environment values added.

- [ ] **Step 5: Perform read-only schema/security verification.**

Using the Supabase skill, verify the migration’s tables, unique indexes, RLS, function security, and privileges without applying changes to production. Verify no direct browser Supabase client was added.

- [ ] **Step 6: Perform manual mobile acceptance checks with fake/test data.**

Verify:

- Landing menu 2 opens `/fantasy`
- `/fantasy` requires the existing LIFF login
- current GW opens by default
- historical GW selection and `GW ปัจจุบัน` work
- GW/season leaderboard toggle works
- archived Entry remains visible in historical data
- stale banner preserves old data
- all four player positions render current-GW sections
- `/fantasy` navigation reaches `/dashboard` and `/`
- admin mapping, replace, archive, sync, and multi-award selection work
- prediction dashboard and prediction admin behavior are unchanged

- [ ] **Step 7: Stop for user review before any commit, push, or production migration.**

Report exact verification output and remaining environment-dependent checks. Do not claim completion or publish changes until the user explicitly approves the handoff.

---

## Spec Coverage Self-Review

- Architecture isolation: Tasks 2–7.
- LINE auth and existing app users: Tasks 4–7.
- Manual mapping, replace/archive, and latest profile display: Tasks 2, 5, and 7.
- GW1–38 score snapshots and custom totals: Tasks 1–3.
- Historical leaderboard and current-GW reset: Tasks 3, 4, and 6.
- Player-all-record snapshot and 700/1400 identity behavior: Tasks 1–2.
- selected, transfers, form, positions, excluded, and moved players: Tasks 1, 3, and 6.
- FPL captain/vice rank 1 limitation: Tasks 1, 3, and 4.
- Admin-selected editable awards: Tasks 2, 5, and 7.
- stale/partial failure behavior: Tasks 1–4.
- RLS, server-only secrets, and no production mutation: Tasks 2 and 8.
- TDD and required verification commands: Every task and Task 8.

All implementation steps are concrete. Interfaces are defined before consumers, and all later tasks use the same mapping, snapshot, score, dashboard, and award concepts established in earlier tasks.
