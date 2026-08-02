# Phase 3A State-Transition Integration Tests Implementation Plan

> **For agentic workers:** Use TDD for every behavior change and verification-before-completion before reporting results. Do not commit or push until the user separately authorizes it.

**Goal:** Prove the complete prediction lifecycle from API/service/database state transitions through scoring, awards, leaderboard updates, rescheduling, recalculation, and transaction rollback without mutating production data.

**Architecture:** Use a separate Supabase staging/test project populated only with synthetic rows. The integration harness will call the existing API handler factories with real data/service dependencies, use fake FPL snapshots, and send sync snapshots through the real `apply_fpl_sync` RPC. Database assertions will use a test-only Supabase admin client and will never print credentials or raw production data.

**Tech Stack:** Next.js 16 Route Handlers, Node built-in test runner, TypeScript, `@supabase/supabase-js`, Supabase migrations/RPC, `npm.cmd`.

## Global Constraints

- Use the second Supabase project only; never call a write operation against production.
- Do not copy or restore production data into the test project.
- Use synthetic users, teams, fixtures, predictions, and timestamps with unique test identifiers.
- Keep test credentials in environment variables only; never commit, log, or display them.
- Write each new test before implementation changes and verify the expected RED failure.
- Preserve `.codex-remote-attachments/`, `.mcp.json`, and unrelated user changes.
- Do not commit or push.

---

### Task 1: Provision and verify the isolated Supabase test project

**Files:**
- Read: `supabase/migrations/*.sql`
- Read: `.env.example`
- No production files or production data writes

**Interfaces:**
- Consumes: test project reference and credentials held outside Git.
- Produces: a test project with the repository migrations applied and a read-only verification record.

- [ ] Create a blank Supabase project named `fpl-chei2-test` in the selected organization and region.
- [ ] Apply the existing migrations in timestamp order to the test project.
- [ ] Verify migration versions, table columns, RLS state, `save_prediction` privileges, and `apply_fpl_sync` privileges with read-only queries.
- [ ] Record only safe metadata: project reference, migration versions, table names, and counts; never record keys or passwords.
- [ ] Configure local-only variables such as `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` without adding them to tracked files.

### Task 2: Build the integration test harness

**Files:**
- Create: `tests/integration/phase-3a-state-transitions.test.mts`
- Create: `tests/integration/support/supabase-test-client.mts`
- Create: `tests/integration/support/phase-3a-fixtures.mts`
- Modify: `package.json` only to add a test command if the existing glob cannot target integration tests safely

**Interfaces:**
- `createTestSupabaseClient(): SupabaseClient`
- `createSyntheticScenario(client): Promise<SyntheticScenario>`
- `applySyntheticSnapshot(client, scenario, snapshot): Promise<SyncResult>`
- `readScenarioState(client, scenario): Promise<ScenarioState>`
- `cleanupSyntheticScenario(client, scenario): Promise<void>`

- [ ] Write a failing smoke test that creates one synthetic scenario and expects a scheduled fixture to be visible through the test database.
- [ ] Run the focused integration test with `npm.cmd` and confirm it fails for the missing harness, missing test environment, or missing seed data—not because of a test typo.
- [ ] Implement the smallest environment-gated test client that fails closed when test variables are absent and never falls back to production variables.
- [ ] Implement synthetic seed/cleanup helpers using unique IDs and dependency-safe deletion order.
- [ ] Run the focused test again and confirm the harness passes without changing production counts.

### Task 3: Cover prediction API and kickoff lock transitions

**Files:**
- Test: `tests/integration/phase-3a-state-transitions.test.mts`
- Read: `app/api/predictions/route.ts`
- Read: `lib/api/predictions-handler.ts`
- Read: `lib/data/predictions.ts`
- Read: `supabase/migrations/20260729115640_prediction_write_function.sql`

**Interfaces:**
- Use `createPredictionsHandler` with the real `savePrediction` dependency pointed at the test project and a test-only authenticated user identity.
- Use the database RPC `save_prediction` directly for the database-authoritative lock assertion.

- [ ] Write RED tests for create then update before kickoff, asserting one active prediction and `created`/`updated` events.
- [ ] Write RED tests for the exact kickoff boundary, asserting API status 409 and database SQLSTATE `55P03` with no row/event mutation.
- [ ] Run only these tests and inspect the failure reasons.
- [ ] Add only the minimum test adapters needed; do not weaken the production lock or bypass the database RPC.
- [ ] Run the focused tests and confirm GREEN.

### Task 4: Cover scheduled → live → finished and scoring outputs

**Files:**
- Test: `tests/integration/phase-3a-state-transitions.test.mts`
- Read: `lib/sync/sync-runner.ts`
- Read: `lib/sync/supabase-sync-repository.ts`
- Read: `supabase/migrations/20260802083440_phase_3a_atomic_fpl_sync.sql`
- Read: `lib/data/dashboard.ts`

**Interfaces:**
- Use `runFplSync` with a fake provider and the real Supabase atomic repository.
- Query `fixtures`, `job_runs`, `gameweeks`, `gameweek_scores`, `gameweek_awards`, and dashboard data for evidence.

- [ ] Write RED tests applying scheduled, live, and finished snapshots in order.
- [ ] Assert no scores/awards before finished and assert finished status, score, closed gameweek, scores, awards, and leaderboard after the final snapshot.
- [ ] Run focused tests and confirm RED.
- [ ] Implement only test helpers or narrowly scoped production seams required to inject the fake provider.
- [ ] Run focused tests and confirm GREEN.

### Task 5: Cover postponed/rescheduled, cross-GW moves, exclusion, ties, and correction

**Files:**
- Test: `tests/integration/phase-3a-state-transitions.test.mts`
- Read: `lib/domain/fixtures.ts`
- Read: `lib/domain/scoring.ts`
- Read: `supabase/migrations/20260802083440_phase_3a_atomic_fpl_sync.sql`

**Interfaces:**
- Use the same real sync RPC and test database state reader.

- [ ] Write RED tests for same-GW kickoff change, postponed fixture, and cross-GW reschedule.
- [ ] Assert stable fixture UUID, one move-history row, one void event per active prediction, target-GW reopen behavior, and new prediction availability before the new kickoff.
- [ ] Write RED tests for excluded participants, joint champions, and a corrected finished score.
- [ ] Assert excluded users have no score/award/leaderboard impact, tied users each receive champion awards, and corrected scores replace prior score/award snapshots without duplicate rows.
- [ ] Run focused tests and confirm expected failures before any fix.
- [ ] Implement only the minimum missing behavior discovered by the failing tests, one behavior at a time.
- [ ] Run the focused integration suite and confirm GREEN.

### Task 6: Prove transaction rollback and produce evidence

**Files:**
- Test: `tests/integration/phase-3a-state-transitions.test.mts`
- Create: `docs/phase-3a-state-transition-integration-test-evidence.md`

**Interfaces:**
- Use a snapshot containing valid writes followed by a fixture referencing an unknown team to force a database error after earlier writes.

- [ ] Write a RED rollback test that captures pre-state counts and expects the sync to fail safely.
- [ ] Assert all business changes from the failed RPC are absent, while the pre-created `job_runs` row is finalized as `failed` with safe error metadata.
- [ ] Run the rollback test and confirm the failure is caused by missing transaction evidence, not by production access.
- [ ] Implement only the missing assertion/helper behavior.
- [ ] Run the complete integration suite and record each transition's test name and database evidence in the evidence document.
- [ ] Verify production with read-only counts before and after the test run.

### Task 7: Final verification and handoff

- [ ] Run `npm.cmd run test`.
- [ ] Run the integration test command against the test project.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check`.
- [ ] Review `git status`, complete diff, secret-like strings, and production read-only invariants.
- [ ] Report actual outputs and remaining gaps without committing or pushing.
