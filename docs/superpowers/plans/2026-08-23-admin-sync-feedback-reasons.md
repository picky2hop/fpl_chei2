# Admin Sync Feedback Reasons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ popup ของ Manual sync และ Sync Fantasy แสดงผลสำเร็จพร้อมสรุปจำนวนข้อมูล หรือแสดงสาเหตุการล้มเหลวที่ปลอดภัยและเข้าใจได้

**Architecture:** คงการป้องกันข้อมูลภายในไว้ที่ API โดยแปลง error เป็นข้อความเหตุผลแบบ allow-list ตาม error code/ขั้นตอน ไม่ส่ง raw error, SQL, URL ภายใน หรือ secret ไปยัง client. Manual sync จะส่ง safe reason จาก `SyncFailure`; Fantasy sync จะสร้าง safe reason จากขั้นตอนที่ล้มเหลวและส่ง summary counts เมื่อสำเร็จ. หน้า Admin จะใช้ reason/summary จาก response ใน `AdminFeedbackModal` เฉพาะสองปุ่มนี้.

**Tech Stack:** TypeScript, Next.js Route Handlers, React client components, Node test runner

**Spec:** Approved in chat on 2026-08-23; scope is Manual sync and Sync Fantasy only

## Global Constraints

- ใช้ `npm.cmd` สำหรับคำสั่ง npm ทั้งหมด
- ต้องเขียน failing tests และเห็นการ fail ก่อนเขียน production code
- เหตุผลที่ส่งให้ client ต้องเป็นข้อความ safe allow-list เท่านั้น
- ห้ามเปิดเผย secret, token, SQL, response body หรือ environment value
- ห้ามแก้ข้อมูล production และห้ามแก้ unrelated changes
- ไม่ขยาย feedback behavior ไปยังปุ่ม participation, mapping, league, archive หรือ awards
- ยังไม่ commit/push จนกว่าจะได้รับคำสั่งอนุมัติอย่างชัดเจน

### Task 1: Add failing tests for safe sync reasons and summaries

**Files:**
- Modify: `tests/api/sync-route.test.mts`
- Modify: `tests/fantasy/league-sync-service.test.mts`
- Modify: `tests/api/admin-fantasy-route.test.mts`

**Interfaces:**
- Consumes: `createSyncHandler`, `runFantasyLeagueSync`, and `fantasySyncResponseStatus`
- Produces: regression tests for safe failure reason, successful result summary data, and atomic Fantasy failure behavior

- [x] **Step 1: Add the failing Manual sync failure-reason test**

  Make the injected sync dependency throw a typed `SyncFailure` such as `FPL_TIMEOUT`, then assert the response status is 502, the response contains a safe Thai `reason`, and does not contain the original secret-like error text.

- [x] **Step 2: Add the failing Manual sync success-summary test**

  Return a normal `SyncResult` from the injected sync dependency and assert the response includes a user-facing `message` containing the fixture count and affected-GW count.

- [x] **Step 3: Add the failing Fantasy sync failure-reason tests**

  Make one league request and one Entry history request fail separately. Assert both results remain stale, no `applyLeagueSync` call occurs, and `message` identifies the safe FPL failure reason without exposing the raw thrown error.

- [x] **Step 4: Add the failing Fantasy sync success-summary test**

  Use the existing successful fixture and assert the result message summarizes leagues, members, scores, and players written.

- [x] **Step 5: Run focused tests and verify RED**

  Run:

  ```powershell
  node --experimental-strip-types --test tests/api/sync-route.test.mts tests/fantasy/league-sync-service.test.mts tests/api/admin-fantasy-route.test.mts
  ```

  Expected result: the new reason/summary assertions fail because the current handlers return only generic errors and Fantasy sync returns `message: null` on success or a generic stale message on failure.

### Task 2: Implement safe reason mapping and API summaries

**Files:**
- Modify: `lib/sync/sync-errors.ts`
- Modify: `lib/api/sync-handler.ts`
- Modify: `lib/fantasy/league-sync-service.ts`
- Modify: `app/api/admin/fantasy/sync/route.ts` only if response typing or status handling requires it

**Interfaces:**
- Consumes: `SyncFailure`, `FantasyFplError`, and the existing sync result types
- Produces: `safeSyncFailureReason(error)`, Manual sync response `message/reason`, and Fantasy sync result `message`

- [x] **Step 1: Implement safe Manual sync reason mapping**

  Add a function that maps `SyncFailureCode` to Thai allow-listed reasons such as timeout, provider HTTP failure, invalid FPL snapshot, unavailable provider, and database failure. Unknown errors must map to a generic database/sync reason.

- [x] **Step 2: Return the safe Manual sync failure reason**

  Update `createSyncHandler` to detect `SyncFailure`, return `{ error: "Sync failed", reason: safeReason }`, and keep the existing generic response for unknown errors. Never serialize `error.message`, `details`, or the original error object directly.

- [x] **Step 3: Return the Manual sync success summary**

  Add a `message` to successful sync responses using only result counts, for example fixtures updated and affected GW count. Preserve all existing result fields and scheduler behavior.

- [x] **Step 4: Add safe Fantasy sync reason classification**

  In `runFantasyLeagueSync`, distinguish bootstrap/current-GW failure, FPL league/member/history failure, and repository/job-write failure. Map `FantasyFplError.code` to safe Thai wording and map all other errors to a safe database/write reason. Keep all-or-nothing behavior unchanged.

- [x] **Step 5: Return the Fantasy sync success summary**

  Populate the successful `message` with `leaguesUpserted`, `membershipsUpserted`, `scoresUpserted`, and `playersUpserted`. On failure, return the safe reason in `message` while preserving `currentGameweek: null` so the existing 502 status behavior remains.

- [x] **Step 6: Run focused tests and verify GREEN**

  Run:

  ```powershell
  node --experimental-strip-types --test tests/api/sync-route.test.mts tests/fantasy/league-sync-service.test.mts tests/api/admin-fantasy-route.test.mts
  ```

  Expected result: all new and existing focused tests pass.

### Task 3: Display API reasons in the two Admin sync popups

**Files:**
- Modify: `app/admin/admin-panel.tsx`
- Modify: `app/admin/fantasy-admin-panel.tsx`

**Interfaces:**
- Consumes: Manual sync response `{ message?: string; reason?: string; error?: string }` and Fantasy sync response `{ message?: string; currentGameweek: number | null }`
- Produces: success popup with summary and failure popup with safe reason for only the two sync buttons

- [x] **Step 1: Update Manual sync response handling**

  Parse `message` and `reason`; use `message` for success and `reason ?? error` for failure. Keep the existing default fallback if the response is malformed.

- [x] **Step 2: Update Fantasy sync response handling**

  Parse the JSON result even for HTTP 502; use `message` as the failure reason when `currentGameweek` is null, and use the success summary message when the response is successful.

- [x] **Step 3: Keep unrelated Admin feedback unchanged**

  Do not modify feedback handling for participation, mapping, league, archive, or awards actions.

- [x] **Step 4: Run the full test suite**

  Run `npm.cmd test`. Expected result: all tests pass.

### Task 4: Verify and hand off without commit/push

**Files:**
- Inspect: changed files and working tree

**Interfaces:**
- Consumes: completed safe feedback implementation
- Produces: verification evidence and a clean scope report

- [x] **Step 1: Run lint**

  Run `npm.cmd run lint`. Expected result: exit code 0.

- [x] **Step 2: Run production build**

  Run `npm.cmd run build`. Expected result: exit code 0.

- [x] **Step 3: Run whitespace validation**

  Run `git diff --check`. Expected result: exit code 0.

- [x] **Step 4: Review the diff**

  Run `git diff --stat` and `git status --short`; confirm only the sync reason implementation, tests, and this plan are attributable to the task and leave existing unrelated changes untouched. Do not commit or push without explicit instruction.
