# Phase 3A Sync Reliability Design

## Goal

Make FPL sync repeatable, observable, and atomic without changing production fixtures during verification.

## Approved scope

- Re-running the same 380-fixture snapshot must not duplicate fixtures, source records, prediction events, scores, awards, or fixture-move history.
- FPL HTTP 403/502 responses, timeouts, malformed rows, and duplicate source IDs must fail before business data is written.
- Every started run must end as `succeeded` or `failed` when the database remains reachable, with allow-listed operational details only.
- A kickoff-time change inside the same gameweek keeps active predictions.
- A fixture move across gameweeks preserves fixture identity, voids active predictions once, records audit history/events once, reopens the target gameweek when needed, and recalculates only the old and new gameweeks.
- A corrected finished score recalculates only its gameweek and replaces score/award snapshots instead of appending deltas.
- A database failure during snapshot application must roll back every business-data change from that run.

## Architecture

The FPL provider boundary validates the complete external snapshot and returns typed, safe failures. A dependency-injected sync runner owns the `job_runs` lifecycle and can be tested with a fake provider and transactional in-memory repository.

Production persistence uses one `apply_fpl_sync` Supabase RPC. PostgreSQL acquires a transaction-level advisory lock, applies teams/gameweeks/fixtures/source records, reconciles moves, recalculates affected gameweeks, and marks the job successful within the same transaction. An exception rolls back the entire RPC; the runner then marks the already-created job as failed in a separate request.

## Error safety

`job_runs.error_code` contains a stable code such as `FPL_HTTP_403`, `FPL_HTTP_502`, `FPL_TIMEOUT`, `FPL_INVALID_SNAPSHOT`, or `SYNC_DATABASE_ERROR`. `job_runs.details` contains only allow-listed values such as provider status and record counts. Raw response bodies, URLs, database messages, stack traces, configuration, and secrets are never stored or returned by the sync route.

## Transaction and concurrency rules

- Network I/O and source validation happen before the database transaction so locks remain short.
- `apply_fpl_sync` serializes FPL sync transactions with `pg_advisory_xact_lock`.
- Existing fixture UUIDs are retained on update.
- The successful `job_runs` update is part of the same RPC transaction as business writes.
- Failure marking happens after rollback and never includes the raw thrown error.

## Test strategy

- Pure tests validate source rows, duplicate IDs, provider status mapping, and timeout behavior.
- Runner tests use a stateful transactional fake repository and execute the same snapshot twice.
- Failure injection proves the fake transaction restores its pre-run state while preserving the failed audit job.
- Move, kickoff-change, and result-correction tests assert exact affected-gameweek sets and audit counts.
- Route tests assert generic external errors.
- Verification uses `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.

## Boundaries

- No LINE Flex/Bot changes.
- No production fixture mutation or production migration application.
- No secret requests or secret output.
- No commit or push before user review and approval.
