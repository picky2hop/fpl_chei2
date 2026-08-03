# Phase 3A — State-transition integration test evidence (historical)

> สถานะ: historical evidence เท่านั้น หลัง Production-only cutover เมื่อ 3 สิงหาคม 2026 test deployment, test Supabase project และ CI integration job ถูกยกเลิกแล้ว

## Retired test environment

- Former Vercel test project: `fpl-chei2-test` — retired.
- Former Supabase test project: `fpl-chei2-test`, ref `iarcgspwoordcemebdoz` — retired.
- Production project: `fpl-chei` (`bripkfdcfanjyruqcgji`) — retained; no synthetic test rows were copied into it.
- No `SUPABASE_TEST_*` credentials belong in the repository or GitHub Actions after cutover.

## Historical test matrix

Before retirement, `npm.cmd run test:integration` ran eight executable tests covering the ten requested transitions:

1. scheduled → live → finished, including score rows, champion/wooden-spoon awards, and leaderboard rows.
2. Prediction API POST/PUT before kickoff.
3. Prediction API and direct database RPC lock at kickoff.
4. finished → scoring → awards → leaderboard.
5. postponed → rescheduled; no premature scoring and prediction can be updated before the new kickoff.
6. Fixture moved across gameweeks; prediction is voided, history is recorded, and target GW reopens.
7. Excluded participant is omitted from scores and awards.
8. Tied users both receive champion and wooden-spoon awards.
9. Corrected finished score recalculates points and increments scoring version.
10. Invalid sync snapshot rolls back fixture, source, and team writes; failed job is safely recorded.

## Historical result

- Integration: 8 passed, 0 failed, 0 skipped against the former isolated test project.
- Full test command at that time: 105 passed, 0 failed; the 8 integration tests were skipped when test credentials were intentionally absent from the local shell.
- Lint: passed with no warnings.
- Build: passed on Next.js 16.2.12.
- `git diff --check`: passed.
- Read-only cleanup query on the former test project returned 0 synthetic fixture rows, 0 synthetic season rows, and 0 synthetic job rows before the project was retired.

## Current verification policy

- CI runs local unit/domain/route tests, lint, and production build only.
- Automated write tests must not target Production.
- Production verification is read-only unless a real user action or approved operational sync is required.
- Scoring, awards, leaderboard, postponed/rescheduled, and retrospective correction still require confirmation from real competition data when those states occur.
