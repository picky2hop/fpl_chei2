# GitHub Actions CI Design

> Archived on 3 August 2026. This design described a temporary Supabase test-project integration job. The job and test project were retired; the active workflow no longer consumes `SUPABASE_TEST_*` secrets.

## Goal

Run the repository's unit tests, Supabase state-transition integration tests, lint, and production build automatically on pushes and pull requests without connecting CI to production Supabase.

## Design

Add one GitHub Actions workflow using `windows-latest`, because the repository's required package-manager command is `npm.cmd`. The workflow checks out the repository, installs the locked dependency graph with `npm.cmd ci`, then runs the existing test, integration-test, lint, and build scripts.

The integration test process receives only `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` from GitHub Actions secrets. The test project is `fpl-chei2-test`; no production URL, service-role key, or production fixture data is used. The workflow has `contents: read` permissions and does not deploy.

The workflow runs for `push` and `pull_request`, cancels superseded runs for the same branch/PR, and leaves test data cleanup to the existing `finally` cleanup paths in the integration tests.

## Secret setup

Repository administrators add these two Actions secrets manually in GitHub Settings → Secrets and variables → Actions:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`

The service-role key is never committed, printed, or requested in chat. The workflow references it only through the `env` mapping for the integration test command.

## Non-goals

- No production deployment.
- No production database writes.
- No automatic Supabase project creation or deletion.
- No changes to application runtime behavior.
