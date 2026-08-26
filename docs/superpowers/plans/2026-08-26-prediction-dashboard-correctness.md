# Prediction Dashboard Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ dashboard แสดง leaderboard ของเกมวีคที่เลือกจริง ป้องกัน snapshot FPL ไม่ครบ และลดข้อมูลค้าง/ปัญหา keyboard accessibility ใน production prediction app

**Architecture:** ให้ server สร้าง leaderboard แยกตาม gameweek โดย scope ผู้มีสิทธิ์และคะแนนตาม GW แล้วส่งผ่าน pure view-model ไปยัง client; client ยกเลิก request เก่าและแจ้ง stale state เมื่อ refresh ไม่สำเร็จ. เพิ่ม snapshot completeness guard ที่ sync boundary และปรับ modal ให้จัดการ focus กับ body scroll อย่างถูกต้อง

**Tech Stack:** Next.js 16.2.12, React 19, TypeScript, Node test runner, Supabase service-read model

**Spec:** การอนุมัติ design ในบทสนทนา: แก้ leaderboard per-GW/participant scope, harden snapshot validation, และ UI stale/accessibility/production copy

## Global Constraints

- ใช้ `npm.cmd` บน Windows
- เขียน failing test และรันให้เห็น RED ก่อน implementation ในแต่ละ behavior
- ห้ามแก้ production data และห้าม commit/push
- รักษา uncommitted changes เดิมของ repository
- ถ้าเกี่ยวข้องกับ Next.js ให้อ้างอิง guide ใน `node_modules/next/dist/docs/` ที่อ่านแล้ว
- การตรวจ Supabase เป็น read-only เท่านั้น

---

### Task 1: Per-gameweek leaderboard view model

**Files:**
- Create: `lib/data/dashboard-view.ts`
- Modify: `lib/data/dashboard.ts`
- Modify: `app/dashboard/live-dashboard.tsx`
- Modify: `app/components/prediction-app-final.tsx`
- Test: `tests/data/dashboard-view.test.mts`

**Interfaces:**
- Consumes: dashboard fixtures, gameweeks, prediction book, and `leaderboardByGameweek` payload rows
- Produces: `buildLiveProps()` and `getEligibleLeaderboardEntries()` with selected-GW-specific rows

- [ ] **Step 1: Write the failing test** for two gameweeks where a user has a score in GW1 but no active prediction in GW2; assert GW2 rows do not reuse GW1/current rows and season totals are scoped through the selected GW.
- [ ] **Step 2: Run the focused test** with `npm.cmd exec -- node --experimental-strip-types --test tests/data/dashboard-view.test.mts`; expect failure because the per-GW view model is absent.
- [ ] **Step 3: Implement the minimal server and client mapping**: build participant-scoped leaderboard rows per GW, replace the single `leaderboard` payload, and make the client consume each GW’s rows.
- [ ] **Step 4: Add the selected-GW eligibility filter** so a player with zero predictions in that GW cannot appear in either leaderboard mode.
- [ ] **Step 5: Run the focused tests** and confirm they pass.

### Task 2: Snapshot completeness and refresh consistency

**Files:**
- Modify: `lib/sync/fpl-core.ts`
- Modify: `lib/sync/fpl-service.ts` or the actual snapshot fetch caller found by `rg`
- Modify: `app/dashboard/live-dashboard.tsx`
- Test: `tests/sync/fpl-core.test.mts`
- Test: `tests/production-only-paths.test.mts`

**Interfaces:**
- Consumes: normalized FPL snapshot and dashboard refresh responses
- Produces: explicit invalid-snapshot error for incomplete provider payloads; latest-request-wins refresh behavior with retryable stale banner

- [ ] **Step 1: Write failing tests** for an incomplete 380-fixture provider snapshot and for dashboard refresh safeguards.
- [ ] **Step 2: Run the focused tests** and confirm RED.
- [ ] **Step 3: Implement expected fixture identity/count validation at the provider boundary** without changing production data.
- [ ] **Step 4: Implement abort/sequence protection and a retryable stale-data message** for background dashboard refresh.
- [ ] **Step 5: Run focused sync/UI tests and confirm GREEN.

### Task 3: Modal accessibility and production copy

**Files:**
- Modify: `app/components/detail-modal.tsx`
- Modify: `app/components/prediction-app-final.tsx`
- Test: `tests/production-only-paths.test.mts`

**Interfaces:**
- Consumes: existing modal open/close lifecycle and prediction UI copy
- Produces: focus trap/restore, body scroll lock/restore, unique dialog labelling, and production wording

- [ ] **Step 1: Add failing source-level regression assertions** for focus management, scroll locking, unique labelling, and removal of Phase 1 sample wording.
- [ ] **Step 2: Run the focused test and confirm RED.
- [ ] **Step 3: Implement the smallest modal and copy changes.
- [ ] **Step 4: Run the focused test and confirm GREEN.

### Task 4: Verification

**Files:**
- Modify: only files required by test/build output; no unrelated cleanup

- [ ] **Step 1: Run `npm.cmd run test`.
- [ ] **Step 2: Run `npm.cmd run lint`.
- [ ] **Step 3: Run `npm.cmd run build`.
- [ ] **Step 4: Run `git diff --check` and inspect `git status --short --branch`.
- [ ] **Step 5: Report automated tests, read-only Supabase evidence, deployment/migration impact, risks, and remaining approval items without claiming production deployment.
