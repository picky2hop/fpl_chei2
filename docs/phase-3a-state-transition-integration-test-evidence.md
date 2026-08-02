# Phase 3A — State-transition integration test evidence

## Environment

- Supabase test project: `fpl-chei2-test`
- Project ref: `iarcgspwoordcemebdoz`
- Region: `ap-southeast-1`
- Production project was not used for writes.
- Test fixtures use synthetic IDs and are cleaned in `finally` blocks.

## Test matrix

`npm.cmd run test:integration` runs eight executable tests covering the ten requested transitions:

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

## Final evidence

- Integration: 8 passed, 0 failed, 0 skipped against the test project.
- Full test command: 105 passed, 0 failed; 8 integration tests skipped because test credentials were intentionally not persisted in the shell environment.
- Lint: passed with no warnings.
- Build: passed on Next.js 16.2.12.
- `git diff --check`: passed; Git only reported existing LF/CRLF normalization warnings.
- Read-only cleanup query on the test project returned `0` synthetic fixture rows, `0` synthetic season rows, and `0` synthetic job rows.

The Phase 3A state-transition implementation was previously committed and pushed as `e9e6207`.

## CI setup

The GitHub Actions workflow is `.github/workflows/ci.yml`. It uses a Windows runner so all npm commands remain `npm.cmd`, and it runs on pushes and pull requests with `contents: read` permissions.

Before enabling the integration job, a repository administrator must add these Actions secrets under GitHub Settings → Secrets and variables → Actions:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`

The workflow never references production Supabase credentials and does not deploy.
