# LINE Flex Commands and Avatar Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ( - [ ] ) syntax for tracking.

**Goal:** เพิ่ม Flex ตารางคะแนน/บอลวันนี้/ผลทายจากข้อมูลจริง, ให้ Bot ตอบเฉพาะคีย์เวิร์ด, เชื่อมปุ่มแชร์/เปิด LIFF, และแก้ avatar กับลำดับชื่อ-โลโก้ทีมทุกจุดในแอป

**Architecture:** แยก pure command router, server-only Supabase data reader และ pure Flex builders ออกจาก LINE webhook boundary. Flex builders รับ DTO ที่ serializable เท่านั้นและแบ่งรายการยาวเป็น carousel bubbles พร้อม footer URI action. UI ใช้ builder เดียวกับ Bot สำหรับ share เพื่อให้ payload และ visual contract ตรงกัน.

**Tech Stack:** Next.js 16.2.12 App Router, React 19, @line/liff 2.29.1, @supabase/supabase-js 2.111.0, Node built-in test runner, TypeScript, Supabase MCP.

## Global Constraints

- ใช้ npm.cmd ทุกครั้งบน Windows.
- ใช้ Supabase MCP สำหรับการตรวจ schema/data และ query ที่เกี่ยวข้องกับ Supabase; รอบนี้ห้ามแก้ schema และห้ามเขียนข้อมูล production.
- ห้ามใส่หรือแสดง LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, FPL_SYNC_TOKEN, SESSION_SECRET หรือ Supabase key ใน Git, เอกสาร, test fixture, log หรือแชท.
- ห้ามแก้ fixture จริงค้างไว้เพื่อสร้างสถานะทดสอบ.
- คำสั่ง Bot ต้อง match แบบ exact alias หลัง normalize whitespace; ข้อความอื่นไม่ส่ง reply.
- ทุก Flex ต้องใช้สี #071525/#10253A, มี footer URI action ไป https://fpl-chei2.vercel.app/, และไม่ล้มทั้ง payload เมื่อ avatar/logo URL ว่าง.
- คู่แข่งขันทุกจุดใช้ลำดับ ชื่อทีมเหย้า + โลโก้เหย้า และ โลโก้เยือน + ชื่อทีมเยือน.
- รักษาไฟล์ที่ผู้ใช้แก้ไว้ก่อนเริ่มงานและ stage เฉพาะไฟล์ของงานนี้.
- ห้าม commit/push ระหว่าง implementation จนกว่าจะผ่าน verification สดและผู้ใช้ตรวจ final diff แล้ว.

## File Map

- Create lib/line/commands.ts: normalize text และ map aliases เป็น command.
- Modify lib/line/flex.ts: prediction, standings และ today-fixtures builders พร้อม shared team/user/footer components.
- Create lib/data/line-bot.ts: server-only Supabase reader สำหรับ current gameweek, standings, today fixtures และ user predictions.
- Modify lib/line/webhook.ts: route recognized commands ไปยัง injected command handler; ignore unknown text.
- Modify app/api/line/webhook/route.ts: wire server-only data reader and command handler into existing signature/reply boundary.
- Modify app/components/prediction-app-final.tsx: share standings, use new prediction Flex DTO, fix avatar fallback and match ordering in all relevant views.
- Modify app/page.tsx: fix Landing avatar fallback.
- Create lib/avatar.ts: pure fallback predicate used by both client components.
- Modify lib/predictions.ts only if the existing detail DTO needs logo data; prefer mapping from the existing fixture object in the component.
- Create or modify tests/line/flex.test.mts, tests/line/commands.test.mts, tests/line/webhook.test.mts, tests/api/line-webhook-route.test.mts, tests/data/line-bot.test.mts, tests/avatar.test.mts, and tests/predictions.test.mts as required by the red-green cycles.
- Create docs/phase-3a-line-flex-bot-test-evidence.md after manual verification; never place secrets or personal message bodies in it.

---

### Task 1: Define the Flex DTOs and failing payload tests

**Files:**
- Modify: lib/line/flex.ts
- Test: tests/line/flex.test.mts

**Interfaces:**

- buildPredictionResultFlex(input: PredictionFlexInput): FlexMessage
- buildStandingsFlex(input: StandingsFlexInput): FlexMessage
- buildTodayFixturesFlex(input: TodayFixturesFlexInput): FlexMessage
- PredictionFlexInput contains displayName, avatarUrl, gameweek, and fixture team objects with name, logoUrl, and choice.
- StandingsFlexInput contains period, optional gameweek, and rows with rank, displayName, avatarUrl, and points.
- TodayFixturesFlexInput contains Thai date label and fixtures with kickoffLabel, statusLabel, and home/away team objects.

- [x] Step 1: Write failing tests for the three payload shapes.

  Assert that a prediction input with Picky, two HTTPS logo URLs, and choice home produces a Flex message with an app URI action, Picky and the avatar URL, a home component ordered name then image, an away component ordered image then name, and a visible home highlight. Add cases for draw, away, empty predictions, standings rows with avatar URLs, today fixtures with kickoff labels, and a long standings list that becomes a carousel without dropping rows.

- [x] Step 2: Run the focused test file and confirm the expected RED state.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/line/flex.test.mts
  ~~~

  Expected: failure because the new DTO fields and today-fixtures builder are not implemented yet. Do not change production code before observing this failure.

- [x] Step 3: Implement the minimum shared Flex helpers.

  Add one shared footer action with a button style primary, color #D9FF58, URI action label เปิดแอป FPL Chei Chei, and URI https://fpl-chei2.vercel.app/. Use #071525 for the bubble/background, #10253A for content blocks, #FFFFFF for primary text, and #D9FF58 for prediction highlights. Use image components only for non-empty HTTPS URLs; use a neutral fallback box/text when a URL is absent. Chunk standings into equal-height carousel bubbles when the row count is too large for one readable bubble.

- [x] Step 4: Run the focused tests and confirm GREEN.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/line/flex.test.mts
  npm.cmd run test -- tests/line/flex.test.mts tests/line/share.test.mts
  ~~~

  Expected: all focused Flex/share tests pass.

### Task 2: Add exact keyword command routing

**Files:**
- Create: lib/line/commands.ts
- Test: tests/line/commands.test.mts

**Interfaces:**

~~~ts
export type LineBotCommand = "menu" | "standings" | "todayFixtures" | "myPredictions";
export function parseLineCommand(text: string): LineBotCommand | null;
export function buildLineMenuMessage(): LineMessage;
~~~

- [x] Step 1: Write failing tests for aliases and ignored text.

  Test these exact mappings: ขอตาราง, ตารางคะแนน, คะแนน, อันดับ to standings; บอลวันนี้, โปรแกรมบอล, คู่วันนี้ to todayFixtures; ผลทาย, คำทาย to myPredictions; เมนู, ช่วย, คำสั่ง to menu; and a normal sentence to null. Include repeated whitespace and empty-string cases. Verify the menu message lists only approved aliases and contains no token-like values.

- [x] Step 2: Run the command tests and observe RED.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/line/commands.test.mts
  ~~~

  Expected: failure because lib/line/commands.ts does not exist.

- [x] Step 3: Implement normalization and exact alias lookup.

  Normalize with trim and collapsed whitespace, then use a static alias map. Do not use substring matching, arbitrary sentence matching, or a fallback reply for unknown text.

- [x] Step 4: Run command tests and the complete existing test suite.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/line/commands.test.mts
  npm.cmd run test
  ~~~

  Expected: command tests pass and existing tests are updated only where the old generic acknowledgement contract is intentionally replaced.

### Task 3: Build the server-only Supabase data reader

**Files:**
- Create: lib/data/line-bot.ts
- Test: tests/data/line-bot.test.mts

**Interfaces:**

~~~ts
export type LineBotDataReader = {
  getCurrentStandings(): Promise<StandingsData>;
  getTodayFixtures(now: Date): Promise<TodayFixturesData>;
  getUserPredictions(lineUserId: string): Promise<UserPredictionData | null>;
};

export function createLineBotDataReader(): LineBotDataReader;
~~~

DTOs returned by this reader must already contain display-ready names, HTTPS logo/avatar URLs or empty strings, Thai labels, gameweek number, and prediction choice. The reader must import server-only and use getSupabaseAdmin(); no DTO or client component may receive a service key.

- [x] Step 1: Inspect the current schema/read patterns before writing queries.

  Use the verified public tables and columns: seasons.status = active; gameweeks.is_current; gameweek_participants.status; app_users.status, line_user_id, display_name, avatar_url; gameweek_scores.points; fixtures.kickoff_at/status/home_score/away_score; teams.name/short_name/logo_url; predictions.outcome/status. Keep this read-only. Do not call insert, update, upsert, RPC write functions, or migrations.

- [x] Step 2: Write failing tests for deterministic mapping.

  Inject a fake query adapter into a small internal reader factory or test pure row-mapping helpers. Cover active participants and user avatar joins for standings, Bangkok calendar boundaries for today fixtures, home/away order, finished/live/scheduled labels, user prediction lookup by line_user_id, unknown user null, and empty results.

- [x] Step 3: Run the data-reader tests and observe RED.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/data/line-bot.test.mts
  ~~~

  Expected: failure because the reader and/or mapping helpers are missing.

- [x] Step 4: Implement read-only queries and DTO mapping.

  Query the active season and current gameweek, then fetch only rows needed by each command. Calculate Bangkok day start/end in UTC for getTodayFixtures(now). Keep user prediction lookup limited to the sender LINE user ID and current gameweek. Return generic errors from the public handler; do not log raw rows or credentials.

- [x] Step 5: Run focused tests and a read-only Supabase verification query.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/data/line-bot.test.mts
  ~~~

  Then use Supabase MCP execute_sql only for a read-only count/shape check of active season, current gameweek, teams, fixtures, app users, predictions, and scores. Confirm no row counts or fixture values changed.

### Task 4: Replace generic webhook acknowledgement with command replies

**Files:**
- Modify: lib/line/webhook.ts
- Modify: app/api/line/webhook/route.ts
- Modify: lib/line/messaging.ts only if its LineMessage union needs the new Flex shape
- Test: tests/line/webhook.test.mts
- Test: tests/api/line-webhook-route.test.mts

**Interfaces:**

~~~ts
export type LineBotCommandService = {
  replyForText(input: {
    text: string;
    lineUserId?: string;
  }): Promise<LineMessage[] | null>;
};

export function createLineBotCommandService(
  data: LineBotDataReader,
): LineBotCommandService;
~~~

- [x] Step 1: Update webhook tests to express the new behavior.

  Add tests that ขอตาราง calls the service and replies with standings Flex; บอลวันนี้ replies with today-fixtures Flex; ผลทาย passes event.source.userId; เมนู replies with text; unsupported text does not call reply; missing replyToken is ignored; unknown lineUserId for ผลทาย receives safe open-LIFF text; and the route still rejects invalid signatures before processing and returns safe 502 on LINE API failure.

- [x] Step 2: Run the focused webhook tests and observe RED.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/line/webhook.test.mts tests/api/line-webhook-route.test.mts
  ~~~

  Expected: failures because the command service is not wired and the old acknowledgement expectation is obsolete.

- [x] Step 3: Implement the command service.

  Map parsed commands to getCurrentStandings/buildStandingsFlex, getTodayFixtures/buildTodayFixturesFlex, getUserPredictions/buildPredictionResultFlex, and buildLineMenuMessage. Unknown commands return null. Keep raw-body reading and signature verification order unchanged. Construct the service only after server configuration has been loaded; never include configuration values in errors.

- [x] Step 4: Run focused tests and the full test suite.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/line/webhook.test.mts tests/api/line-webhook-route.test.mts
  npm.cmd run test
  ~~~

  Expected: all webhook, route, and existing tests pass.

### Task 5: Wire standings share and fix all app match/avatar layouts

**Files:**
- Modify: app/components/prediction-app-final.tsx
- Modify: app/page.tsx
- Create: lib/avatar.ts
- Test: tests/avatar.test.mts
- Modify: tests/line/share.test.mts
- Modify: tests/predictions.test.mts only if a new pure match-display helper is introduced

**Interfaces:**

~~~ts
export function hasAvatarImage(value: string | null | undefined): boolean;
~~~

- [x] Step 1: Write failing avatar/share regression tests.

  Assert that a non-empty HTTPS avatar returns true and empty/null values return false. Extend share tests to assert the standings message passed to shareTargetPicker contains avatar URLs, points, current mode, the footer LIFF URI, and the correct team ordering/highlight contract for prediction share.

- [x] Step 2: Run focused tests and observe RED.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/avatar.test.mts tests/line/share.test.mts
  ~~~

  Expected: failure because the helper and standings share callback are not implemented.

- [x] Step 3: Implement the minimum UI changes.

  Lift leaderboard mode to PredictionApp or pass a mode-aware share callback so the button shares the mode currently visible. Build standings rows from current entries and call shareFlexMessage with buildStandingsFlex. Keep cancellation/unavailable/unexpected share messages safe and readable. Change Avatar and Landing avatar markup to render initials only when hasAvatarImage is false. Change every relevant app match display: prediction card home name then logo and away logo then name; results card same order; fixture detail modal same order; player prediction detail adds both team logos and the same order while retaining prediction highlight. Preserve click handlers, selection, modals, scores, and status labels.

- [x] Step 4: Run focused and full tests.

  Run:

  ~~~powershell
  npm.cmd run test -- tests/avatar.test.mts tests/line/share.test.mts tests/predictions.test.mts
  npm.cmd run test
  ~~~

  Expected: all tests pass with no secret-like output.

### Task 6: Production-facing verification and evidence

**Files:**
- Create: docs/phase-3a-line-flex-bot-test-evidence.md
- Modify: docs/project-status.md only if the final verified status needs a concise update

- [x] Step 1: Run the complete local verification commands.

  Run each command fresh:

  ~~~powershell
  npm.cmd run test
  npm.cmd run lint
  npm.cmd run build
  git diff --check
  ~~~

  Expected: test runner reports zero failures, ESLint exits 0, Next build exits 0, and diff check reports no whitespace errors.

- [x] Step 2: Run read-only secret and scope checks.

  Search tracked/staged files for secret names and confirm values are absent:

  ~~~powershell
  git grep -n -E "LINE_CHANNEL_SECRET|LINE_CHANNEL_ACCESS_TOKEN|FPL_SYNC_TOKEN|SESSION_SECRET|SUPABASE_SERVICE_ROLE_KEY" -- ":!*.lock"
  ~~~

  Review git status --short and git diff --cached --stat; confirm pre-existing user files are not staged and no fixture/data files were changed.

- [ ] Step 3: Test in LINE and record evidence without personal payloads. (pending after review/deploy)

  In the existing test group send เมนู, ขอตาราง, บอลวันนี้, and ผลทาย; send one unsupported sentence and confirm no reply; verify each Flex opens the production LIFF endpoint; share standings from the LIFF leaderboard button; share prediction results from the save flow; inspect team order, logos, avatar, highlights, scores, and Thai time; inspect Landing, prediction, results, player detail, and fixture detail views for no avatar initials overlay and consistent team order. Record timestamp, command category, observed result, and safe failure behavior. Do not record LINE user IDs, raw message bodies, tokens, signatures, or private screenshots in the repository.

- [x] Step 4: Stop for user review before commit/push.

  Present the diff, verification counts, and evidence categories. Commit and push only after the user approves this implementation batch.

## Completion Checklist

- [x] Approved spec remains consistent with the implementation.
- [x] Every new pure function has a test that was observed failing before implementation.
- [x] No unknown text receives a Bot reply.
- [x] All three Flex builders include the app URI action and required colors.
- [x] All match displays use home name+logo and away logo+name.
- [x] Avatar initials render only when no image URL exists.
- [x] Supabase read verification shows no production mutation.
- [x] Full test, lint, build, and diff checks have fresh passing evidence.
- [ ] User has reviewed the final diff before commit/push.
