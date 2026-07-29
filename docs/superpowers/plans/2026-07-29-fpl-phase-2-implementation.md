# FPL Phase 2 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เปลี่ยน Phase 1 mock dashboard ให้เป็นระบบทายผลพรีเมียร์ลีกที่ใช้งานจริงสำหรับกลุ่มประมาณ 20 คน โดยมี LIFF identity, server session, Supabase data, FPL sync, server-authoritative prediction locking, scoring/recalculation และ admin workflow ตาม design ที่อนุมัติแล้ว

**Architecture:** LIFF จะส่ง ID token ไปยัง Next.js Route Handler เพื่อ verify กับ LINE ก่อน upsert `app_users`, join active season และออก HttpOnly session cookie ที่เซ็นด้วย `SESSION_SECRET`. Route Handlers และ server-only data access layer จะเป็นทางเดียวที่อ่าน/เขียน Supabase โดยใช้ secret/service key; browser จะไม่ใช้ Supabase client โดยตรง. Google Apps Script จะเป็น scheduler ภายนอกเพียงตัวเดียว เรียก protected FPL sync endpoint ทุก 10 นาที ส่วน scoring จะคำนวณด้วย pure TypeScript แล้ว replace scores/awards แบบ atomic ผ่าน Supabase RPC.

**Tech Stack:** Next.js `16.2.12` App Router, React `19.2.4`, TypeScript, Next.js Route Handlers, `@supabase/supabase-js` (server-only), `jose` (signed session), Supabase PostgreSQL/RLS/RPC, LINE LIFF ID-token verification, FPL official API, Google Apps Script, Node built-in test runner (`node --experimental-strip-types --test`).

## Global Constraints

- ใช้ฤดูกาลปัจจุบันก่อน แต่ schema ต้องมี `season_id`
- ใช้ Vercel Free
- ใช้ Google Apps Script เป็น external scheduler แทน Vercel Cron
- Apps Script trigger ทุก 10 นาที แล้วเรียก Vercel sync endpoint
- Sync ผล: เสาร์/อาทิตย์ 18:00–02:00 Asia/Bangkok ทุก 10 นาที และจันทร์–ศุกร์หลัง 06:00 วันละครั้ง
- Sync ตาราง: อังคารและศุกร์หลัง 18:00
- มี manual sync สำหรับ admin
- ผู้ใช้ใหม่ผ่าน LIFF เข้า active season อัตโนมัติ
- มีหน้า `/admin` เฉพาะ admin คนเดียว
- Admin ระบุด้วย `ADMIN_LINE_USER_ID`
- Exclude ผู้เล่นเฉพาะ gameweek โดยไม่ลบ user/history
- GW ที่ exclude จะไม่รวมใน season total
- ทายถูก 3 คะแนน; ผิดหรือไม่ทาย 0 คะแนน
- แก้คำทายได้ก่อน kickoff เท่านั้น
- ตรวจ lock จาก server/database ไม่เชื่อ frontend
- Fixture postponed: void คำทายเดิม, ไม่คิดคะแนนใน GW เดิม, ให้ทายใหม่เมื่อย้าย GW, คะแนนไปคิดใน GW ใหม่
- GW เดิมคำนวณได้เมื่อไม่มี scheduled/live fixture เหลือ และมี fixture finished อย่างน้อยหนึ่งคู่
- คะแนนเท่ากัน ทุกคนได้แชมป์/บ๊วย
- หากผลถูกแก้ ต้อง recalculate gameweek, awards และ season total ใหม่
- ไม่มีสถานะ `cancelled` ถาวรใน domain
- Browser ห้ามเขียน Supabase โดยตรง; secret/service key อยู่ server เท่านั้น และห้ามใช้ `NEXT_PUBLIC_*` กับ secret
- ทุก table ใน exposed schema ต้องเปิด RLS; business tables จะ revoke สิทธิ์ `anon`/`authenticated` และเข้าผ่าน server service client เท่านั้น
- ใช้ PostgreSQL `timestamptz`; แสดงผลด้วย `Asia/Bangkok`
- ใช้ `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build` บน Windows
- ห้ามแก้ UI ที่ไม่เกี่ยวข้องกับ Phase 2
- ห้าม commit หรือ push จนกว่าผู้ใช้จะตรวจและอนุมัติผลลัพธ์
- ห้ามใช้ Prisma, Drizzle, Redis หรือ worker แยกในชุดแรก

## Repository baseline and file map

สถานะที่ตรวจแล้ว: `HEAD=057b2fa`, branch `main` อยู่ `ahead 1` จาก `origin/main`, working tree สะอาด. Existing Phase 1 files ที่ต้อง preserve คือ `app/components/liff-gate.tsx`, `app/components/prediction-app-final.tsx`, `app/dashboard/page.tsx`, `lib/mock-data.ts` และ `lib/predictions.ts`; การแก้จะจำกัดเฉพาะการเปลี่ยน data source/auth flow ที่ Phase 2 ต้องใช้.

Files ที่จะสร้างหรือแก้หลัก ๆ:

- Create: the migration file produced by `supabase migration new phase_2_schema` — schema, constraints, indexes, RLS, RPC สำหรับ atomic score replacement
- Create: `lib/env.ts`, `lib/supabase/admin.ts`, `lib/db/types.ts` — server-only env validation, Supabase service client และ generated/manual DB types
- Create: `lib/auth/session.ts`, `lib/auth/liff.ts`, `lib/auth/guards.ts` — signed session, LINE verification, auth/admin guards
- Create: `lib/domain/fixtures.ts`, `lib/domain/predictions.ts`, `lib/domain/scoring.ts`, `lib/domain/sync.ts` — pure business rules
- Create: `lib/data/season.ts`, `lib/data/dashboard.ts`, `lib/data/predictions.ts`, `lib/data/admin.ts`, `lib/data/jobs.ts` — server-only DAL and DTOs
- Create: `lib/fpl/client.ts`, `lib/fpl/adapter.ts`, `lib/fpl/sync.ts` — FPL provider boundary and idempotent sync orchestration
- Create: `lib/scheduler.ts`, `scripts/google-apps-script/fpl-sync.gs` — Bangkok schedule decision logic and external trigger
- Create: `app/api/auth/liff/route.ts`, `app/api/auth/logout/route.ts`, `app/api/dashboard/route.ts`, `app/api/predictions/route.ts`, `app/api/sync/fpl/route.ts`, `app/api/admin/sync/route.ts`, `app/api/admin/participants/route.ts`, `app/api/admin/recalculate/route.ts`
- Create: `app/admin/page.tsx`, `app/admin/loading.tsx` — server-protected single-admin page and loading UI
- Modify: `app/components/liff-gate.tsx`, `app/dashboard/page.tsx`, `app/components/prediction-app-final.tsx`, `app/page.tsx` only as needed to call Phase 2 APIs and render authoritative state
- Modify: `lib/predictions.ts`, `tests/predictions.test.mts` only when shared Phase 1 helpers need domain-compatible types
- Modify: `.env.example`, `README.md`, `docs/project-status.md`
- Create: `tests/domain/fixtures.test.mts`, `tests/domain/scoring.test.mts`, `tests/domain/sync.test.mts`, `tests/auth/session.test.mts`, `tests/api/predictions-route.test.mts`, `tests/api/sync-route.test.mts`

The implementation must not expose raw database rows to Client Components. Each DAL function returns a narrow DTO containing only fields needed by the current page.

---

### Task 1: Add server boundaries and test infrastructure

**Files:**
- Create: `lib/env.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/db/types.ts`
- Modify: `package.json`, `package-lock.json`
- Modify: `.env.example`, `README.md`
- Test: `tests/server-boundaries.test.mts`

**Interfaces:**
- `getServerEnv(): { supabaseUrl: string; supabaseServiceRoleKey: string; lineChannelId: string; sessionSecret: string; adminLineUserId: string; fplApiBaseUrl: string; syncToken: string }` throws a configuration error naming only the missing variable, never its value.
- `getSupabaseAdmin(): SupabaseClient<Database>` returns one server-only service client; the module imports `server-only` and is never imported from a Client Component.
- `.env.example` documents `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_DEMO_MODE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_ID`, `SESSION_SECRET`, `ADMIN_LINE_USER_ID`, `FPL_API_BASE_URL`, and `FPL_SYNC_TOKEN` without values.

- [ ] **Step 1: Write the failing tests** for missing env rejection and for rejecting a module boundary that attempts to expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_*` name.

```ts
it("rejects missing server secrets without printing their values", () => {
  assert.throws(() => getServerEnv(), /SUPABASE_URL|SESSION_SECRET/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm.cmd run test -- tests/server-boundaries.test.mts`
Expected: FAIL because `lib/env.ts` and `getServerEnv` do not exist yet.

- [ ] **Step 3: Add the minimal server-only boundary**; first run `npm.cmd view @supabase/supabase-js version`, `npm.cmd view jose version`, and `npm.cmd view server-only version`, review compatibility with Next `16.2.12`, then install those exact returned versions one package at a time and verify the numeric versions are recorded in `package.json` and `package-lock.json`. Keep all secret reads in `lib/env.ts`/DAL modules.

- [ ] **Step 4: Run the focused test and TypeScript checks**

Run: `npm.cmd run test -- tests/server-boundaries.test.mts`
Expected: PASS; no secret value appears in output.

- [ ] **Step 5: Update environment documentation** with separate public and server-only sections, explicitly stating that `NEXT_PUBLIC_` variables are bundled into the browser and that the service key must never use that prefix.

No commit is made at this checkpoint.

### Task 2: Create the Supabase schema, constraints, RLS, and atomic scoring RPC

**Files:**
- Create: the migration file produced by `supabase migration new phase_2_schema` (do not hand-invent the timestamp)
- Create: `tests/sql/phase-2-schema.sql` — read-only verification queries and expected invariants, not a second schema
- Modify: `lib/db/types.ts`

**Interfaces:**
- Tables: `seasons`, `gameweeks`, `teams`, `fixtures`, `fixture_gameweek_history`, `app_users`, `gameweek_participants`, `predictions`, `prediction_events`, `gameweek_scores`, `gameweek_awards`, `job_runs`.
- IDs are UUID internally; provider IDs remain integer/text columns with season-scoped unique constraints.
- `fixtures.status` is exactly `scheduled | live | finished | postponed`; no `cancelled` value.
- Active prediction uniqueness is enforced by a partial unique index on `(user_id, fixture_id)` where `status = 'active'`; voided rows remain for audit.
- `replace_gameweek_scoring(p_gameweek_id uuid, p_scoring_version integer, p_scores jsonb, p_awards jsonb)` deletes and reinserts only that GW's scores/awards in one database transaction and is callable only by the server role.

Required constraints and indexes:

- `seasons.season_id` is the parent key on every season-owned table; only one season may be `active` through a partial unique index.
- `gameweeks` has unique `(season_id, number)`, number range `1..38`, and status `upcoming | open | closed | reopened`.
- `fixtures` has unique `(season_id, fpl_fixture_id)`, valid home/away team references, nonnegative scores when present, and `gameweek_id` remains unchanged as the internal fixture identity moves between GWs.
- `fixture_gameweek_history` records old/new GW, provider source, changed time and provider payload snapshot.
- `gameweek_participants` has unique `(gameweek_id, user_id)` and status `active | excluded`; exclusion reason is nullable text.
- `predictions.choice` is `home | draw | away`; `predictions.status` is `active | voided`; `prediction_events.event_type` is `created | updated | voided`.
- `gameweek_scores` is unique `(gameweek_id, user_id)`; `gameweek_awards` is unique `(gameweek_id, user_id, award)` and permits ties.
- `job_runs` has unique `idempotency_key`, status `running | succeeded | failed`, mode `results | schedule | manual_results | manual_schedule`, and affected GW IDs in JSONB.
- Enable RLS on every table, revoke `anon` and `authenticated` table privileges, and grant only the server/service role access required by Route Handlers. No browser Supabase client is created.

- [ ] **Step 1: Before changing Supabase, inspect current project state** using the Supabase skill: fetch `https://supabase.com/changelog.md`, follow any relevant breaking changes, use Supabase documentation search for RLS/RPC/migrations, discover the actual project ID, list existing migrations/tables, and run read-only SQL to confirm this repository has no existing Phase 2 schema.

- [ ] **Step 2: Create the migration through the CLI command required by the Supabase skill**

Run: `supabase migration new phase_2_schema`
Expected: one new file under `supabase/migrations/` with the `phase_2_schema` suffix and the timestamp chosen by the CLI.

- [ ] **Step 3: Write the schema migration and read-only SQL checks**. The migration must be idempotent only through constraints/transaction design, not by silently ignoring schema mistakes. The RPC must validate the target GW and scoring version, replace scores/awards atomically, and never update season totals by deltas.

- [ ] **Step 4: Apply the migration to the real Supabase project** using the Supabase MCP migration operation or the discovered supported CLI flow, never a local database. Record the project reference privately; do not place it or credentials in Git.

- [ ] **Step 5: Verify the live schema and security posture**

Run/read-only checks: `supabase migration list` (or MCP migration list), `tests/sql/phase-2-schema.sql`, and Supabase security/performance advisors.
Expected: all 12 tables exist, every table has RLS enabled, no `anon`/`authenticated` business-table grant exists, constraints/indexes/RPC exist, and advisors report no unresolved Phase 2 RLS/security issue.

- [ ] **Step 6: Generate database types from the live project** with the Supabase type-generation tool and update `lib/db/types.ts`; review the diff so no secret or generated credential is included.

No commit is made at this checkpoint.

### Task 3: Implement pure domain rules with TDD

**Files:**
- Create: `lib/domain/fixtures.ts`
- Create: `lib/domain/predictions.ts`
- Create: `lib/domain/scoring.ts`
- Create: `lib/domain/sync.ts`
- Test: `tests/domain/fixtures.test.mts`
- Test: `tests/domain/scoring.test.mts`
- Test: `tests/domain/sync.test.mts`

**Interfaces:**
- `type PredictionChoice = "home" | "draw" | "away"`.
- `type FixtureStatus = "scheduled" | "live" | "finished" | "postponed"`.
- `getFixtureOutcome(homeScore: number, awayScore: number): PredictionChoice`.
- `scorePrediction(choice: PredictionChoice | null, outcome: PredictionChoice | null): 0 | 3`.
- `isPredictionOpen(input: { status: FixtureStatus; kickoffAt: Date; now: Date; gameweekParticipantStatus: "active" | "excluded" }): boolean` checks all server-side lock conditions.
- `canCloseGameweek(fixtures: Array<{ status: FixtureStatus }>): boolean` requires no scheduled/live fixture and at least one finished fixture; postponed fixtures alone do not block closure and do not create awards.
- `reconcileFixtureMove(input)` returns `{ moved: boolean; oldGameweekId: string | null; newGameweekId: string | null; voidPrediction: boolean; reopenTarget: boolean }` and preserves predictions only when the GW is unchanged and only kickoff moved before the fixture started.
- `calculateGameweekScoring(input)` returns deterministic `scores` and tied `awards` from finished fixtures, active predictions and active participants; excluded users and postponed fixtures are omitted.

- [ ] **Step 1: Write one failing test per behavior before implementation**

```ts
it("awards three points only when the predicted outcome matches", () => {
  assert.equal(scorePrediction("home", "home"), 3);
  assert.equal(scorePrediction("home", "draw"), 0);
  assert.equal(scorePrediction(null, "home"), 0);
});

it("locks a prediction at kickoff and for excluded or non-open fixtures", () => {
  const kickoff = new Date("2026-08-15T12:00:00.000Z");
  assert.equal(isPredictionOpen({ status: "scheduled", kickoffAt: kickoff, now: new Date(kickoff.getTime() - 1), gameweekParticipantStatus: "active" }), true);
  assert.equal(isPredictionOpen({ status: "scheduled", kickoffAt: kickoff, now: kickoff, gameweekParticipantStatus: "active" }), false);
  assert.equal(isPredictionOpen({ status: "scheduled", kickoffAt: kickoff, now: new Date(kickoff.getTime() - 1), gameweekParticipantStatus: "excluded" }), false);
});

it("gives every tied top and bottom player an award", () => {
  const result = calculateGameweekScoring({
    fixtures: [{ id: "fx-1", status: "finished", outcome: "home" }],
    predictions: [
      { userId: "u1", fixtureId: "fx-1", choice: "home", status: "active" },
      { userId: "u2", fixtureId: "fx-1", choice: "home", status: "active" },
    ],
    participants: [
      { userId: "u1", status: "active" },
      { userId: "u2", status: "active" },
    ],
  });
  assert.deepEqual(result.awards, [
    { userId: "u1", award: "champion", points: 3 },
    { userId: "u2", award: "champion", points: 3 },
    { userId: "u1", award: "wooden_spoon", points: 0 },
    { userId: "u2", award: "wooden_spoon", points: 0 },
  ]);
});
```

- [ ] **Step 2: Run the focused tests and confirm a real RED failure**

Run: `npm.cmd run test -- tests/domain/fixtures.test.mts tests/domain/scoring.test.mts tests/domain/sync.test.mts`
Expected: FAIL because the new pure functions are not defined; fix test typos until the failure is caused by missing behavior.

- [ ] **Step 3: Implement the minimum pure functions** with no database calls, clock reads, provider assumptions or frontend state. Pass `now` explicitly so lock behavior is deterministic.

- [ ] **Step 4: Run the same focused tests and confirm GREEN**, then add edge cases: zero finished fixtures means no awards; a postponed fixture is excluded; a moved fixture voids the old prediction; old GW and new GW are both marked affected; a changed result recalculates to a different score; excluded GW is omitted from season aggregation.

- [ ] **Step 5: Refactor only after green** to share `PredictionChoice`, fixture status and scoring input types with server DALs without changing behavior.

No commit is made at this checkpoint.

### Task 4: Add LIFF token verification and HttpOnly session

**Files:**
- Create: `lib/auth/session.ts`
- Create: `lib/auth/liff.ts`
- Create: `lib/auth/guards.ts`
- Create: `app/api/auth/liff/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Test: `tests/auth/session.test.mts`
- Test: `tests/api/auth-liff-route.test.mts`
- Modify: `app/components/liff-gate.tsx`

**Interfaces:**
- `verifyLiffIdToken(idToken: string): Promise<VerifiedLineProfile>` calls LINE's server verify endpoint with `LINE_CHANNEL_ID`; only the verified response is trusted and returns `lineUserId`, display name and optional profile image.
- `createSession(payload: { appUserId: string; lineUserId: string }): Promise<void>` signs a minimal payload with `SESSION_SECRET` and sets an HttpOnly cookie.
- `getSession(): Promise<Session | null>` reads `await cookies()`, verifies signature/expiry/algorithm and returns no secret/PII beyond IDs.
- `requireUser(): Promise<AuthenticatedUser>` verifies session and reloads the user from Supabase; `requireAdmin(): Promise<AdminUser>` additionally compares verified LINE user ID exactly with `ADMIN_LINE_USER_ID`.
- `POST /api/auth/liff` accepts `{ idToken }`, verifies it on the server, upserts `app_users`, inserts active-season `gameweek_participants`, sets the cookie and returns a minimal DTO. It never returns the token or service key.
- `POST /api/auth/logout` deletes the cookie from a Route Handler.

- [ ] **Step 1: Write failing session and route tests** for invalid signature, expired session, valid session, malformed JSON/content type, invalid LINE token, successful user upsert/join and admin/non-admin authorization. Use a dependency-injected fake LINE verifier and data adapter in tests; do not assert only that a mock was called.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm.cmd run test -- tests/auth/session.test.mts tests/api/auth-liff-route.test.mts`
Expected: FAIL because session/auth modules and Route Handler do not exist.

- [ ] **Step 3: Implement session/auth minimally** using `jose` HS256, a short-lived signed cookie payload, `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `secure: true` in deployed production. Keep local/test secure behavior configurable without weakening production.

- [ ] **Step 4: Implement the LIFF Route Handler** with a strict JSON body size/content-type check, server LINE verification, database upsert and active-season join. Return `400` for malformed input, `401` for invalid identity, `500` without internal error details for provider/database failure.

- [ ] **Step 5: Run focused tests to verify GREEN**, then run `npm.cmd run lint` and fix only Phase 2 errors. Confirm the browser bundle contains no server-only import or secret reference.

- [ ] **Step 6: Connect `LiffGate`** so successful LIFF initialization posts the ID token to `/api/auth/liff` before rendering children; preview mode remains clearly labeled and does not call Supabase. Do not log ID tokens, LINE profile payloads or cookies.

No commit is made at this checkpoint.

### Task 5: Implement server DAL and authoritative prediction API

**Files:**
- Create: `lib/data/season.ts`
- Create: `lib/data/dashboard.ts`
- Create: `lib/data/predictions.ts`
- Create: `app/api/dashboard/route.ts`
- Create: `app/api/predictions/route.ts`
- Test: `tests/api/predictions-route.test.mts`
- Test: `tests/data/dashboard.test.mts`
- Modify: `app/dashboard/page.tsx`, `app/components/prediction-app-final.tsx`

**Interfaces:**
- `getActiveSeason(): Promise<SeasonDTO>` and `ensureActiveSeasonParticipant(userId, seasonId)`.
- `getDashboardDTO(userId, seasonId, gameweekNumber): Promise<DashboardDTO>` returns gameweek status, fixtures, teams, current user's active predictions, participant-safe leaderboard and result percentages; it never exposes service records, raw provider payloads or another user's private fields.
- `savePrediction(userId, input: { fixtureId: string; choice: PredictionChoice }): Promise<PredictionDTO>` rechecks session/participant, fixture ownership, status, `now() < kickoff_at`, choice and active prediction uniqueness in the server/database boundary before upsert and `prediction_events` insert.
- `GET /api/dashboard?gameweek=28` requires session and validates the integer/range `1..38` against the active season.
- `POST /api/predictions` requires session and accepts exactly `{ fixtureId, choice }`; response is `{ prediction: { fixtureId, choice, status } }`.
- `401` means no valid session, `403` means excluded/admin boundary violation, `404` means unknown season/GW/fixture, `409` means kickoff/closed/postponed/duplicate business conflict, `422` means malformed choice/input.

- [ ] **Step 1: Write failing Route Handler/DAL tests** for accepting an active pre-kickoff prediction, rejecting at-kickoff mutation even when frontend sends it, rejecting excluded participant, rejecting postponed/finished fixture, preserving only one active prediction, and filtering dashboard DTO fields.

```ts
it("rejects a prediction exactly at server kickoff time", async () => {
  const response = await postPrediction({ fixtureId: "fx-1", choice: "home" }, { now: "2026-08-15T12:00:00.000Z" });
  assert.equal(response.status, 409);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd run test -- tests/api/predictions-route.test.mts tests/data/dashboard.test.mts`
Expected: FAIL because the Route Handler/DAL is missing.

- [ ] **Step 3: Implement DAL and Route Handlers** with server-side guards and Supabase service client. Keep all database access in `lib/data/*`; Route Handlers parse/validate HTTP input and map domain errors to stable status codes.

- [ ] **Step 4: Add transaction-safe prediction write behavior**: insert/update `predictions`, insert a `prediction_events` row, and rely on the active partial unique index. A race at kickoff must return conflict; never trust a client-sent deadline or score.

- [ ] **Step 5: Run focused tests to verify GREEN**, then run the existing Phase 1 tests to ensure `lib/predictions.ts` behavior remains compatible.

- [ ] **Step 6: Replace mock dashboard fetching only**: load dashboard DTO from the server/API for authenticated mode and retain an explicitly marked preview path for `NEXT_PUBLIC_DEMO_MODE=true`. Do not redesign unrelated Phase 1 visual components.

No commit is made at this checkpoint.

### Task 6: Add FPL adapter, Bangkok scheduler and idempotent sync

**Files:**
- Create: `lib/fpl/client.ts`
- Create: `lib/fpl/adapter.ts`
- Create: `lib/fpl/sync.ts`
- Create: `lib/scheduler.ts`
- Create: `app/api/sync/fpl/route.ts`
- Create: `scripts/google-apps-script/fpl-sync.gs`
- Create: `tests/domain/scheduler.test.mts`
- Create: `tests/fpl/adapter.test.mts`
- Create: `tests/api/sync-route.test.mts`
- Modify: `.env.example`, `README.md`

**Interfaces:**
- `FplApiClient` exposes `fetchTeams()`, `fetchGameweeks()`, and `fetchFixtures()` returning provider DTOs; it is the only module that knows FPL URLs/payload fields.
- `normalizeFplSnapshot(snapshot): NormalizedSnapshot` maps provider IDs to internal season/team/GW/fixture input and maps provider states to only `scheduled | live | finished | postponed`.
- `selectSyncMode(now: Date, timezone = "Asia/Bangkok", lastWeekdayResultsDate?: string): "results" | "schedule" | null` implements the approved windows; weekend windows cross midnight correctly; weekdays after 06:00 results run once per Bangkok calendar day; Tuesday/Friday after 18:00 select schedule sync.
- `runFplSync(mode, idempotencyKey): Promise<SyncResult>` acquires a database-backed job lock, upserts teams/gameweeks/fixtures by season-scoped provider IDs, records `job_runs`, records gameweek moves, voids affected predictions, reopens target GWs, and triggers only affected recalculation.
- `POST /api/sync/fpl` requires `Authorization: Bearer ${FPL_SYNC_TOKEN}` (or an equivalent constant-time secret comparison), accepts `{ mode, idempotencyKey }`, rejects missing/incorrect token with `401`, and is safe to retry.
- Apps Script stores only `FPL_SYNC_URL`, `FPL_SYNC_TOKEN`, and `TIMEZONE` in Script Properties; it has one ten-minute trigger and never stores Supabase keys or LINE secrets.

- [ ] **Step 1: Write failing scheduler/adapter tests** for Saturday 18:00–Sunday 02:00 results, Sunday 18:00–Monday 02:00 results, weekday once-per-day after 06:00, Tuesday/Friday schedule after 18:00, outside-window no-op, fixture status normalization, provider failure and fixture move detection.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm.cmd run test -- tests/domain/scheduler.test.mts tests/fpl/adapter.test.mts tests/api/sync-route.test.mts`
Expected: FAIL because scheduler, adapter and sync boundary are missing.

- [ ] **Step 3: Implement the pure scheduler and provider adapter**. Parse every provider timestamp into an explicit instant, compare schedule windows using `Intl.DateTimeFormat`/a timezone-safe approach, and never use the server's local timezone implicitly.

- [ ] **Step 4: Implement sync Route Handler and orchestration** with an idempotency key, `job_runs` state transition, database lock, bounded provider timeout, safe error response and no secret logging. A repeated successful idempotency key returns the previous result without duplicating fixtures, history, events, scores or awards.

- [ ] **Step 5: Implement `scripts/google-apps-script/fpl-sync.gs`** with `installTenMinuteTrigger`, `runScheduledSync`, `chooseMode`, and `callSyncEndpoint`; use `Utilities.formatDate(date, "Asia/Bangkok", ...)`, persist weekday result date, and issue a `POST` with bearer token. Include a setup note in `README.md` with exact Script Property names and manual test dates.

- [ ] **Step 6: Run focused tests to verify GREEN**, then run lint. Network/provider integration tests must use captured normalized fixtures or injected fake clients; do not make production FPL calls during unit tests.

No commit is made at this checkpoint.

### Task 7: Implement scoring, postponed/rescheduled handling and recalculation

**Files:**
- Create: `lib/data/jobs.ts`
- Create: `lib/data/scoring.ts`
- Modify: `lib/fpl/sync.ts`, `lib/domain/fixtures.ts`, `lib/domain/scoring.ts`
- Create: `app/api/admin/recalculate/route.ts`
- Test: `tests/data/scoring.test.mts`
- Test: `tests/domain/postponed.test.mts`

**Interfaces:**
- `recalculateGameweek(gameweekId, reason): Promise<RecalculationResult>` loads authoritative fixtures, active predictions and active participants, calls pure `calculateGameweekScoring`, invokes `replace_gameweek_scoring`, and derives season totals by summing included `gameweek_scores` rather than applying deltas.
- `handlePostponedFixture(fixtureId)` marks active predictions voided with event reason `fixture_postponed`, keeps the fixture row, and excludes it from old-GW scoring.
- `handleFixtureGameweekMove(fixtureId, oldGameweekId, newGameweekId)` inserts `fixture_gameweek_history`, voids all active predictions with reason `fixture_rescheduled`, updates the existing fixture identity, reopens the new GW and returns both affected GWs.
- `recalculateGameweek` may create awards only if `canCloseGameweek` is true; all tied max/min users receive separate award rows.
- `POST /api/admin/recalculate` is admin-only, accepts `{ gameweekId }`, and returns only job/result summary.

- [ ] **Step 1: Write failing tests** for a postponed fixture, a fixture moved from GW5 to GW10, a changed finished result, no-finished-fixture no-award, excluded participant, and tied champion/wooden-spoon awards.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm.cmd run test -- tests/data/scoring.test.mts tests/domain/postponed.test.mts`
Expected: FAIL because recalculation and postponed handling are missing.

- [ ] **Step 3: Implement minimal recalculation and event flow**. Replace the entire affected GW scoring snapshot inside the RPC transaction; do not increment existing scores. On every result correction, rebuild old and newly affected GW and verify season aggregation changes accordingly.

- [ ] **Step 4: Run focused tests to verify GREEN**, then query live Supabase with a controlled fixture/rollback-safe verification dataset or existing non-production test rows. Verify active prediction count, void event, history row, score replacement and award tie rows.

- [ ] **Step 5: Run Supabase advisors again** and resolve any RLS, index, function privilege or performance issue before continuing.

No commit is made at this checkpoint.

### Task 8: Implement admin authorization, participant exclusion and admin UI

**Files:**
- Create: `lib/data/admin.ts`
- Create: `app/api/admin/sync/route.ts`
- Create: `app/api/admin/participants/route.ts`
- Create: `app/admin/page.tsx`
- Create: `app/admin/loading.tsx`
- Test: `tests/api/admin-routes.test.mts`
- Modify: `README.md`

**Interfaces:**
- `getAdminOverview(): Promise<AdminOverviewDTO>` returns active season, GW statuses, recent job summaries and participant counts without provider payloads/secrets.
- `setParticipantStatus(input: { userId: string; gameweekId: string; status: "active" | "excluded"; reason?: string })` updates only the participant row, preserves user/prediction/history, and triggers affected scoring rebuild.
- `POST /api/admin/sync` accepts `{ mode: "results" | "schedule" }` and runs a manual sync through the same idempotent orchestration as Apps Script.
- `POST /api/admin/participants` supports exclude/restore for one user/GW and is admin-only.
- `/admin` checks `requireAdmin` in the server page and renders a minimal control surface for results sync, schedule sync, recalculate, GW selection, exclude/restore and job errors. Non-admin receives `403`/not-found behavior without revealing admin data.

- [ ] **Step 1: Write failing route/page tests** for non-admin `403`, admin manual results/schedule sync, excluding a user without deleting history, restoring participation, and excluding one GW from season total.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm.cmd run test -- tests/api/admin-routes.test.mts`
Expected: FAIL because admin DAL/routes/page are missing.

- [ ] **Step 3: Implement admin guards and mutations**. Re-check admin identity inside every Route Handler; a protected page alone is insufficient. Never authorize from a client-sent `isAdmin` flag or display value.

- [ ] **Step 4: Implement the minimal `/admin` server page** using existing visual language only where needed. Keep admin state/actions server-bound and show status/error summaries, not raw secrets.

- [ ] **Step 5: Run focused tests to verify GREEN**, then run lint and build.

No commit is made at this checkpoint.

### Task 9: Integrate the real dashboard flow without unrelated UI redesign

**Files:**
- Modify: `app/components/liff-gate.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/components/prediction-app-final.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css` only if API loading/error states require it
- Test: `tests/dashboard-integration.test.mts`

**Interfaces:**
- The Client Component receives serializable `DashboardDTO` data or fetches only same-origin Route Handlers with the HttpOnly session automatically attached; it never imports `lib/supabase/admin.ts`, `lib/env.ts`, `lib/data/*` or service credentials.
- Prediction selection is optimistic for UX only; the POST response or error from the server is authoritative and can reject a stale/locked fixture.
- Postponed fixtures show a waiting state and cannot be submitted; moved fixtures show an empty new prediction state and require a new prediction.
- Leaderboard season totals and excluded-GW count come from server DTOs, not Phase 1 mock calculations.

- [ ] **Step 1: Write failing integration tests** for loading active season after LIFF auth, rendering server-provided fixtures, saving before kickoff, showing server rejection after kickoff, and refreshing after a sync/recalculation.

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm.cmd run test -- tests/dashboard-integration.test.mts`
Expected: FAIL because the client still uses mock-only state and has no authoritative API flow.

- [ ] **Step 3: Add the smallest API integration**: keep existing tabs, detail modal and share prompt; replace only mock persistence/score labels with DTO/API state and add loading/error/locked/postponed states.

- [ ] **Step 4: Run focused tests to verify GREEN** and manually inspect `/`, `/dashboard`, `/admin` in preview mode and authenticated mode. Confirm no phase-unrelated UI changes appear in the diff.

No commit is made at this checkpoint.

### Task 10: Full verification, live-data audit and documentation handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/project-status.md`
- Test: all existing and new tests

**Interfaces and acceptance checklist:**
- Auth: invalid LIFF tokens never create users/sessions; valid users enter the active season automatically; only exact `ADMIN_LINE_USER_ID` reaches admin routes.
- Security: no secret in frontend bundle, Git diff, `.env.example` values, logs or API DTOs; all business tables have RLS; no browser Supabase writes.
- Predictions: one active prediction per user/fixture; pre-kickoff edit works; kickoff/finished/postponed/excluded requests fail server-side.
- Sync: scheduler windows use Bangkok time; duplicate idempotency key is harmless; schedule/results modes use the same fixture ID; a move creates history and voids old predictions.
- Scoring: correct=3, wrong/unanswered=0; postponed old GW omitted; new GW scores after re-prediction; changed result rebuilds GW/awards/season total; ties receive all awards; no cancelled domain status.
- Admin: manual sync, recalculate, exclude and restore work only for admin; excluded GW remains in history but not season total.

- [ ] **Step 1: Run the complete local verification commands**

Run:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
git status --short --branch
```

Expected: test exit 0 with all tests passing, lint exit 0, build exit 0, diff check has no whitespace errors, and no secret/generated `.next` file is tracked.

- [ ] **Step 2: Verify the real Supabase project before claiming completion**

Use Supabase read-only SQL/MCP checks to confirm active season, gameweek/fixture counts, user/participant counts, prediction status counts, job runs and score/award consistency. Run security and performance advisors and record any remaining warnings honestly.

- [ ] **Step 3: Verify deployment configuration without deploying or pushing**

Check Vercel environment variable names (public vs server-only), Apps Script properties/trigger instructions, FPL endpoint configuration and the absence of Vercel Cron/worker dependencies. Do not copy secret values into files or output.

- [ ] **Step 4: Update `README.md` and `docs/project-status.md`** with routes, env contract, migration/project verification procedure, Apps Script setup, sync windows, admin usage, preview limitation and the exact verification outputs.

- [ ] **Step 5: Stop for user review**. Show the diff, tests/lint/build output and live Supabase verification summary. Do not commit or push in this plan execution until the user explicitly approves.

## Self-review against the approved design

- Identity/session and active-season auto-join: Tasks 1 and 4.
- Season-aware schema, all required tables, constraints and RLS: Task 2.
- Server-only Supabase access and DTO boundaries: Tasks 1, 5 and 9.
- Prediction lock, active uniqueness and audit events: Tasks 3 and 5.
- Scoring/recalculation, awards, ties and season aggregation: Tasks 3 and 7.
- Postponed/rescheduled fixture rules and no permanent cancellation: Tasks 3, 6 and 7.
- FPL results/schedule sync and external ten-minute scheduler: Task 6.
- Admin identity, manual sync, recalculate and participant exclusion: Task 8.
- Current Bangkok display/time handling: Tasks 2, 3, 6 and 9.
- Live Supabase verification, security advisors and final evidence: Tasks 2, 7 and 10.
- No unrelated Phase 1 UI redesign, no premature commit/push and Windows npm commands: Global Constraints and Tasks 9–10.
