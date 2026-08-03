# GitHub Actions CI Implementation Plan

> Archived on 3 August 2026. This plan described a temporary Supabase test-project integration job. The active workflow now runs only local tests, lint, and build and must not write to Production.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:verification-before-completion to implement and verify this plan task-by-task.

**Goal:** Add a Windows GitHub Actions workflow that validates the application and runs Phase 3A integration tests against the isolated Supabase test project.

**Architecture:** A single read-only GitHub Actions workflow runs the existing npm scripts on `windows-latest`. Test-project credentials are injected only into the integration test process from repository Actions secrets; production credentials are not referenced.

**Tech Stack:** GitHub Actions, Windows runner, Node.js 24, npm lockfile, Supabase integration tests.

## Global Constraints

- Use `npm.cmd` for every npm command.
- Use only the Supabase test project for integration tests.
- Never request, print, commit, or expose secrets.
- Do not deploy or mutate production data.
- Preserve unrelated working-tree changes.

---

### Task 1: Add the CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: repository Actions secrets `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY`.
- Produces: push/PR checks named `test`, `integration-test`, `lint`, and `build`.

- [x] **Step 1: Create the workflow**

Use `windows-latest`, `actions/checkout@v4`, `actions/setup-node@v4` with Node `24.x` and npm cache, then run:

```yaml
- run: npm.cmd ci
- run: npm.cmd run test
- run: npm.cmd run test:integration
  env:
    SUPABASE_TEST_URL: ${{ secrets.SUPABASE_TEST_URL }}
    SUPABASE_TEST_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_ROLE_KEY }}
- run: npm.cmd run lint
- run: npm.cmd run build
```

Set `permissions: contents: read`, trigger on `push` and `pull_request`, and use concurrency cancellation for duplicate branch/PR runs.

- [x] **Step 2: Validate YAML and repository references locally**

Check that the workflow references only existing scripts and the two approved test secrets:

```powershell
rg "npm\.cmd run (test|test:integration|lint|build)|SUPABASE_TEST_(URL|SERVICE_ROLE_KEY)" .github/workflows/ci.yml
```

Expected: exactly the four commands and both test secret names; no `SUPABASE_URL` or production key reference.

- [x] **Step 3: Run local verification**

Run:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: exit code 0 for every command. The real integration command remains dependent on the test-project credentials and was already verified separately against the test project.

- [x] **Step 4: Document manual secret setup**

Add the two secret names and the GitHub Settings path to the CI evidence/runbook document without writing secret values.

- [x] **Step 5: Inspect scope and status**

Run:

```powershell
git diff --stat
git status --short
```

Confirm only the workflow and CI documentation are staged/changed; preserve unrelated `.codex-remote-attachments/` and `.mcp.json` files.
