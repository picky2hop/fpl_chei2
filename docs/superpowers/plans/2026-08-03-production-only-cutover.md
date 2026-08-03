# Production-only Cutover Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with verification checkpoints. Do not use Production credentials in automated write tests.

**Goal:** Remove the preview/test environment from the application and repository, keep Production as the only live environment, delete only the confirmed test Vercel/Supabase projects, and update all operational evidence.

**Architecture:** The application will require the real LIFF authentication path and Production API/Supabase configuration. CI will remain safe by running only local unit/domain/route tests, lint, and production build; the deleted Supabase test project will not be replaced with Production writes.

**Tech Stack:** Next.js 16, React, TypeScript, `npm.cmd`, GitHub Actions, Vercel, Supabase Dashboard/SQL read-only verification.

## Global Constraints

- Keep Production Supabase project ref `bripkfdcfanjyruqcgji` and Production Vercel project `fpl-chei2`.
- Delete only Vercel test project `fpl-chei2-test` and Supabase test project ref `iarcgspwoordcemebdoz`.
- Never expose or copy secrets.
- Never run automated write tests against Production.
- Preserve unrelated `.codex-remote-attachments/` and `.mcp.json` changes.
- Use `npm.cmd` for all npm commands.
- No production schema/data deletion.

### Task 1: Remove preview fallback from the application

**Files:**
- Modify: `app/components/liff-gate.tsx`
- Modify: `app/dashboard/live-dashboard.tsx`
- Modify: `app/page.tsx`
- Test: `tests/production-only-paths.test.mts`

- [ ] Write a failing source-contract test proving `liff-gate.tsx` has no demo profile branch and `live-dashboard.tsx` has no mock fallback branch.
- [ ] Run the focused test with `npm.cmd` and confirm it fails for the existing preview fallback.
- [ ] Remove `previewProfile`, demo-mode branching, and mock dashboard fallback; retain the real LIFF error/retry UI.
- [ ] Remove visible `Preview mode` copy and any unused mock imports caused by the cutover.
- [ ] Run the focused test and then `npm.cmd run test`.

### Task 2: Remove Supabase test integration from CI and repository runtime paths

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json` if the test integration script is no longer referenced
- Delete: `tests/integration/phase-3a-state-transitions.test.mts`
- Delete: `tests/integration/support/phase-3a-fixtures.ts`
- Delete: `tests/integration/support/supabase-test-client.ts`
- Delete: `scripts/manual/phase-3a-manual-test-seed.sql` if it is test-environment-only

- [ ] Verify all references to `SUPABASE_TEST_*`, test project ref, integration seed, and test-only imports before editing.
- [ ] Remove the CI integration step and test-only Actions secret references; keep unit/domain/route tests, lint, and build.
- [ ] Remove only test-environment-only harness files and the npm script if no remaining consumer exists.
- [ ] Run `npm.cmd run test` and confirm there are no skipped tests caused by missing test credentials.

### Task 3: Update documentation to Production-only operations

**Files:**
- Modify: `README.md`
- Modify: `docs/project-status.md`
- Modify: `docs/phase-2-deployment-runbook.md`
- Modify: `docs/phase-2-production-status.md`
- Modify: `docs/phase-3a-preseason-hardening.md`
- Modify: `docs/phase-3a-state-transition-integration-test-evidence.md`
- Modify: relevant historical Phase 3A CI design/plan references when they would otherwise instruct operators to use deleted resources

- [ ] Replace current-environment instructions with Production-only instructions and the Production Supabase ref/name without adding secrets.
- [ ] Mark the former test project and test integration run as historical evidence and state that the test resources were retired.
- [ ] Remove active instructions to add `SUPABASE_TEST_URL` or `SUPABASE_TEST_SERVICE_ROLE_KEY` to GitHub.
- [ ] Document safe verification as read-only Production smoke checks plus local unit/domain/route tests.
- [ ] Run repository-wide `rg` to ensure no active document claims the deleted test environment is available.

### Task 4: Verify Production configuration before external deletion

**External resources:** Vercel project `fpl-chei2`; Supabase project ref `bripkfdcfanjyruqcgji`.

- [ ] Inspect Vercel Production environment variable names and deployment target without printing values.
- [ ] Inspect Supabase Production project identity and read-only row-count invariants using the Supabase tool/dashboard.
- [ ] Confirm the current branch/commit intended for Production deployment and that no unrelated user files are staged.
- [ ] Record only names, refs, URLs, statuses, and counts in the evidence document; never record secret values.

### Task 5: Delete the confirmed test resources

**External resources:** Vercel project `fpl-chei2-test`; Supabase project ref `iarcgspwoordcemebdoz`.

- [ ] Reconfirm the exact Vercel project name and Supabase ref immediately before deletion.
- [ ] Delete the Vercel test project.
- [ ] Delete the Supabase test project.
- [ ] Verify the two test resources are no longer accessible/listed and the Production resources remain accessible.
- [ ] Remove the repository Actions secrets `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` if still present.

### Task 6: Deploy and verify Production-only behavior

- [ ] Deploy the approved Production branch/commit to the existing Production Vercel project.
- [ ] Verify HTTP homepage success and unauthenticated API protection without creating rows.
- [ ] Verify authenticated LIFF entry and Production dashboard using the existing user session.
- [ ] Verify Production Supabase read-only invariants are unchanged after deployment.
- [ ] Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- [ ] Review `git status`, repository diff, and secret-like string scan before final handoff.
