# Fantasy Flex Sharing Limit and Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับการแชร์ Fantasy Flex ให้ตารางอันดับพยายามใช้การ์ดเดียวก่อนและ fallback เป็น carousel เมื่อเกินข้อจำกัด พร้อมแยกสถิตินักเตะเป็น 4 ตำแหน่งและปรับระยะห่างของแถวให้สม่ำเสมอ

**Architecture:** คง `lib/fantasy/fantasy-share-payload.ts` เป็นตัวสร้าง payload แบบ pure function โดยสร้าง leaderboard bubble เดียวที่มีกล่องรายการอันดับซ้อนอยู่ภายใน แล้วตรวจด้วย validator ของโปรเจกต์ก่อน fallback ไปยัง carousel แบบเดิมเมื่อ bubble เดียวไม่ผ่านข้อจำกัด. สถิตินักเตะจะรับตำแหน่งของแต่ละแถวและจัดกลุ่มตามลำดับ FWD, MID, DEF, GK เฉพาะตอนเลือกทั้งหมด; การเลือกตำแหน่งเดียวจะสร้าง bubble เดียว. ระยะห่างจะใช้ spacer คงที่ระหว่างลำดับ/รูปและรูป/ชื่อ โดยชื่อยังเป็น flex ที่ขยายได้และคะแนนยังคงชิดขวา.

**Tech Stack:** TypeScript, LINE Flex Message payloads, Node test runner, Next.js/React สำหรับส่งตำแหน่งนักเตะเข้า payload

**Spec:** Approved in chat on 2026-08-23; fallback choice 1 approved by user

## Global Constraints

- ใช้ `npm.cmd` สำหรับคำสั่ง npm ทั้งหมด
- ต้องเขียน failing test และเห็นการ fail ก่อนเขียน production code
- ห้ามแก้ข้อมูล production, Supabase หรือไฟล์ unrelated
- ไม่เพิ่มส่วนหัวที่มองเห็นได้ว่า `FPL CHEI CHEI` ใน Flex bubble
- ใช้ URL รูปภาพ HTTPS ที่ผ่านกฎเดิมของระบบ
- ตารางอันดับต้องพยายามแสดงทุกอันดับใน bubble เดียว; ถ้า validator ไม่ผ่านให้ fallback เป็น carousel
- สถิติ “ทั้งหมด” ต้องเรียง กองหน้า, กองกลาง, กองหลัง, โกล; สถิติเลือกตำแหน่งเดียวต้องเป็น bubble เดียว
- ยังไม่ commit หรือ push จนกว่าจะได้รับคำสั่งอนุมัติอย่างชัดเจน

### Task 1: Add failing tests for the new Flex shapes

**Files:**
- Modify: `tests/fantasy/fantasy-share-payload.test.mts`

**Interfaces:**
- Consumes: `buildFantasyLeaderboardShareFlex` and `buildFantasyPlayerStatsShareFlex`
- Produces: regression coverage for bubble selection, position grouping, and row spacing

- [ ] **Step 1: Add the failing leaderboard single-bubble test**

  Build a leaderboard with two rows and assert that `message.contents.type` is `"bubble"`. Assert that the body contains one nested vertical rows box and that both manager names appear in the serialized payload.

- [ ] **Step 2: Add the failing leaderboard fallback test**

  Build a leaderboard with enough long rows to exceed the single-bubble Flex validator. Assert that the result is a valid carousel and that every input manager name is still present in the serialized result.

- [ ] **Step 3: Add the failing player-stat grouping tests**

  Pass rows carrying `position: "FWD" | "MID" | "DEF" | "GK"` in a deliberately mixed order with `positionLabel: "ทั้งหมด"`. Assert that the result is a carousel of exactly four bubbles and that their position labels occur in the order `กองหน้า`, `กองกลาง`, `กองหลัง`, `GK`. Add a separate single-position case and assert that its result is one bubble, not a carousel.

- [ ] **Step 4: Add the failing fixed-spacing assertions**

  Inspect one leaderboard row and one player-stat row. Assert that each row has the sequence rank, spacer, image/profile, spacer, name box, points; each spacer has `width: "12px"` and `flex: 0`; the name box has `flex: 1`; and the points component has `flex: 0`.

- [ ] **Step 5: Run only the focused test file and verify RED**

  Run:

  ```powershell
  npm.cmd test -- tests/fantasy/fantasy-share-payload.test.mts
  ```

  Expected result: the new assertions fail because the current implementation still uses paged leaderboard bubbles, flat player-stat paging, and no explicit spacers. Fix test setup errors only; do not change production code in this step.

### Task 2: Implement leaderboard single-bubble layout with validator fallback

**Files:**
- Modify: `lib/fantasy/fantasy-share-payload.ts`

**Interfaces:**
- Consumes: existing leaderboard input type and `validateFlexMessage` from `lib/line/flex.ts`
- Produces: a `FlexMessage` that first uses one bubble with a nested rows container, or a valid page carousel when the single bubble fails validation

- [ ] **Step 1: Add a reusable fixed spacer component**

  Add a private helper returning a zero-flex vertical box with `width: "12px"`, `height: "1px"`, and a filler child. Use it only between the fixed rank/image and image/name columns so the points column remains right-aligned.

- [ ] **Step 2: Update `leaderboardRow`**

  Change the row spacing to a minimal spacing and insert two fixed spacers. Preserve fixed flex values for rank, profile, and points; keep the manager/team box at `flex: 1`.

- [ ] **Step 3: Add a nested leaderboard rows container**

  Create a vertical box that owns all leaderboard rows. Keep the bubble body at four direct children: title, period title, column hint, and the rows container. This avoids the validator’s direct `contents` limit for normal-sized single-card shares.

- [ ] **Step 4: Build and validate the single-bubble candidate**

  Build one bubble containing all input rows in the nested rows container. Call `validateFlexMessage` on a complete candidate message. If validation succeeds, return it directly.

- [ ] **Step 5: Preserve a validated carousel fallback**

  If the single-bubble candidate throws `FLEX_MESSAGE_INVALID` or `FLEX_MESSAGE_TOO_LARGE`, build the existing eight-row pages using the nested rows container and return the carousel. Keep the empty-state bubble valid. Do not swallow unrelated errors.

- [ ] **Step 6: Run the focused tests and verify GREEN**

  Run:

  ```powershell
  npm.cmd test -- tests/fantasy/fantasy-share-payload.test.mts
  ```

  Expected result: leaderboard single-bubble, fallback, existing branding, team label, image, and validation tests pass.

### Task 3: Implement grouped player-stat share payloads

**Files:**
- Modify: `lib/fantasy/fantasy-share-payload.ts`
- Modify: `app/fantasy/fantasy-app.tsx`

**Interfaces:**
- Consumes: `FantasyPlayerStatsShareRow` with a required `position` field and the existing `shareFantasyPlayerStats` input
- Produces: one bubble for a selected position, or four ordered bubbles for `positionLabel: "ทั้งหมด"`

- [ ] **Step 1: Read the relevant Next.js guide before editing the client component**

  Read the applicable guidance under `node_modules/next/dist/docs/` for client components and TypeScript/React conventions, as required by `AGENTS.md`. Do not modify Next configuration.

- [ ] **Step 2: Add `position` to the player-stat share row input**

  Update the row type and the `PlayerStats.shareStats` mapper to pass `player.position` for every row. Keep the existing rank values, photo URLs, club names, and metric values unchanged.

- [ ] **Step 3: Update `playerStatsRow` spacing**

  Apply the same fixed spacer sequence as the leaderboard row while retaining the existing player image, name/club flex behavior, and right-aligned metric.

- [ ] **Step 4: Add position metadata and fixed ordering**

  Define the display mapping `FWD -> กองหน้า`, `MID -> กองกลาง`, `DEF -> กองหลัง`, `GK -> GK`. When the selected label is `ทั้งหมด`, group the input rows by these keys, cap each group at the existing ten-row share limit, and build exactly four bubbles in that order. Show the existing empty-state text in a group with no rows.

- [ ] **Step 5: Keep single-position sharing as one bubble**

  When `positionLabel` is not `ทั้งหมด`, take the selected rows up to the existing ten-row limit and build one bubble without page chunking.

- [ ] **Step 6: Run focused tests and verify GREEN**

  Run:

  ```powershell
  npm.cmd test -- tests/fantasy/fantasy-share-payload.test.mts
  ```

  Expected result: four-bubble ordering, single-position bubble, fixed spacing, and all prior squad/share tests pass.

### Task 4: Full verification and handoff

**Files:**
- Inspect only: changed files and the working tree

**Interfaces:**
- Consumes: completed implementation and focused regression tests
- Produces: verification evidence; no commit or push without explicit user approval

- [ ] **Step 1: Run the complete automated test suite**

  Run `npm.cmd test`. Expected result: all tests pass.

- [ ] **Step 2: Run lint**

  Run `npm.cmd run lint`. Expected result: exit code 0.

- [ ] **Step 3: Run production build**

  Run `npm.cmd run build`. Expected result: exit code 0.

- [ ] **Step 4: Check patch formatting**

  Run `git diff --check`. Expected result: no whitespace errors.

- [ ] **Step 5: Review scope and report changed files**

  Run `git status --short` and `git diff --stat`, confirm only the plan, payload, app mapper, and focused test files are attributable to this task, and leave unrelated user changes untouched. Report that changes are ready for review; do not commit or push until explicitly instructed.
