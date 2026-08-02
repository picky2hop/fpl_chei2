# Phase 3A Sync Reliability Implementation Plan

Deployment update (2 August 2026): after the implementation review, the user separately authorized direct production migration application plus commit/push. The migration was applied after a one-migration dry run and passed read-only schema, privilege, lint, and advisor verification without running a production fixture sync for testing.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before reporting completion. This plan is executed inline because the user did not authorize sub-agent delegation.

**Goal:** Make FPL snapshot sync idempotent, safely observable, selectively recalculating, and atomic.

**Architecture:** Validate the provider payload before persistence, run the job lifecycle through an injectable core, and apply all business changes through one service-role-only PostgreSQL RPC transaction. Keep the job-start row outside the transaction so provider and database failures remain observable.

**Tech Stack:** Next.js 16 Route Handlers, Node test runner, TypeScript, Supabase JavaScript client, PostgreSQL/PLpgSQL.

## Global Constraints

- Use `npm.cmd` on Windows.
- Do not request or expose secrets.
- Do not mutate production fixtures for testing.
- Use fake providers, test doubles, or transaction rollback.
- Preserve the user's existing working-tree changes.
- Do not commit or push until the user reviews and approves.
- Do not apply the new migration to production during this task.

---

### Task 1: Validate and classify provider snapshots

**Files:**
- Modify: `lib/sync/fpl-core.ts`
- Modify: `lib/sync/fpl-client.ts`
- Create: `lib/sync/sync-errors.ts`
- Test: `tests/sync/fpl-core.test.mts`
- Test: `tests/sync/fpl-client.test.mts`

**Interfaces:**
- `validateFplSnapshot(value: unknown): FplSnapshot`
- `SyncFailure` carries a stable `code`, safe message, and allow-listed details.
- `fetchFplSnapshot(options)` accepts an injected fetch implementation, base URL, and timeout.

- [ ] Write tests rejecting duplicate fixture IDs and missing fixture/team/gameweek fields.
- [ ] Run the focused tests and confirm RED because whole-snapshot validation is missing.
- [ ] Implement the minimum validation and typed errors.
- [ ] Run the focused tests and confirm GREEN.
- [ ] Write tests mapping HTTP 403, HTTP 502, and aborted fetches to safe codes.
- [ ] Run the focused tests and confirm RED because provider errors are untyped and no timeout signal is supplied.
- [ ] Implement the minimum provider boundary and confirm GREEN.

### Task 2: Add an injectable job lifecycle

**Files:**
- Create: `lib/sync/sync-runner.ts`
- Modify: `lib/sync/sync-service.ts`
- Test: `tests/sync/sync-reliability.test.mts`

**Interfaces:**
- `runFplSync(mode, dependencies): Promise<SyncResult>`
- Dependencies expose `createJob`, `fetchSnapshot`, `applySnapshot`, `failJob`, `now`, and `createRunId`.
- `applySnapshot` is one atomic repository operation returning record counts, moved fixture IDs, and affected gameweek IDs.

- [ ] Write a failing success-path test asserting a terminal succeeded job and returned summary.
- [ ] Implement the minimum runner and confirm GREEN.
- [ ] Write failing provider/database failure tests asserting safe failed-job details and no raw errors.
- [ ] Implement safe failure normalization and confirm GREEN.
- [ ] Write a failing test that executes the same 380-fixture snapshot twice against the stateful fake repository.
- [ ] Implement only the adapter behavior required for idempotent runs and confirm GREEN.

### Task 3: Cover fixture transitions and rollback

**Files:**
- Test: `tests/sync/sync-reliability.test.mts`
- Modify: `lib/sync/sync-runner.ts` only if the public orchestration contract needs adjustment.

**Interfaces:**
- The fake repository models an atomic snapshot application with commit-on-success and restore-on-error.

- [ ] Write failing tests for same-GW kickoff change, cross-GW move, corrected result, and an injected mid-transaction failure.
- [ ] Confirm RED for missing transactional repository behavior.
- [ ] Implement the minimum stateful fake used by the contract tests and confirm predictions/events/scores remain correct.
- [ ] Confirm all sync-focused tests are GREEN before adding production SQL.

### Task 4: Add the Supabase atomic RPC adapter

**Files:**
- Create: `supabase/migrations/20260802083440_phase_3a_atomic_fpl_sync.sql`
- Modify: `lib/sync/sync-service.ts`
- Modify: `lib/db/types.ts`
- Modify: `tests/sql/phase-2-schema.sql`

**Interfaces:**
- `public.apply_fpl_sync(p_job_run_id uuid, p_synced_at timestamptz, p_teams jsonb, p_gameweeks jsonb, p_fixtures jsonb) returns jsonb`
- Execution is revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`.

- [ ] Write the failing TypeScript adapter test expecting exactly one `apply_fpl_sync` call.
- [ ] Confirm RED because the adapter still performs multiple table requests.
- [ ] Create a migration with `supabase migration new phase_3a_atomic_fpl_sync` through the discovered CLI command.
- [ ] Implement the RPC: acquire a transaction advisory lock, upsert source entities, preserve fixture UUIDs, reconcile moves, rebuild affected scoring, and mark the job succeeded.
- [ ] Add `job_runs.error_code` and `job_runs.details` with safe defaults and update generated database types.
- [ ] Replace production multi-request orchestration with the RPC adapter and confirm the focused adapter test is GREEN.

### Task 5: Route and documentation evidence

**Files:**
- Test: `tests/api/sync-route.test.mts`
- Modify: `app/api/sync/route.ts` only if dependency extraction is required.
- Modify: `docs/phase-3a-preseason-hardening.md`
- Modify: `docs/project-status.md`
- Modify: `docs/phase-2-deployment-runbook.md`
- Create: `docs/phase-3a-sync-reliability-test-evidence.md`

- [ ] Write a failing route test proving internal errors remain hidden.
- [ ] Implement the minimum injectable handler boundary and confirm GREEN.
- [ ] Update Phase 3A scope/status, the operations runbook, project status, and per-case evidence without overwriting unrelated user edits.
- [x] Record the initial pre-deployment handoff, then record the separately authorized production apply in the deployment update above.

### Task 6: Verification and handoff

- [ ] Run `npm.cmd run test` and require zero failures.
- [ ] Run `npm.cmd run lint` and require exit code 0.
- [ ] Run `npm.cmd run build` and require exit code 0.
- [ ] Run `git diff --check` and require exit code 0.
- [ ] Review `git status`, the complete diff, secret-like strings, migration privileges, and coverage of all eight approved cases.
- [ ] Report evidence and changed files without committing or pushing.
