# Fantasy Weekly Features and Leaderboard Share Implementation Plan

**Goal:** เพิ่ม Player of the Week, Team of the Week และ Flex แชร์ Top 5/Bottom 5 ให้หน้า Fantasy โดยดึงข้อมูลสดจาก FPL และไม่เพิ่มข้อมูลถาวรใน Supabase

**Architecture:** ใช้ FPL provider ฝั่ง server ที่มีอยู่เพื่อเรียก `bootstrap-static`, event-live และ Dream Team API แบบ on-demand. เพิ่ม pure resolver สำหรับ validation/fallback และขยาย response/state ของ Fantasy dashboard โดยแยก error ของ weekly features ออกจาก leaderboard หลัก. ขยาย Flex builders และ share actions เดิมโดยไม่เปลี่ยนระบบทายผลหรือ schema

**Tech Stack:** Next.js 16.2.12, React 19, TypeScript, Node test runner, LINE Flex Messaging, existing FPL provider and Fantasy repository

**Spec:** `docs/superpowers/specs/2026-08-24-fantasy-player-team-week-and-leaderboard-share-design.md`

## Global Constraints

- อ่านคำแนะนำที่เกี่ยวข้องใน `node_modules/next/dist/docs/` ก่อนแก้ไฟล์ Next.js หรือ route
- ใช้ `superpowers:test-driven-development`: เขียน failing test และรันให้ fail ก่อน implementation ทุก behavior ใหม่
- ใช้ FPL live data; ห้ามสร้าง migration หรือตารางใหม่ และห้ามเขียน weekly feature data ลง Supabase
- ใช้ `npm.cmd` สำหรับคำสั่ง npm ทั้งหมด
- ห้ามอ่าน แสดง หรือ commit secret, token, service-role key หรือ environment value
- รักษา unrelated changes ใน worktree และแก้เฉพาะไฟล์ของ feature นี้
- ห้าม commit หรือ push จนกว่าผู้ใช้จะอนุมัติอย่างชัดเจน
- ก่อนสรุปว่างานเสร็จต้องรัน `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` และ `git diff --check` พร้อมตรวจ output

---

## Task 1: เพิ่ม domain contracts และ FPL live provider methods

**Files:**
- Modify: `lib/fantasy/types.ts`
- Modify: `lib/fantasy/fpl-client.ts`
- Test: `tests/fantasy/fpl-client.test.mts`
- Create: `tests/fantasy/weekly-features.test.mts`

**Interfaces:**
- Produces `FplGameweekSummary`, `FplEventLivePlayer`, `FplDreamTeamPlayer`, และ provider methods `getEventLive(gameweekNumber)` กับ `getDreamTeam(gameweekNumber)`
- `FplBootstrapSnapshot` ต้อง expose normalized event summaries เพื่อให้ resolver หา current/previous GW ได้ โดยไม่ส่ง raw FPL object เข้า UI

- [ ] **Step 1: อ่าน Next.js guidance ที่เกี่ยวข้องก่อน implementation**

อ่านไฟล์เอกสารใน `node_modules/next/dist/docs/` ที่เกี่ยวกับ App Router route handlers, server-only data access และ fetch caching แล้วบันทึกข้อจำกัดที่กระทบ route/data layerไว้ใน review notes ของงาน ไม่แก้เอกสาร dependency

- [ ] **Step 2: เขียน failing provider tests สำหรับ event-live และ Dream Team**

เพิ่ม fixture ที่ตรวจ URL และ normalized output:

```ts
test("normalizes FPL event-live points and Dream Team players", async () => {
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/api/event/3/live/")) {
        return Response.json({ elements: [{ id: 10, stats: { total_points: 18 } }] });
      }
      if (url.endsWith("/api/dream-team/3/")) {
        return Response.json({ top_player: { id: 10, points: 18 }, team: [{ element: 10, points: 18, position: 1 }] });
      }
      return Response.json({ ...bootstrap, events: [{ id: 3, is_current: true, finished: false }] });
    },
  });

  assert.deepEqual(await provider.getEventLive(3), [{ playerId: 10, points: 18 }]);
  assert.deepEqual(await provider.getDreamTeam(3), {
    topPlayerId: 10,
    topPoints: 18,
    players: [{ playerId: 10, points: 18, position: 1 }],
  });
});
```

- [ ] **Step 3: รัน test ใหม่ให้ fail**

Run: `npm.cmd test -- tests/fantasy/fpl-client.test.mts`

Expected: FAIL เพราะ provider ยังไม่มี `getEventLive` และ `getDreamTeam` และ bootstrap ยังไม่ expose event summary

- [ ] **Step 4: เพิ่ม type contracts และ normalize functions**

เพิ่ม type ที่ `lib/fantasy/types.ts`:

```ts
export type FplGameweekSummary = {
  number: number;
  isCurrent: boolean;
  finished: boolean;
  topPlayerId: number | null;
  topPoints: number | null;
};

export type FplEventLivePlayer = { playerId: number; points: number };

export type FplDreamTeamPlayer = { playerId: number; points: number; position: number };

export type FplDreamTeamSnapshot = {
  topPlayerId: number | null;
  topPoints: number | null;
  players: FplDreamTeamPlayer[];
};
```

ขยาย `FplBootstrapSnapshot` ด้วย `gameweeks: FplGameweekSummary[]` และขยาย `FantasyFplProvider` ด้วย:

```ts
getEventLive(gameweekNumber: number): Promise<FplEventLivePlayer[]>;
getDreamTeam(gameweekNumber: number): Promise<FplDreamTeamSnapshot>;
```

normalize ต้อง reject invalid JSON shape, non-finite numbers, duplicate/invalid IDs ตาม pattern `FantasyFplError` เดิม และไม่ส่ง response body ของ FPL กลับออกไป

- [ ] **Step 5: ต่อ provider ให้ผ่าน test**

เพิ่มการเรียก:

```ts
fetchJson(`event/${gameweekNumber}/live/`, options)
fetchJson(`dream-team/${gameweekNumber}/`, options)
```

เพิ่ม `events` normalization จาก `root.events` โดยอ่าน `id`, `is_current`, `finished`, `top_element` และ `top_element_info.points` แบบ nullable เมื่อ FPL ยังไม่มีค่า

- [ ] **Step 6: รัน focused tests ให้ผ่าน**

Run: `npm.cmd test -- tests/fantasy/fpl-client.test.mts`

Expected: PASS รวม tests เดิมทั้งหมดและ tests ใหม่ของ provider โดยไม่มีการเปลี่ยน behavior ของ entry picks/league calls

---

## Task 2: สร้าง weekly feature resolver และต่อ Player of the Week เข้า dashboard response

**Files:**
- Create: `lib/fantasy/weekly-features.ts`
- Modify: `lib/fantasy/types.ts`
- Modify: `lib/fantasy/league-dashboard.ts`
- Modify: `lib/data/fantasy.ts`
- Modify: `tests/fantasy/league-dashboard.test.mts`
- Create: `tests/fantasy/weekly-features.test.mts`

**Interfaces:**
- Consumes: `FplBootstrapSnapshot`, `FplEventLivePlayer[]`, `FantasyFplProvider`
- Produces: `FantasyPlayerOfWeek`, `FantasyTeamOfWeek`, และ `FantasyWeeklyFeatureState<T>` สำหรับ UI/API

- [ ] **Step 1: เขียน failing resolver tests**

เพิ่ม tests ที่ใช้ข้อมูลจำลองและไม่เรียก network:

```ts
test("returns every tied Player of the Week", () => {
  const result = resolvePlayerOfWeek({
    bootstrap: fixtureBootstrap({ currentGameweek: 3, topPlayerId: 10, topPoints: 18 }),
    eventLive: new Map([[3, [{ playerId: 10, points: 18 }, { playerId: 11, points: 18 }, { playerId: 12, points: 12 }]]]),
  });

  assert.equal(result.gameweek, 3);
  assert.deepEqual(result.players.map((player) => player.playerId), [10, 11]);
  assert.equal(result.topPoints, 18);
});

test("falls back to the newest valid previous GW", () => {
  const result = resolveLatestPlayerOfWeek({
    bootstrap: fixtureBootstrapWithGameweeks([3, 2, 1]),
    eventLiveByGameweek: new Map([
      [3, []],
      [2, [{ playerId: 10, points: 16 }]],
    ]),
  });

  assert.equal(result.state, "ready");
  assert.equal(result.value.gameweek, 2);
});

test("returns unavailable when no GW has valid Player of the Week data", () => {
  const result = resolveLatestPlayerOfWeek({ bootstrap: fixtureBootstrapWithGameweeks([2, 1]), eventLiveByGameweek: new Map() });
  assert.deepEqual(result, { state: "unavailable", message: "ยังไม่มีข้อมูล Player of the Week" });
});
```

- [ ] **Step 2: รัน resolver tests ให้ fail**

Run: `npm.cmd test -- tests/fantasy/weekly-features.test.mts`

Expected: FAIL เพราะ weekly resolver และ contracts ยังไม่มี

- [ ] **Step 3: กำหนด normalized feature contracts**

เพิ่ม contracts ที่รองรับ UI/shared presentation:

```ts
export type FantasyPlayerOfWeek = {
  gameweek: number;
  topPoints: number;
  players: FantasySquadPlayer[];
};

export type FantasyWeeklyFeatureState<T> =
  | { state: "ready"; value: T }
  | { state: "unavailable"; message: string };
```

`FantasySquadPlayer` ที่สร้างเพื่อ weekly feature ต้องใช้ `playerId`, `playerName`, `position`, `clubName`, `photoUrl`, `points` เดิม และกำหนด `isCaptain=false`, `isViceCaptain=false`, `multiplier=1`

- [ ] **Step 4: implement Player of the Week resolver**

เพิ่ม pure functions ใน `lib/fantasy/weekly-features.ts`:

```ts
export function resolvePlayerOfWeek(input: {
  bootstrap: FplBootstrapSnapshot;
  gameweek: number;
  eventLive: FplEventLivePlayer[];
}): FantasyPlayerOfWeek | null;

export function resolveLatestPlayerOfWeek(input: {
  bootstrap: FplBootstrapSnapshot;
  eventLiveByGameweek: ReadonlyMap<number, FplEventLivePlayer[]>;
}): FantasyWeeklyFeatureState<FantasyPlayerOfWeek>;
```

เรียง candidate จาก current GW ลงไป 1, ใช้ event-live points เพื่อหาคะแนนสูงสุดและรวม ties, จับคู่ metadata จาก bootstrap, เรียงผู้เล่นด้วย player ID เพื่อให้ผล deterministic และคืน no-data message เมื่อไม่มี candidate

- [ ] **Step 5: เพิ่ม Player of the Week ใน dashboard data โดยแยก failure จาก dashboard หลัก**

ขยาย `FantasyLeagueDashboardResponse` ด้วย:

```ts
playerOfWeek: FantasyWeeklyFeatureState<FantasyPlayerOfWeek>;
```

ใน `getFantasyLeagueDashboardData` ให้โหลด repository dashboard และ bootstrap แบบแยก failure boundary. ถ้า bootstrap/event-live สำเร็จให้คืน ready; ถ้าไม่สำเร็จให้คืน `{ state: "unavailable", message: "ไม่สามารถโหลด Player of the Week ได้ในขณะนี้" }` และยังคืน leaderboard/player stats เดิมได้

การเรียก event-live ให้พยายามเฉพาะ current/fallback candidates ที่จำเป็น และห้าม upsert repository ใดๆ

- [ ] **Step 6: เพิ่ม dashboard tests และรัน**

เพิ่ม test ยืนยันว่า feature failure ไม่ทำให้ `buildFantasyLeagueDashboard` โยน error และ response มี state แยกจาก leaderboard. จากนั้นรัน:

Run: `npm.cmd test -- tests/fantasy/weekly-features.test.mts tests/fantasy/league-dashboard.test.mts`

Expected: PASS

---

## Task 3: เพิ่ม Team of the Week resolver และ authenticated API route

**Files:**
- Modify: `lib/fantasy/weekly-features.ts`
- Create: `lib/api/fantasy-team-of-week-handler.ts`
- Modify: `lib/data/fantasy.ts`
- Create: `app/api/fantasy/team-of-week/route.ts`
- Modify: `tests/fantasy/weekly-features.test.mts`
- Create: `tests/api/fantasy-team-of-week-route.test.mts`

**Interfaces:**
- Consumes: provider `getBootstrap()` and `getDreamTeam(gameweekNumber)`
- Produces: `FantasyTeamOfWeek` with `gameweek`, `source: "FPL Official"`, and 11 normalized players

- [ ] **Step 1: เขียน failing Team of the Week tests**

```ts
test("normalizes an official Dream Team into four positions", () => {
  const result = resolveTeamOfWeek({
    bootstrap: fixtureBootstrap({ currentGameweek: 3 }),
    dreamTeam: fixtureDreamTeam(11),
    gameweek: 3,
  });

  assert.equal(result.gameweek, 3);
  assert.equal(result.source, "FPL Official");
  assert.equal(result.players.length, 11);
  assert.equal(result.players.some((player) => player.isCaptain), false);
});

test("rejects incomplete Dream Team so caller can fallback", () => {
  assert.equal(resolveTeamOfWeek({ bootstrap: fixtureBootstrap({ currentGameweek: 3 }), dreamTeam: fixtureDreamTeam(10), gameweek: 3 }), null);
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npm.cmd test -- tests/fantasy/weekly-features.test.mts`

Expected: FAIL เพราะ Team of the Week resolver ยังไม่มี

- [ ] **Step 3: implement Dream Team normalization and fallback**

เพิ่ม functions:

```ts
export function resolveTeamOfWeek(input: {
  bootstrap: FplBootstrapSnapshot;
  dreamTeam: FplDreamTeamSnapshot;
  gameweek: number;
}): FantasyTeamOfWeek | null;

export async function loadLatestTeamOfWeek(input: {
  provider: Pick<FantasyFplProvider, "getBootstrap" | "getDreamTeam">;
}): Promise<FantasyWeeklyFeatureState<FantasyTeamOfWeek>>;
```

`loadLatestTeamOfWeek` ต้องลอง current GW ลงไปหา GW 1, reject team ที่ไม่ครบ 11/ID ซ้ำ/metadata หาย, และไม่สร้าง captain จากข้อมูลที่ไม่มี. เมื่อล้มเหลวทุก candidate ให้คืน `ไม่สามารถโหลด Team of the Week ได้ในขณะนี้`

- [ ] **Step 4: เพิ่ม data function และ route handler**

เพิ่ม `getFantasyTeamOfWeekData()` ใน `lib/data/fantasy.ts` ให้สร้าง provider แล้วเรียก `loadLatestTeamOfWeek` โดยไม่ใช้ repository write

เพิ่ม handler contract:

```ts
export type FantasyTeamOfWeekHandlerDependencies = {
  requireUser: () => Promise<{ id: string }>;
  getTeamOfWeek: (input: { userId: string }) => Promise<unknown>;
};
```

route `GET /api/fantasy/team-of-week` ต้องใช้ `requireUser`, คืน 401 เมื่อ auth ไม่ผ่าน, คืน JSON พร้อม `cache-control: no-store` เมื่อสำเร็จ และคืนข้อความปลอดภัย `Unable to load Fantasy Team of the Week` เมื่อ upstream ล้มเหลว

- [ ] **Step 5: เขียน route tests ให้ครอบคลุม auth และ safe error**

เพิ่ม tests สำหรับ 401, success payload ที่มี `gameweek/source/players`, และ 500 ที่ไม่เปิดเผย FPL error body จากนั้นรัน:

Run: `npm.cmd test -- tests/fantasy/weekly-features.test.mts tests/api/fantasy-team-of-week-route.test.mts`

Expected: PASS

---

## Task 4: เพิ่ม UI cards, Team of the Week popup และ Player of the Week highlight

**Files:**
- Modify: `app/fantasy/fantasy-app.tsx`
- Modify: `lib/fantasy/squad-layout.ts`
- Modify: `lib/fantasy/player-presentation.ts`
- Create: `tests/fantasy/fantasy-weekly-ui-copy.test.mts`

**Interfaces:**
- Consumes: `data.playerOfWeek`, `/api/fantasy/team-of-week`, existing `FantasyEntryCurrentSquad`, `shareFantasySquad` and new Team of the Week share action
- Produces: vertical Player of the Week cards, Team of the Week loading/success/error modal, and highlight props keyed by player ID

- [ ] **Step 1: เขียน failing UI contract tests**

ใช้ `readFile` แบบที่มีใน `tests/fantasy/fantasy-ui-copy.test.mts` เพื่อตรวจ behavior สำคัญที่ไม่ต้องพึ่ง browser renderer:

```ts
test("renders the approved weekly feature labels and no retry copy", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /Player of the Week/);
  assert.match(source, /Team of the Week/);
  assert.doesNotMatch(source, /ลองใหม่|retry/i);
});
```

เพิ่ม pure presentation test ให้ player ID ที่อยู่ใน `highlightPlayerIds` ได้ class/label เลมอน และ player อื่นไม่ได้รับ label

- [ ] **Step 2: รัน UI tests ให้ fail**

Run: `npm.cmd test -- tests/fantasy/fantasy-weekly-ui-copy.test.mts`

Expected: FAIL เพราะหน้า UI ยังไม่มี weekly cards/button/highlight props

- [ ] **Step 3: แยก helper สำหรับ highlight และ position rows โดยไม่เปลี่ยน squad semantics เดิม**

เพิ่ม helper ที่รับ `highlightPlayerIds: ReadonlySet<number>` และคืน presentation metadata:

```ts
export function playerHighlight(playerId: number, highlightPlayerIds: ReadonlySet<number>) {
  return highlightPlayerIds.has(playerId)
    ? { label: "Player of the Week", className: "border-[#d9ff58] bg-[#d9ff58]/10" }
    : { label: null, className: "" };
}
```

ใช้ helper เดียวกันใน popup team ของเพื่อนและ Team of the Week popup เพื่อให้สี/ข้อความ deterministic

- [ ] **Step 4: เพิ่ม Player of the Week cards ใน `PlayerStats`**

อ่าน `data.playerOfWeek` แล้ว render หลัง popular captain/vice cards:

- `state === "ready"`: vertical cards ทุก tied player พร้อม GW, club, position, points และ lemon label
- `state === "unavailable"`: กล่องสถานะเฉพาะ feature พร้อมข้อความจาก state
- ไม่มี `retry` button
- ไม่แก้ player stats filter/list และไม่ส่ง highlight เข้า player stats share

- [ ] **Step 5: เพิ่ม Team of the Week button และ modal state ใน `FantasyApp`**

เพิ่ม states แยก:

```ts
const [teamOfWeekLoading, setTeamOfWeekLoading] = useState(false);
const [teamOfWeek, setTeamOfWeek] = useState<FantasyTeamOfWeek | null>(null);
const [teamOfWeekError, setTeamOfWeekError] = useState("");
```

เมื่อกดปุ่มให้ fetch `/api/fantasy/team-of-week` ด้วย `cache: "no-store"`, เปิด modal loading, แล้วแสดง success/error ใน modal. ถ้า error ไม่มี share button และไม่มี retry button. ใช้ `FPL Official` เป็น source label และ profile fallback แบบไม่มีรูป

- [ ] **Step 6: ส่ง highlight IDs เข้า friend popup และ Team of the Week popup**

เมื่อ `data.playerOfWeek.state === "ready"` ให้สร้าง `new Set(data.playerOfWeek.value.players.map(({ playerId }) => playerId))` แล้วส่งให้:

- current squad modal
- `buildFantasySquadShareFlex`
- Team of the Week modal
- Team of the Week share builder

ห้ามส่ง set นี้ให้ `PlayerStats` list/share

- [ ] **Step 7: รัน UI/domain tests**

Run: `npm.cmd test -- tests/fantasy/fantasy-weekly-ui-copy.test.mts tests/fantasy/player-presentation.test.mts tests/fantasy/squad-layout.test.mts`

Expected: PASS และ tests เดิมของ current squad ยังผ่าน

---

## Task 5: ขยาย Flex payload และ share actions สำหรับ Team of the Week และ Top/Bottom

**Files:**
- Modify: `lib/fantasy/fantasy-share-payload.ts`
- Modify: `lib/fantasy/fantasy-share-actions.ts`
- Create: `lib/fantasy/leaderboard-share-selection.ts`
- Modify: `tests/fantasy/fantasy-share-payload.test.mts`
- Modify: `tests/fantasy/fantasy-share-actions.test.mts`
- Create: `tests/fantasy/leaderboard-share-selection.test.mts`

**Interfaces:**
- Produces `buildFantasyTeamOfWeekShareFlex(input)` and `shareFantasyTeamOfWeek(api, input)`
- Produces `buildFantasyLeaderboardTopBottomShareFlex(input)` and `shareFantasyLeaderboardTopBottom(api, input)`
- `buildFantasySquadShareFlex` gains optional `highlightPlayerIds?: ReadonlySet<number> | readonly number[]` without changing existing caller behavior

- [ ] **Step 1: เขียน failing selection tests**

```ts
test("includes every row tied at the Top 5 boundary", () => {
  const rows = [1, 2, 3, 4, 5, 5, 7].map((rank, index) => ({ rank, managerName: `M${index}`, teamName: `T${index}`, points: 20 - index, avatarUrl: null }));
  assert.equal(selectTopLeaderboardRows(rows).length, 6);
});

test("selects the bottom five ranks and keeps the bottom boundary tie", () => {
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10].map((rank, index) => ({ rank, managerName: `M${index}`, teamName: `T${index}`, points: 20 - index, avatarUrl: null }));
  assert.equal(selectBottomLeaderboardRows(rows).length, 3);
  assert.ok(selectBottomLeaderboardRows(rows).every((row) => row.rank >= 9));
});
```

- [ ] **Step 2: รัน selection tests ให้ fail**

Run: `npm.cmd test -- tests/fantasy/leaderboard-share-selection.test.mts`

Expected: FAIL เพราะ selection helpers ยังไม่มี

- [ ] **Step 3: implement rank-based selection**

ใน `lib/fantasy/leaderboard-share-selection.ts` กำหนด:

```ts
export function selectTopLeaderboardRows<T extends { rank: number }>(rows: readonly T[], limit = 5): T[];
export function selectBottomLeaderboardRows<T extends { rank: number }>(rows: readonly T[], limit = 5): T[];
```

Top ให้หา `rows.filter(row => row.rank <= limit)`. Bottom ให้หา unique rank ที่อยู่ท้าย `limit` กลุ่ม แล้ว filter ด้วย rank ตั้งแต่ boundary เป็นต้นไป. คืนลำดับเดิมของ leaderboard และไม่แก้ input

- [ ] **Step 4: เขียน failing Flex tests**

เพิ่ม assertions:

```ts
test("builds Top/Bottom share as exactly two bubbles", () => {
  const message = buildFantasyLeaderboardTopBottomShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    topRows: [{ rank: 1, managerName: "Top", teamName: "Top FC", points: 30, avatarUrl: null }],
    bottomRows: [{ rank: 20, managerName: "Bottom", teamName: "Bottom FC", points: 1, avatarUrl: null }],
  });
  validateFlexMessage(message);
  const contents = message.contents as { type: string; contents: unknown[] };
  assert.equal(contents.type, "carousel");
  assert.equal(contents.contents.length, 2);
});

test("marks Player of the Week in squad and Team of the Week shares", () => {
  const message = buildFantasySquadShareFlex({ ...fixtureInput, highlightPlayerIds: new Set([2]) });
  assert.match(JSON.stringify(message), /Player of the Week/);
});
```

- [ ] **Step 5: รัน Flex tests ให้ fail**

Run: `npm.cmd test -- tests/fantasy/fantasy-share-payload.test.mts`

Expected: FAIL เพราะ builders ใหม่และ highlight option ยังไม่มี

- [ ] **Step 6: implement shared Flex row/highlight helpers**

ปรับ `fantasy-share-payload.ts` โดย:

- เพิ่ม `highlightPlayerIds` ให้ `squadPlayer`
- เมื่อ player ID อยู่ใน set ให้เพิ่ม lemon border/background และ text `Player of the Week`
- คง captain display point multiplier เดิม
- เพิ่ม `teamOfWeekRow` ที่จัด 4 ตำแหน่งและไม่สร้าง bench row
- เพิ่ม `buildFantasyTeamOfWeekShareFlex({ gameweek, players, highlightPlayerIds })` เป็น 1 bubble พร้อม `FPL Official`
- เพิ่ม `buildFantasyLeaderboardTopBottomShareFlex({ leagueName, gameweek, period, topRows, bottomRows })` เป็น 2 bubbles ใน message เดียว
- ใช้ `validateFlexMessage` กับ payload และ fallback ที่มีขนาดปลอดภัยตาม pattern เดิม

Team of the Week share ต้องใช้คะแนน API ส่งมาโดยตรง และไม่คูณคะแนน เพราะ builder จะได้รับ `isCaptain=false` ทุกคน

- [ ] **Step 7: เพิ่ม share actions และทดสอบผลลัพธ์**

เพิ่ม functions ใน `fantasy-share-actions.ts` ที่เรียก `shareFlexMessage` ผ่าน helper เดิม:

```ts
export function shareFantasyTeamOfWeek(api: ShareTargetPickerApi, input: Parameters<typeof buildFantasyTeamOfWeekShareFlex>[0]): Promise<FantasyShareStatus>;
export function shareFantasyLeaderboardTopBottom(api: ShareTargetPickerApi, input: Parameters<typeof buildFantasyLeaderboardTopBottomShareFlex>[0]): Promise<FantasyShareStatus>;
```

ใช้ error/cancel copy เดิม ไม่เพิ่มการตรวจ `shareTargetPicker` ใหม่ตาม scope ที่ผู้ใช้กำหนดไว้

- [ ] **Step 8: รัน share tests ให้ผ่าน**

Run: `npm.cmd test -- tests/fantasy/leaderboard-share-selection.test.mts tests/fantasy/fantasy-share-payload.test.mts tests/fantasy/fantasy-share-actions.test.mts`

Expected: PASS, payload ผ่าน `validateFlexMessage`, Team of the Week มี 1 bubble และ Top/Bottom มี 2 bubbles

---

## Task 6: เชื่อมปุ่มแชร์ Top/Bottom และ Team of the Week เข้ากับ dashboard

**Files:**
- Modify: `app/fantasy/fantasy-app.tsx`
- Modify: `tests/fantasy/fantasy-ui-copy.test.mts`
- Modify: `tests/fantasy/fantasy-weekly-ui-copy.test.mts`

**Interfaces:**
- Consumes: leaderboard `data.leaderboard.gameweek/season`, `selectTopLeaderboardRows`, `selectBottomLeaderboardRows`, weekly Team state
- Produces: one dashboard action for Top/Bottom share and one Team of the Week share action

- [ ] **Step 1: เขียน failing dashboard copy/state tests**

ตรวจ source ว่ามี action labels และ selected mode input:

```ts
test("exposes Top 5 and Bottom 5 share action from the leaderboard", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /Top 5/);
  assert.match(source, /Bottom 5/);
  assert.match(source, /shareFantasyLeaderboardTopBottom/);
});
```

- [ ] **Step 2: รันให้ fail**

Run: `npm.cmd test -- tests/fantasy/fantasy-ui-copy.test.mts tests/fantasy/fantasy-weekly-ui-copy.test.mts`

Expected: FAIL เพราะยังไม่มี labels/action ใหม่

- [ ] **Step 3: ต่อ `Leaderboard` กับ top/bottom share**

ใน `Leaderboard` ใช้ `entries = mode === "gameweek" ? data.leaderboard.gameweek : data.leaderboard.season` ชุดเดิม แล้ว map เป็น share rows พร้อม avatar/team/points, เรียก selection helpers และส่ง `leagueName`, `data.selectedLeaderboardGameweek`, `mode`, `topRows`, `bottomRows` ให้ action ใหม่

เพิ่มปุ่มใต้ตารางที่ใช้ `isSharing`/`shareStatus` แยกจากปุ่มแชร์ทั้งตาราง เพื่อไม่ล็อกปุ่มอื่นเกินจำเป็น และคงการเลือกลีก/GW/โหมดของผู้ใช้

- [ ] **Step 4: ต่อ Team of the Week share**

ใน Team of the Week modal เพิ่มปุ่มแชร์เฉพาะเมื่อ state ready. ส่ง `FPL Official`, actual GW, players และ Player of the Week ID set เข้า `shareFantasyTeamOfWeek`. Error state ไม่มีปุ่มแชร์

- [ ] **Step 5: รัน UI tests และ regression tests**

Run: `npm.cmd test -- tests/fantasy/fantasy-ui-copy.test.mts tests/fantasy/fantasy-weekly-ui-copy.test.mts tests/fantasy/fantasy-share-actions.test.mts tests/fantasy/fantasy-share-payload.test.mts`

Expected: PASS และ existing full-table/player-stats/team share behavior ไม่เปลี่ยน

---

## Task 7: ตรวจสอบรวมและเตรียม handoff โดยไม่ commit/push

**Files:**
- No new implementation files
- Review only: `git diff --stat`, `git diff --check`, test/lint/build output

- [ ] **Step 1: ตรวจว่าไม่มี schema/production change**

Run: `git status --short; git diff --name-only -- app lib tests docs/superpowers`

Expected: มีเฉพาะไฟล์ใน Tasks 1–6 และ design/plan docs ที่เกี่ยวข้อง; ไม่มี migration, `.env`, secret หรือไฟล์ prediction ที่ไม่เกี่ยวข้อง

- [ ] **Step 2: รัน test suite ทั้งหมด**

Run: `npm.cmd test`

Expected: exit code 0 และไม่มี test failure

- [ ] **Step 3: รัน lint**

Run: `npm.cmd run lint`

Expected: exit code 0 และไม่มี lint error ใหม่

- [ ] **Step 4: รัน production build**

Run: `npm.cmd run build`

Expected: exit code 0 และ route `/api/fantasy/team-of-week` ถูก compile สำเร็จ

- [ ] **Step 5: ตรวจ whitespace และ diff**

Run: `git diff --check`

Expected: ไม่มี whitespace error. ตรวจ diff ด้วยตนเองว่า no database write, no production secret, no unrelated rewrite และ fallback/error copy ตรงตาม spec

- [ ] **Step 6: หยุดรอคำสั่ง commit/push**

รายงานผล checks และลิงก์ไฟล์ที่แก้ไขให้ผู้ใช้ review. ห้ามรัน `git commit` หรือ `git push` จนกว่าผู้ใช้จะสั่งอย่างชัดเจน

---

## Plan self-review

### Spec coverage

- Player of the Week current load, ties, fallback, vertical cards, lemon label: Tasks 1, 2, 4
- Team of the Week API, 11 players, actual GW, FPL Official, no invented captain, popup/share: Tasks 1, 3, 4, 5, 6
- Highlight only in approved team popup/team shares: Tasks 4 and 5
- Top/Bottom one action, two bubbles, selected league/GW/mode, rank-boundary ties: Tasks 5 and 6
- No database changes and preserved prediction boundary: Global Constraints, Tasks 2, 3, 7
- TDD and final verification: every implementation task starts with failing tests; Task 7 runs all required checks

### Placeholder scan

The plan contains no `TODO`, `TBD`, or unspecified implementation step. Every new interface, file, test command, error message, and boundary rule is named explicitly.

### Type/interface consistency

- Task 1 defines provider methods consumed by Task 2 and Task 3.
- Task 2 defines `FantasyPlayerOfWeek` and weekly state consumed by Task 4.
- Task 3 defines `FantasyTeamOfWeek` consumed by Tasks 4–6.
- Task 5 defines share builders/actions consumed by Task 6.
- Existing `FantasySquadPlayer` and `FantasyShareStatus` remain the shared contracts; optional highlight input preserves existing callers.

## Execution gate

Plan is complete and saved. Implementation requires the user's explicit approval of this plan. Once approved, execute tasks in order using TDD and stop before commit/push for a separate user instruction.
