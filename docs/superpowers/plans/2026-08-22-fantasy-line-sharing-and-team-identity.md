# Fantasy LINE Sharing and Team Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับการแสดงชื่อทีมและเพิ่มการแชร์ leaderboard, player stats และ current squad ผ่าน LINE โดยไม่เพิ่ม schema หรือเปลี่ยน data flow ของ Fantasy เดิม

**Architecture:** เพิ่ม pure Flex payload builders แยกใน `lib/fantasy/fantasy-share-payload.ts` แล้วเชื่อมเข้ากับ `shareFlexMessage`/LIFF ใน `app/fantasy/fantasy-app.tsx` ตาม pattern ของแอปทายผล ข้อมูล avatar ของ LINE ส่งต่อจาก leaderboard row เดิมไปยัง popup ผ่าน selected-entry state ไม่มี API หรือ Supabase migration ใหม่

**Tech Stack:** Next.js 16 App Router, React 19 client component, TypeScript, LINE LIFF `shareTargetPicker`, existing Flex validation, Node test runner

**Spec:** `docs/superpowers/specs/2026-08-22-fantasy-line-sharing-and-team-identity-design.md`

## Global Constraints

- ใช้ `npm.cmd` สำหรับคำสั่ง npm ทั้งหมด
- อ่านคำแนะนำ Next.js ใน `node_modules/next/dist/docs/` ก่อนแก้โค้ด Next.js
- ใช้ TDD: เขียน failing test และยืนยันว่า fail ก่อน implementation ของแต่ละ behavior
- ห้ามเพิ่ม schema, migration หรือเขียนข้อมูล production สำหรับงานนี้
- รักษาการเปลี่ยนแปลง unrelated ใน worktree ไว้ทั้งหมด
- ใช้ `shareTargetPicker` เดิม และไม่เปิดเผย secret/token/environment values
- ก่อนสรุปงานต้องรัน `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` และ `git diff --check`

---

### Task 1: Add tested Fantasy share payload builders

**Files:**
- Create: `lib/fantasy/fantasy-share-payload.ts`
- Create: `tests/fantasy/fantasy-share-payload.test.mts`
- Modify: `lib/line/share-payload.ts` only if a shared type/export is required after tests expose a duplication; do not change existing prediction payload behavior

**Interfaces:**
- Consumes: `LeagueLeaderboardRow` from `lib/fantasy/league-scoring.ts`, `FantasyPlayerStatEntry`/`FantasyPlayerStatGroups` from `lib/fantasy/scoring.ts`, `FantasyEntryCurrentSquad`/`FantasySquadPlayer` from `lib/fantasy/types.ts`, `playerDisplayPoints` and `squadRows`
- Produces:
  - `buildFantasyLeaderboardShareFlex(input: { leagueName: string; gameweek: number; period: "gameweek" | "season"; rows: Array<{ rank: number; managerName: string; teamName: string; points: number; avatarUrl: string | null }> }): FlexMessage`
  - `buildFantasyPlayerStatsShareFlex(input: { gameweek: number; categoryLabel: string; positionLabel: string; rows: Array<{ rank: number; playerName: string; clubName: string; metricValue: number; photoUrl?: string }> }): FlexMessage`
  - `buildFantasySquadShareFlex(input: { managerName: string; managerAvatarUrl?: string | null; teamName: string; squad: FantasyEntryCurrentSquad }): FlexMessage`

- [ ] **Step 1: Write failing payload tests**

  Add tests that assert:

  ```ts
  test("builds a fantasy GW leaderboard without exposing entry ids", () => {
    const message = buildFantasyLeaderboardShareFlex({
      leagueName: "เชยเชย Cup",
      gameweek: 3,
      period: "gameweek",
      rows: [{ rank: 1, managerName: "Picky", teamName: "Chei FC", points: 26, avatarUrl: null }],
    });
    const serialized = JSON.stringify(message);
    assert.match(serialized, /เชยเชย Cup/);
    assert.match(serialized, /GW 3/);
    assert.match(serialized, /Chei FC/);
    assert.doesNotMatch(serialized, /entry|FPL/i);
  });

  test("labels season and preserves rank, manager, team and points", () => {
    const message = buildFantasyLeaderboardShareFlex({
      leagueName: "เชยเชย Cup",
      gameweek: 3,
      period: "season",
      rows: [{ rank: 1, managerName: "Picky", teamName: "Chei FC", points: 120, avatarUrl: null }],
    });
    const serialized = JSON.stringify(message);
    assert.match(serialized, /ทั้งฤดูกาล/);
    assert.match(serialized, /120/);
  });

  test("builds filtered player-stat share with category and position", () => {
    const message = buildFantasyPlayerStatsShareFlex({
      gameweek: 3,
      categoryLabel: "ฟอร์มสูงสุด",
      positionLabel: "กองกลาง",
      rows: [{ rank: 1, playerName: "Semenyo", clubName: "Bournemouth", metricValue: 8, photoUrl: "https://example.com/semenyo.png" }],
    });
    const serialized = JSON.stringify(message);
    assert.match(serialized, /ฟอร์มสูงสุด/);
    assert.match(serialized, /กองกลาง/);
    assert.match(serialized, /Semenyo/);
  });

  test("builds five squad rows and doubles captain display points", () => {
    const message = buildFantasySquadShareFlex({ managerName: "Picky", managerAvatarUrl: null, teamName: "Chei FC", squad: fixtureSquad() });
    const serialized = JSON.stringify(message);
    for (const label of ["GK", "กองหลัง", "กองกลาง", "กองหน้า", "ตัวสำรอง"]) assert.match(serialized, new RegExp(label));
    assert.match(serialized, /6 × 2 = 12/);
    assert.doesNotMatch(serialized, /entryId|FPL Entry/i);
  });
  ```

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm.cmd test -- tests/fantasy/fantasy-share-payload.test.mts`

  Expected: FAIL because `lib/fantasy/fantasy-share-payload.ts` and its builders do not exist yet.

- [ ] **Step 3: Implement the minimal builders**

  Build Flex bubbles with the existing dark Fantasy palette and HTTPS-safe image helpers. Use the existing `validateFlexMessage` contract through `shareFlexMessage`; keep leaderboard rows paged at the existing mobile-safe row count. Use `squadRows(squad)` for the exact five-row order and `playerDisplayPoints(player)` for captain/vice-captain labels. Never include Entry ID in any visible text.

- [ ] **Step 4: Run focused tests and verify they pass**

  Run: `npm.cmd test -- tests/fantasy/fantasy-share-payload.test.mts`

  Expected: PASS with all new payload tests green.

- [ ] **Step 5: Commit the isolated payload unit**

  Run: `git add lib/fantasy/fantasy-share-payload.ts tests/fantasy/fantasy-share-payload.test.mts docs/superpowers/specs/2026-08-22-fantasy-line-sharing-and-team-identity-design.md docs/superpowers/plans/2026-08-22-fantasy-line-sharing-and-team-identity.md` then `git commit -m "feat: add fantasy LINE share payloads"`.

### Task 2: Add tested Fantasy share action behavior

**Files:**
- Create: `lib/fantasy/fantasy-share-actions.ts`
- Create: `tests/fantasy/fantasy-share-actions.test.mts`
- Modify: `lib/line/share.ts` only if a small generic status helper is needed; preserve existing error codes

**Interfaces:**
- Consumes: `ShareTargetPickerApi`, `ShareMessage`, `shareFlexMessage`, `formatShareErrorMessage`, and the three Task 1 builders
- Produces:
  - `type FantasyShareStatus = { state: "idle" | "sharing" | "shared" | "cancelled" | "error"; message?: string }`
  - `shareFantasyLeaderboard(api, input): Promise<FantasyShareStatus>`
  - `shareFantasyPlayerStats(api, input): Promise<FantasyShareStatus>`
  - `shareFantasySquad(api, input): Promise<FantasyShareStatus>`

- [ ] **Step 1: Write failing action tests**

  Cover a successful share, a cancelled picker result, and unavailable picker behavior:

  ```ts
  test("returns shared after the LINE picker succeeds", async () => {
    const api = { isApiAvailable: () => true, shareTargetPicker: async () => ({ status: "success" }) };
    const result = await shareFantasyLeaderboard(api, leaderboardInput);
    assert.equal(result.state, "shared");
  });

  test("returns cancelled without reporting success when the picker is cancelled", async () => {
    const api = { isApiAvailable: () => true, shareTargetPicker: async () => ({ status: "cancelled" }) };
    const result = await shareFantasyLeaderboard(api, leaderboardInput);
    assert.equal(result.state, "cancelled");
  });

  test("returns a safe error when shareTargetPicker is unavailable", async () => {
    const api = { isApiAvailable: () => false, shareTargetPicker: async () => ({ status: "success" }) };
    const result = await shareFantasySquad(api, squadInput);
    assert.equal(result.state, "error");
    assert.match(result.message ?? "", /LINE WebView/);
  });
  ```

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm.cmd test -- tests/fantasy/fantasy-share-actions.test.mts`

  Expected: FAIL because the action module does not exist.

- [ ] **Step 3: Implement the action wrappers**

  Build the message, call `shareFlexMessage`, map `"shared"` to `shared`, map `"cancelled"` to `cancelled`, and map thrown errors through `formatShareErrorMessage`. Do not retry automatically and do not issue any server request.

- [ ] **Step 4: Run focused tests and verify they pass**

  Run: `npm.cmd test -- tests/fantasy/fantasy-share-actions.test.mts tests/fantasy/fantasy-share-payload.test.mts`

  Expected: PASS.

- [ ] **Step 5: Commit the action unit**

  Run: `git add lib/fantasy/fantasy-share-actions.ts tests/fantasy/fantasy-share-actions.test.mts` then `git commit -m "feat: handle fantasy LINE share results"`.

### Task 3: Update Fantasy UI for names, dropdowns, avatars and share buttons

**Files:**
- Modify: `app/fantasy/fantasy-app.tsx`
- Test: `tests/fantasy/fantasy-share-actions.test.mts` for any state adapter extracted from the component

**Interfaces:**
- Consumes: Task 1 payload builders, Task 2 share action wrappers, `liff` adapter pattern from `app/components/prediction-app-final.tsx`, existing `visiblePlayerStats`, `squadRows`, `PlayerPhoto`, `Avatar`, and `FantasyLeagueDashboardResponse`
- Produces: user-visible Fantasy sharing controls without changing API/database contracts

- [ ] **Step 1: Add the smallest UI-facing failing assertions**

  Before editing JSX, extend the pure tests with the exact display rules used by the UI adapter: `ชื่อทีม : Chei FC` is present, an entry ID is absent, selected-entry avatar URL is preserved, and the player-stat share input contains the selected category/position and visible rows.

- [ ] **Step 2: Run those assertions and verify they fail**

  Run: `npm.cmd test -- tests/fantasy/fantasy-share-actions.test.mts`

  Expected: FAIL against the current leaderboard/popup view model because team-name formatting and avatar propagation are not implemented.

- [ ] **Step 3: Implement the UI changes**

  In `app/fantasy/fantasy-app.tsx`:

  - Import `Share2`, `ChevronDown`, `liff`, and Task 2 action wrappers.
  - Extend `SelectedEntry` with `avatarUrl: string | null` and pass `entry.avatarUrl` from leaderboard rows.
  - Replace the leaderboard team subtitle with green `ชื่อทีม : ${entry.teamName}` and remove Entry ID/mapping text. Keep the manager name at the existing `text-sm` size.
  - Add `แชร์ตารางคะแนน` beside the leaderboard period control. Pass the currently displayed entries and selected `mode`; show sharing, success, cancelled and error status without blocking other controls.
  - Add `avatarUrl` to the squad modal header using the existing `Avatar` component. Add `แชร์ทีมนี้` only after squad data loads successfully, using the current `response.squad` and no refresh request.
  - Keep the squad modal mobile-first: `max-h`, `max-w`, vertical scroll, five horizontally scrollable rows, and a full-width share button that wraps safely on narrow screens.
  - Replace player-stat category pill buttons with a native accessible `<select>` and retain a separate position `<select>`. Add `แชร์สถิตินักเตะ` below the filtered list and pass the selected labels plus `visible` rows.
  - Keep all share controls disabled while their own share operation is in progress; use `role="status"` for success/cancelled and `role="alert"` for errors.

- [ ] **Step 4: Run focused tests and static checks**

  Run: `npm.cmd test -- tests/fantasy tests/line/share.test.mts tests/line/share-payload.test.mts`

  Expected: PASS. Then run `npm.cmd run lint` and fix only errors caused by this task.

- [ ] **Step 5: Commit the UI integration**

  Run: `git add app/fantasy/fantasy-app.tsx` then `git commit -m "feat: share fantasy views through LINE"`.

### Task 4: Full verification and handoff

**Files:**
- Modify: none unless verification identifies a regression from this feature

- [ ] **Step 1: Run the complete automated test suite**

  Run: `npm.cmd test`

  Expected: all tests pass, including existing prediction and Fantasy tests.

- [ ] **Step 2: Run lint and production build**

  Run: `npm.cmd run lint` and `npm.cmd run build`

  Expected: both commands exit successfully with no new warnings that indicate a feature regression.

- [ ] **Step 3: Check patch formatting and scope**

  Run: `git diff --check` and `git status --short`

  Expected: `git diff --check` passes; unrelated user changes remain untouched; no migration, secret, or production-data file is introduced.

- [ ] **Step 4: Review the final diff**

  Run: `git diff HEAD~3..HEAD --stat` and `git diff HEAD~3..HEAD -- app/fantasy/fantasy-app.tsx lib/fantasy/fantasy-share-payload.ts lib/fantasy/fantasy-share-actions.ts`

  Confirm the final diff contains only the approved Fantasy display/share behavior and tests before reporting completion. Do not push unless the user separately approves the resulting commits.
