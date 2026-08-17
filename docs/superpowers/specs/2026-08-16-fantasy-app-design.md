# FPL Fantasy App Design

Date: 2026-08-16
Status: Design sections approved; written-spec review pending

## Summary

เพิ่ม Fantasy App ที่ `/fantasy` เป็นเมนูที่ 2 ของ Landing Page โดยแยก bounded domain ออกจากระบบทายผลพรีเมียร์ลีก ใช้ LINE LIFF authentication และ `app_users` เดิมร่วมกัน แต่มีตาราง, service, API และ scoring data ของ Fantasy แยกทั้งหมด

Fantasy เป็น read-only analytics สำหรับสมาชิกในกลุ่ม ไม่ใช่เกมจัดทีมใหม่ในระบบของเรา ผู้ใช้ดู leaderboard และสถิตินักเตะได้ ส่วน admin เป็นผู้ผูก LINE user กับ FPL Entry, สั่ง sync และเลือก champion/wooden spoon

FPL เป็น source of truth สำหรับข้อมูลทีมและนักเตะ ข้อมูลทีมใช้ `entry_history.points` ราย GW โดยไม่หัก `event_transfers_cost`; season total คำนวณใหม่จากผลรวมคะแนนราย GW ที่เก็บในระบบของเรา

## Locked Decisions

- Route หลักคือ `/fantasy` และเชื่อมจากเมนูที่ 2 บน `/`
- ผู้ใช้ LINE ที่ login แล้วทุกคนดู Fantasy แบบ read-only ได้
- ใช้ auth/session และ `app_users` เดิม; ไม่สร้าง auth flow ใหม่
- Fantasy แยกจาก `predictions`, `prediction_events`, `gameweek_scores` และ prediction scoring engine
- รองรับฤดูกาลปัจจุบันเท่านั้นใน MVP แต่ทุก Fantasy row ต้องมี `season_id`
- Admin ใช้ `/admin` เดิมและสิทธิ์ `requireAdmin()` เดิม
- หนึ่ง LINE user มี active FPL Entry ได้หนึ่งทีมต่อ season
- Entry เดิมเมื่อถูกเปลี่ยนจะถูก archive; mapping และคะแนนเก่ายังคงอยู่ และไม่รวมกับ Entry ใหม่
- การผูก Entry ใหม่จะ backfill ตั้งแต่ GW1 ถึง current GW
- ชื่อและ avatar ที่แสดงใช้ข้อมูลล่าสุดจาก LINE `app_users`
- คะแนนทีมใช้ `entry_history.points` โดยเก็บ transfer count/cost ไว้ประกอบ แต่ไม่หัก cost
- season total คำนวณใหม่จากคะแนนราย GW ทุกครั้งที่ sync
- current GW ใช้ FPL event ที่ `is_current`; ถ้าไม่มีให้ใช้ GW ล่าสุดที่ `finished`
- Sync ทำโดย admin กดเองเท่านั้น ครอบคลุม GW1–current GW และข้อมูลนักเตะ
- Sync ล้มเหลวให้คง snapshot ล่าสุดและแสดง stale status
- ผู้เล่นที่ไม่มีข้อมูลคะแนน GW ให้ถือเป็น 0 และอยู่ใน leaderboard
- player statistics แสดง current GW เท่านั้น
- สถิตินักเตะแบ่ง GK, DEF, MID, FWD
- เก็บ player snapshot ทุกคน ไม่กรองเหลือเฉพาะ top 5
- selected ใช้ `selected_by_percent` ระดับ FPL
- transfers ใช้ `transfers_in_event` และ `transfers_out_event` ระดับ FPL
- form ใช้ field `form` จาก FPL
- captain/vice-captain MVP แสดงอันดับ 1 จาก `most_captained`/`most_vice_captained` เพราะไม่มี top 5 global มาตรฐานใน endpoint หลัก
- หาก top 5 เสมอ ให้แสดงทุกคนที่มีค่าเท่ากัน
- champion/wooden spoon ให้ admin เลือกได้หลายคนต่อ GW และแก้ไขย้อนหลังได้
- กรณี postponed, cancelled หรือ fixture ถูกเลื่อน ให้ยึดคะแนน/สถานะล่าสุดจาก FPL ไม่คำนวณ fixture เอง
- UI ใช้ visual language, สี, ปุ่ม, spacing, navigation และปุ่ม `GW ปัจจุบัน` ให้สอดคล้องกับ Prediction App เดิม

## Scope

### MVP

- Landing link และ `/fantasy`
- Fantasy API สำหรับ leaderboard, awards, player statistics และ sync status
- Fantasy mapping ใน `/admin`
- Manual FPL sync และ backfill
- คะแนนราย GW, season total และ historical GW leaderboard
- champion/wooden spoon ที่ admin เลือกเอง
- current-GW player statistics
- stale/error handling
- automated tests และ regression checks สำหรับ prediction domain

### Out of scope

- การจัดทีม, budget, transfer หรือ captain ในแอปของเรา
- การแสดง squad ราย GW ของแต่ละ Entry
- หลายฤดูกาลใน UI เดียวกัน
- automatic scheduler sync
- top 5 captain/vice ระดับ FPL global หากไม่มี public data source ที่เชื่อถือได้
- การคำนวณคะแนน fixture/player เอง
- การสร้าง role admin ใหม่

## Architecture and Boundaries

### User surface

- `app/fantasy/page.tsx` เป็น route หลักและใช้ `LiffProvider` เดิม
- อ่านข้อมูลผ่าน `/api/fantasy`
- browser ไม่เรียก FPL API หรือ Supabase โดยตรง
- navigation จาก Fantasy ไป `/dashboard` และกลับ `/`

### Admin surface

เพิ่ม Fantasy section ใน `/admin` เดิมสำหรับ:

- รายการ active/archived mappings
- เพิ่ม mapping ด้วย LINE user + FPL Entry ID
- ตรวจสอบชื่อทีมและ manager จาก FPL ก่อนยืนยัน
- replace/archive mapping
- ปุ่ม Fantasy Sync
- sync status, last success, stale/error details
- จัดการ champion/wooden spoon ราย GW

### Server boundary

- FPL client อยู่ใน `lib` ฝั่ง server-only
- Fantasy data service เป็นโมดูลแยกจาก prediction data service
- user routes เรียก `requireUser()`
- admin routes เรียก `requireAdmin()`
- Supabase service client ใช้ server-only secret เดิมเท่านั้น

## Database Design

### `fantasy_entry_mappings`

เก็บความสัมพันธ์ระหว่างผู้ใช้กับ FPL Entry ต่อ season

- `id` primary key
- `season_id` foreign key ไป `seasons`
- `app_user_id` foreign key ไป `app_users`
- `fpl_entry_id` external FPL Entry ID
- `fpl_team_name`, `fpl_manager_name`
- `mapping_status`: `active` หรือ `archived`
- `last_validation_status`: `valid` หรือ `error`
- `last_error_message`
- `linked_at`, `archived_at`, `created_at`, `updated_at`

Constraints:

- active mapping หนึ่งรายการต่อ `(season_id, app_user_id)`
- FPL Entry เดียวกันห้ามมี active mapping ซ้ำใน season เดียวกัน
- archive/replace ห้ามลบ score snapshot เดิม

### `fantasy_gameweek_scores`

เก็บคะแนนทีมราย GW จาก FPL

- `id` primary key
- `season_id`
- `mapping_id`
- `gameweek_id`
- `points`: ค่า `entry_history.points`
- `event_transfers`
- `event_transfers_cost`
- `points_on_bench`
- `source_synced_at`, `created_at`, `updated_at`

Unique key: `(mapping_id, gameweek_id)`

`total_points` ของ FPL จะไม่ถูกใช้เป็น season total หลัก

### `fantasy_player_gameweek_stats`

เก็บนักเตะทั้งหมดเป็น snapshot ต่อ season/GW/player ไม่ใช่เฉพาะ top 5

- `season_id`
- `gameweek_id`
- `fpl_player_id`
- `player_name`
- `position`
- `club_id`, `club_name`
- `status`
- `selected_by_percent`
- `transfers_in_event`, `transfers_out_event`
- `form`
- `source_synced_at`, `created_at`, `updated_at`

Unique key: `(season_id, gameweek_id, fpl_player_id)`

นักเตะ unavailable/excluded จะยังถูกเก็บไว้ใน snapshot แต่ไม่เข้า current-GW ranking ตามสถานะที่ FPL ระบุว่าเลือกไม่ได้ นักเตะที่ย้ายสโมสรจะใช้ club/position ตาม snapshot ของ GW นั้น

### `fantasy_awards`

เก็บ award ที่ admin เลือก

- `id` primary key
- `season_id`
- `gameweek_id`
- `mapping_id`
- `award`: `champion` หรือ `wooden_spoon`
- `selected_by`, `created_at`, `updated_at`

รองรับหลาย mapping ต่อ `(season_id, gameweek_id, award)` และแก้ไขรายชื่อได้โดย replace ชุด award ของ GW นั้นใน transaction เดียว

### `job_runs`

reuse ตาราง operational log เดิม โดยใช้ `job_type = fantasy_sync` แยกจาก fixture/result sync และเก็บ:

- run status
- จำนวน mapping/player/score ที่ประมวลผล
- เวลาเริ่ม/จบ
- error code และ allow-listed details
- failed mappings และ stale scope

ตารางใหม่ทั้งหมดต้องเปิด RLS และไม่เปิด browser access โดยตรง

## Sync Data Flow

1. ตรวจ admin session และ active season
2. สร้าง `job_runs` ของ `fantasy_sync` และ acquire sync lock
3. โหลด active mappings ทั้งหมด รวม mapping ที่ validation ล่าสุดเป็น error เพื่อพยายามตรวจซ้ำ
4. เรียก `entry/{entry_id}/history/` แบบ server-side โดยจำกัด concurrency ไม่เกิน 4 requests
5. แปลงทุก `entry_history` row ตั้งแต่ GW1 ถึง current GW เป็น `fantasy_gameweek_scores`
6. เรียก `bootstrap-static/` หนึ่งครั้งเพื่ออ่าน events, players, positions, clubs, selected, transfer counts, form และ global captain/vice IDs
7. ระบุ current GW จาก `is_current`; หากไม่มี ใช้ GW ล่าสุดที่ `finished`
8. แปลงนักเตะทั้งหมดเป็น player snapshot ของ GW นั้น และ upsert ด้วย unique key
9. เขียน valid mapping/snapshot ใน database transaction หรือ RPC เดียวต่อ sync phase
10. คำนวณ season total ใหม่จาก `fantasy_gameweek_scores` ของแต่ละ mapping
11. บันทึก run result และ release lock

Sync ซ้ำใน GW เดิมจะ update rows เดิม ไม่สร้าง duplicate rows หากเป็น GW ใหม่จะสร้าง snapshot ชุดใหม่ตาม unique key

กรณี Entry ใดล้มเหลว ให้เก็บข้อมูลเดิมของ Entry นั้นและ mark validation error; mapping อื่นที่สำเร็จยัง sync ได้ และ run details ต้องระบุ partial failure อย่างชัดเจน กรณี player bootstrap ล้มเหลวจะไม่ replace player snapshot เดิม

## API Contracts

### User

`GET /api/fantasy`

`GET /api/fantasy?gameweek=<number>`

ถ้าไม่ส่ง gameweek ให้ใช้ current GW สำหรับ leaderboard

Response ต้องมี:

- season metadata
- `currentGameweek`
- `selectedLeaderboardGameweek`
- sync status, `lastSyncedAt`, `stale`, stale message
- GW leaderboard และ season leaderboard
- latest LINE display name/avatar และ FPL team name
- awards ของ selected GW
- current-GW player stat groups
- FPL captain/vice rank 1

query `gameweek` มีผลกับ leaderboard/awards เท่านั้น player statistics ยังเป็น current GW

### Admin

- `GET /api/admin/fantasy/mappings`
- `POST /api/admin/fantasy/mappings`
- `POST /api/admin/fantasy/mappings/:id/replace`
- `POST /api/admin/fantasy/mappings/:id/archive`
- `POST /api/admin/fantasy/sync`
- `GET /api/admin/fantasy/sync`
- `GET /api/admin/fantasy/awards?gameweek=<number>`
- `PUT /api/admin/fantasy/awards`

Mapping create/replace ต้อง validate FPL Entry ก่อน commit และ reject duplicate active mapping

Awards PUT รับ mapping IDs แยกตาม `champion`/`wooden_spoon` และ replace รายชื่อ award ของ GW เดียวกันแบบ atomic

## UI Flow

หน้า `/fantasy` ใช้โครงแบบ mobile-first และ 2 tabs:

### อันดับ

- เปิดที่ current GW
- gameweek selector สำหรับดูย้อนหลัง
- ปุ่ม `GW ปัจจุบัน` ที่ทำงานเหมือน Prediction App เพื่อกลับ current GW
- toggle คะแนน GW / คะแนนรวมฤดูกาล
- แสดง rank, LINE name, FPL team name, points
- แสดง champion/wooden spoon ของ GW ที่เลือก

### สถิตินักเตะ

แสดง current GW เท่านั้น โดยแบ่ง GK/DEF/MID/FWD และมี sections:

- selected percentage top 5
- transfer in top 5
- transfer out top 5
- form top 5
- captain อันดับ 1
- vice-captain อันดับ 1

ทุกสี, button treatment, card, spacing, icon และ navigation ต้อง reuse visual language ของ Prediction App เดิม

Stale banner ต้องแสดงเวลา sync ล่าสุดและยังให้ผู้ใช้ดู snapshot เดิมได้

## Ranking and Historical Rules

- GW leaderboard sort ตาม `points` descending
- season leaderboard sort ตามผลรวม `points` descending
- missing score row ถือเป็น 0 และยังอยู่ใน leaderboard
- archived mapping แสดงใน GW ที่มี snapshot ของ mapping นั้น และแสดงชื่อทีมเก่าว่า archived
- replacement Entry เป็นคนละ leaderboard row และไม่รวมคะแนน
- latest LINE profile data ใช้แสดงทั้ง current และ historical rows
- player stat tie ที่อันดับ 5 แสดงทุกคนที่ค่าเท่ากัน
- awards ไม่คำนวณอัตโนมัติ; admin เป็นผู้เลือกและแก้ไขเอง

## Error Handling and Security

- unauthenticated user: 401
- non-admin on admin routes: 403
- invalid Entry: ไม่บันทึก mapping
- FPL timeout/rate limit: คง snapshot ล่าสุดและ mark stale
- duplicate sync: blocked by lock และ unique keys
- partial mapping failure: คงข้อมูลเก่าของ mapping ที่ล้มเหลวและรายงาน failed mappings
- no mapping: แสดง empty state สำหรับผู้ใช้ทั่วไป
- ไม่มี current GW: ใช้ latest finished GW
- ห้ามเปิด service key, session secret, admin ID หรือ sync token ฝั่ง client
- policy ของทุกตารางต้องมี RLS และไม่ grant browser direct access
- authorization data ยึด server session/app user ไม่ใช้ user-editable metadata

## Testing Strategy

ใช้ TDD ก่อน implementation โดยเริ่มจาก failing tests ของ pure domain functions และ route handlers

### Unit tests

- parse/normalize `entry_history`
- season total ที่ไม่หัก transfer cost
- current-GW fallback
- ranking และ missing score = 0
- top 5 per position และ tie expansion
- excluded/transferred player snapshot behavior
- mapping uniqueness/archive/replace rules
- awards หลายคนและ edit behavior
- stale/partial sync result

### API/integration tests

- user/admin auth guards
- mapping validation กับ fake FPL provider
- sync idempotency
- repeated same-GW sync ไม่เพิ่ม duplicate
- different-GW sync สร้าง snapshot เพิ่ม
- invalid Entry ไม่ลบข้อมูลเก่า
- player bootstrap failure preserves previous snapshot
- Fantasy routes ไม่เปลี่ยน prediction route behavior

### Verification

ก่อนสรุป implementation ว่าเสร็จต้องรัน:

```text
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
```

ต้องตรวจ mobile/LIFF flow ของ `/fantasy`, navigation, current-GW button, stale state และ admin flow เพิ่มเติม

## Rollout Constraints

- ช่วง implementation ใช้ fake provider, test fixtures และ test database/transaction rollback
- ห้ามแก้ production data ระหว่างพัฒนาและทดสอบ
- migration ต้องตรวจ RLS, constraints, indexes และ privileges แบบ read-only ก่อน apply จริง
- ห้าม commit/push จนกว่าจะได้รับอนุมัติอย่างชัดเจนจากผู้ใช้
- ต้อง preserve unrelated working-tree changes ที่มีอยู่ก่อนเริ่มงาน

## External Data Reference

- FPL API endpoint reference: https://www.postman.com/fplassist/fpl-assist/documentation/zqlmv01/fantasy-premier-league-api?entity=request-24075535-b07d68f6-a8eb-4e9d-92a5-362677a4641e
- FPL data reference: https://james-leslie.github.io/fplstat/data-reference/
