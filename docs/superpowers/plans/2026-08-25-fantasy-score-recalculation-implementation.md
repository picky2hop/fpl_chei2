# Fantasy Score Recalculation and Sync Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** เปลี่ยนคะแนน Fantasy หลายลีกให้คำนวณจากตัวจริง 11 คนและกัปตันคูณ 2, รองรับการคำนวณคะแนนเก่าใหม่แบบ partial success และแยก Sync คะแนนออกจาก Sync Player Statistics

**Architecture:** เพิ่ม calculation_method ใน fantasy_entry_gameweek_scores และใช้ pure calculator เดียวกันทั้ง score sync กับ recalculation. Score sync ใช้ league/member pipeline เดิมแต่ดึง Picks API เฉพาะ Entry/GW ที่ต้องคำนวณ; Player Statistics และ Recalculate มี service/RPC/route แยกกัน

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Postgres/RPC, @supabase/supabase-js, Node test runner, ESLint

**Spec:** docs/superpowers/specs/2026-08-25-fantasy-score-recalculation-design.md

## Global Constraints

- ใช้ npm.cmd สำหรับคำสั่ง npm ทั้งหมด
- ใช้ Supabase migration และ RPC ตาม Supabase skill; ห้ามแก้ production schema ด้วย SQL ad hoc
- ห้ามแตะ fantasy_gameweek_scores ระบบเก่า
- ไม่บันทึก 0 และไม่ใช้ Entry History/League Standings เป็น fallback เมื่อ Picks API ล้มเหลว
- เก็บเฉพาะคะแนนรวมต่อ Entry/GW และ calculation_method
- ใช้ TDD: ต้องเห็น test fail ก่อน production implementation ทุก behavior ใหม่
- อ่านคำแนะนำ Next.js ใน node_modules/next/dist/docs/ ก่อนแก้ Next.js route/component
- ห้ามขอหรือเปิดเผย secret, token หรือ environment value
- ห้าม commit/push จนกว่าจะได้รับคำสั่งจากผู้ใช้
- ต้องคง unrelated changes ใน worktree ไว้

---

## Task 1: Add score calculation method schema and DB contracts

**Files:**
- Create: supabase/migrations/20260825125557_fantasy_score_calculation_method.sql after generating it with supabase migration new fantasy_score_calculation_method
- Modify: lib/db/types.ts
- Test: tests/sql/fantasy-score-calculation-method.test.mts

**Produces:** fantasy_entry_gameweek_scores.calculation_method with exactly legacy_fpl_history and starting_xi_captain_v1, plus updated DB types and RPC contracts.

- [ ] **Step 1: Read current references**

Run Supabase CLI help for migration commands and read the relevant files in node_modules/next/dist/docs/ before any application route changes. Confirm migration command flags rather than guessing.

- [ ] **Step 2: Write failing SQL contract tests**

Read the migration source and assert it contains the new column, both allowed values, and fantasy_entry_gameweek_scores, and does not reference fantasy_gameweek_scores.

- [ ] **Step 3: Run the focused SQL tests**

Run: npm.cmd test -- tests/sql/fantasy-score-calculation-method.test.mts

Expected: FAIL because the migration and contract do not exist.

- [ ] **Step 4: Create migration and update DB types**

Create the migration with the Supabase CLI. Add the non-null column with default legacy_fpl_history and a check allowing only legacy_fpl_history and starting_xi_captain_v1. Update the score JSON record shape used by apply_fantasy_league_sync so p_scores accepts and writes the method. Preserve RLS, server-only grants, security invoker, search_path, and the advisory lock. Update lib/db/types.ts.

- [ ] **Step 5: Run focused tests**

Run: npm.cmd test -- tests/sql/fantasy-score-calculation-method.test.mts

Expected: PASS.

## Task 2: Implement and test the pure starting-XI calculator

**Files:**
- Create: lib/fantasy/fantasy-score-calculator.ts
- Modify: lib/fantasy/league-types.ts if shared calculator types are needed
- Test: tests/fantasy/fantasy-score-calculator.test.mts

**Produces:** calculateStartingXiCaptainScore(picks) returning points, captainPlayerId, and calculationMethod starting_xi_captain_v1.

- [ ] **Step 1: Write failing calculator tests**

Cover: positions 1–11 are summed; captain raw points are added one extra time; bench points are excluded; negative points work; incomplete/duplicate positions throw; null starter points throw; missing starting captain throws.

- [ ] **Step 2: Run focused tests**

Run: npm.cmd test -- tests/fantasy/fantasy-score-calculator.test.mts

Expected: FAIL because the module/export does not exist.

- [ ] **Step 3: Implement the smallest calculator**

Validate 15 picks, sort by pickPosition, select 1–11, require numeric points and one captain in starters, then return starterPoints + captain.points. Do not read multiplier, bench points, transfer fields, or History.

- [ ] **Step 4: Verify green**

Run: npm.cmd test -- tests/fantasy/fantasy-score-calculator.test.mts

Expected: PASS.

## Task 3: Add score-row method metadata and repository contracts

**Files:**
- Modify: lib/fantasy/league-types.ts
- Modify: lib/fantasy/league-normalizers.ts
- Modify: lib/fantasy/repository.ts
- Test: tests/fantasy/league-normalizers.test.mts
- Test: tests/fantasy/repository.test.mts

**Produces:** History rows explicitly marked legacy_fpl_history, score inserts carrying calculation_method, and repository methods to read score method and send method-aware RPC payloads.

- [ ] **Step 1: Write failing tests**

Assert History rows carry legacy_fpl_history while retaining event_transfers, event_transfers_cost, and points_on_bench. Assert repository score selects include calculation_method and RPC payloads include it.

- [ ] **Step 2: Run focused tests**

Run: npm.cmd test -- tests/fantasy/league-normalizers.test.mts tests/fantasy/repository.test.mts

Expected: FAIL because method metadata and repository contracts are absent.

- [ ] **Step 3: Implement the contracts**

Add the union type, mark History rows as legacy, add listEntryGameweekScores for the active season, and update applyLeagueSync input. Keep the old mapping repository and fantasy_gameweek_scores path unchanged.

- [ ] **Step 4: Verify green**

Run: npm.cmd test -- tests/fantasy/league-normalizers.test.mts tests/fantasy/repository.test.mts

Expected: PASS.

## Task 4: Change Sync Fantasy Scores to use Picks for current/missing/legacy GW

**Files:**
- Modify: lib/fantasy/league-sync-service.ts
- Modify: lib/fantasy/league-normalizers.ts
- Modify: lib/fantasy/repository.ts
- Modify: lib/fantasy/types.ts
- Test: tests/fantasy/league-sync-service.test.mts

**Produces:** score sync that targets current, missing, and legacy Entry/GW rows, computes with Picks, reports partial failures, and sends an empty player array.

- [ ] **Step 1: Write failing tests**

Add tests for calculating current and missing/legacy rows from Picks; skipping Picks for a starting_xi_captain_v1 row; writing successes while reporting failures without zero; and passing players: [] so score sync does not update player stats.

- [ ] **Step 2: Run focused tests**

Run: npm.cmd test -- tests/fantasy/league-sync-service.test.mts

Expected: FAIL because the service still uses History/eventTotal and writes player rows.

- [ ] **Step 3: Implement target selection and score computation**

Read existing scores, histories, and active members. Build targets from current GW, missing rows, and legacy rows. Fetch Picks with bounded concurrency, call calculateStartingXiCaptainScore, copy History metadata, omit failed targets, and never use event.points or eventTotal as the new score. Pass players: [] to the score write.

- [ ] **Step 4: Update safe result messages**

Return counts and failure details without upstream bodies, tokens, or environment values. Preserve all-or-nothing behavior for league/member stage failures.

- [ ] **Step 5: Verify green**

Run: npm.cmd test -- tests/fantasy/league-sync-service.test.mts

Expected: PASS.

## Task 5: Add score-only recalculation service and RPC

**Files:**
- Create: lib/fantasy/score-recalculation-service.ts
- Modify: lib/fantasy/repository.ts
- Modify: lib/data/fantasy-admin.ts
- Modify: lib/db/types.ts
- Modify: supabase/migrations/20260825125557_fantasy_score_calculation_method.sql
- Test: tests/fantasy/score-recalculation-service.test.mts

**Produces:** Admin recalculation that targets only legacy/missing rows, persists successes, retains old rows on failure, and returns a safe failure report.

- [ ] **Step 1: Write failing tests**

Cover legacy selection, formula-row skipping, successful method conversion, failed Picks retaining the legacy row, no zero inserts, and successful persistence when another target fails.

- [ ] **Step 2: Run focused tests**

Run: npm.cmd test -- tests/fantasy/score-recalculation-service.test.mts

Expected: FAIL because the service and score-only write path do not exist.

- [ ] **Step 3: Implement the service**

Use active members and History to identify legacy/missing targets. Fetch Picks with bounded concurrency, use the shared calculator, preserve History metadata, and return safe failure details. Re-running skips rows already marked starting_xi_captain_v1.

- [ ] **Step 4: Add score-only RPC and repository method**

Create a migration function that accepts only score rows, upserts successful scores, updates the recalculation job, and does not touch leagues, memberships, player stats, awards, or the legacy table. Keep security invoker and server-only grants.

- [ ] **Step 5: Verify green**

Run: npm.cmd test -- tests/fantasy/score-recalculation-service.test.mts

Expected: PASS.

## Task 6: Separate Player Statistics sync

**Files:**
- Create: lib/fantasy/player-stats-sync-service.ts
- Modify: lib/data/fantasy-admin.ts
- Modify: lib/fantasy/repository.ts
- Modify: lib/db/types.ts
- Modify: supabase/migrations/20260825125557_fantasy_score_calculation_method.sql
- Test: tests/fantasy/player-stats-sync-service.test.mts

**Produces:** Player Statistics sync that reads Bootstrap and writes only current-GW player stats.

- [ ] **Step 1: Write failing separation tests**

Assert Bootstrap is called, current-GW player rows are written, getEntryHistory and getEntryPicks are not called, and score rows are never written.

- [ ] **Step 2: Run focused tests**

Run: npm.cmd test -- tests/fantasy/player-stats-sync-service.test.mts

Expected: FAIL because the separate service and RPC do not exist.

- [ ] **Step 3: Implement service and RPC**

Reuse normalizePlayerSnapshot, use job type fantasy_player_stats_sync, and write only fantasy_player_gameweek_stats for the current GW.

- [ ] **Step 4: Verify green**

Run: npm.cmd test -- tests/fantasy/player-stats-sync-service.test.mts

Expected: PASS.

## Task 7: Add Admin routes, buttons, and feedback

**Files:**
- Create: app/api/admin/fantasy/player-stats-sync/route.ts
- Create: app/api/admin/fantasy/recalculate-scores/route.ts
- Modify: app/api/admin/fantasy/sync/route.ts
- Modify: lib/api/admin-fantasy-handler.ts
- Modify: app/admin/fantasy-admin-panel.tsx
- Test: tests/api/admin-fantasy-sync-routes.test.mts
- Test: tests/fantasy/fantasy-admin-ui-copy.test.mts

**Produces:** three Admin actions with separate endpoints/loading state and existing Feedback Popup behavior.

- [ ] **Step 1: Read Next.js route-handler and client-component docs**

Read the matching guides in node_modules/next/dist/docs/ and confirm the existing App Router route pattern before editing route or client-component files.

- [ ] **Step 2: Write failing route/UI tests**

Assert non-admin requests return 403, successful requests call the intended service, score sync responses contain partial failure details, and the Admin source contains exactly the three approved actions.

- [ ] **Step 3: Run focused tests**

Run: npm.cmd test -- tests/api/admin-fantasy-sync-routes.test.mts tests/fantasy/fantasy-admin-ui-copy.test.mts

Expected: FAIL because the routes/buttons are absent.

- [ ] **Step 4: Implement routes and UI**

Keep score sync route compatibility, add player-stat and recalculation routes, add independent running states, disable the active operation while its request is running, and show safe success/partial/error feedback in the existing modal. Do not expose upstream error bodies.

- [ ] **Step 5: Verify green**

Run: npm.cmd test -- tests/api/admin-fantasy-sync-routes.test.mts tests/fantasy/fantasy-admin-ui-copy.test.mts

Expected: PASS.

## Task 8: Regression coverage and final verification

**Files:**
- Modify: lib/fantasy/repository.ts only if dashboard diagnostics need typed method data
- Modify: relevant existing Fantasy fixtures
- Test: existing tests/fantasy/league-dashboard.test.mts, tests/fantasy/repository.test.mts, and tests/fantasy/league-sync-service.test.mts

- [ ] **Step 1: Add regression assertions**

Assert leaderboard points still read stored points, two leagues remain separate, the legacy mapping flow is unchanged, current squad Popup behavior is unchanged, and Player Statistics remains global/current-only.

- [ ] **Step 2: Run the full test suite**

Run: npm.cmd test

Expected: all existing and new tests pass with zero failures.

- [ ] **Step 3: Run lint and build**

Run: npm.cmd run lint
Run: npm.cmd run build

Expected: both commands exit with code 0.

- [ ] **Step 4: Verify Supabase migration and SQL safety**

Use the Supabase CLI/MCP workflow to verify migration status, execute a read-only test query in the test environment, and run database advisors. Do not run production recalculation without separate explicit operational approval.

- [ ] **Step 5: Validate the diff**

Run: git diff --check and git status --short. Confirm unrelated worktree changes are not staged.

## Execution handoff

Implement tasks in order. At every task, write the failing test, run it, implement the smallest change, and rerun the focused test before moving on. Do not commit or push until the user explicitly authorizes it after final verification.
