# Fantasy League Expansion Design

Date: 2026-08-21
Status: Design approved in conversation; written-spec review pending

## Summary

ขยาย Fantasy App ให้รองรับ FPL Classic League แบบ dynamic โดยเริ่มต้นด้วย:

- เชยเชย Cup — League ID 819498
- เขาค้อ inLove — League ID 819502

ระบบจะจัดอันดับตามสมาชิกของลีก ไม่ใช่เฉพาะผู้ใช้ที่มี LINE mapping โดยแยก League Domain ออกจาก fantasy_entry_mappings เดิม

## Locked Decisions

- ผู้ใช้ FPL Entry เดียวสามารถอยู่ได้หลายลีก
- ผู้ใช้ LINE หนึ่งคนสามารถ mapping กับ Entry เดียวที่อยู่หลายลีกได้
- Entry เดียวที่อยู่หลายลีกจะแสดงเป็นรายการเดียวใน Admin พร้อมป้ายชื่อทุกลีก
- หน้า Fantasy ต้องให้ผู้ใช้เลือกลีกก่อนแสดงอันดับ
- ค่าเริ่มต้นหลังเลือกลีกคืออันดับ Gameweek ปัจจุบัน
- อันดับมี 2 แท็บ: Gameweek ที่เลือก และ ทั้งฤดูกาล
- สถิตินักเตะเป็นข้อมูลรวมจาก FPL ไม่ขึ้นกับลีกที่เลือก
- Leaderboard แสดงสมาชิก FPL ทุกคน แม้ยังไม่ได้ Mapping
- Unmapped member แสดง FPL team name และ manager name
- Mapped member แสดง LINE profile ร่วมกับข้อมูล FPL
- อันดับเสมอใช้ competition ranking เช่น 1, 1, 3
- อันดับย้อนหลังใช้ membership snapshot ของลีก ณ Gameweek นั้น
- ลีกที่ Archive แล้วเลือกดูอันดับย้อนหลังได้ แต่ไม่อยู่ในอันดับปัจจุบัน
- Admin ใช้ชื่อทางการจาก FPL API เท่านั้น ไม่แก้ชื่อลีกเอง
- Admin เพิ่ม/แก้ League ID, เพิ่มลีก และ Archive ลีกได้
- การเพิ่ม/แก้ League ID ต้อง validate กับ FPL API ก่อนบันทึก
- ปุ่มเดียว Sync Fantasy ทำสมาชิก, คะแนน และ player snapshot ของทุกลีก active
- Sync รวมทุกลีกและทุก Entry แบบ all-or-nothing
- ถ้าลีกหรือ Entry ใดล้มเหลว ให้ rollback ทั้งชุดและคง snapshot ล่าสุดที่สำเร็จ
- Sync Entry ซ้ำจากหลายลีกเพียงครั้งเดียว
- Sync ซ้ำใน GW เดิมเป็น upsert; GW ใหม่สร้าง snapshot ใหม่
- Award เลือก Champion/Wooden spoon ได้จากสมาชิก FPL ทุกคน แม้ไม่มี Mapping
- ลีกเริ่มต้นถูก seed จากสอง League ID และชื่อ bootstrap ที่ระบุข้างต้น; Sync ครั้งแรกจะ validate และ overwrite ด้วยชื่อทางการจาก FPL API

## Architecture

### League Domain

เพิ่ม bounded domain สำหรับ league configuration, league membership snapshots, entry score snapshots และ league-specific awards

fantasy_entry_mappings เดิมยังคงเป็นความสัมพันธ์เสริมระหว่าง app_users กับ FPL Entry เท่านั้น ไม่ใช้เป็นแหล่งสมาชิกลีกอีกต่อไป

### Existing Fantasy Domain

ตาราง Fantasy เดิมไม่ถูกลบทันที เพื่อรักษาข้อมูลและ rollback safety การจัดอันดับใหม่จะใช้ League Domain เป็นหลัก ส่วนข้อมูลเดิมจะยังอ่านได้ระหว่าง migration/backfill และสามารถเก็บไว้เป็น compatibility history

## Database Design

### fantasy_leagues

- id uuid primary key
- season_id uuid foreign key
- fpl_league_id bigint not null
- official_name text not null
- status text: active or archived
- last_synced_at timestamptz nullable
- last_sync_status text nullable
- last_error_message text nullable
- archived_at, created_at, updated_at

Unique key: season_id + fpl_league_id

### fantasy_league_membership_snapshots

- id uuid primary key
- season_id uuid foreign key
- league_id uuid foreign key
- gameweek_id uuid foreign key
- fpl_entry_id bigint not null
- fpl_team_name text not null
- fpl_manager_name text not null
- source_synced_at, created_at, updated_at

Unique key: season_id + league_id + gameweek_id + fpl_entry_id

An Entry in two leagues has two rows with the same Entry ID and different league IDs.

### fantasy_entry_gameweek_scores

- id uuid primary key
- season_id uuid foreign key
- gameweek_id uuid foreign key
- fpl_entry_id bigint not null
- fpl_team_name, fpl_manager_name
- points
- event_transfers, event_transfers_cost, points_on_bench
- source_synced_at, created_at, updated_at

Unique key: season_id + gameweek_id + fpl_entry_id

This table is independent of LINE mapping, so one score snapshot serves every league containing the Entry.

### fantasy_league_awards

- id uuid primary key
- season_id uuid foreign key
- league_id uuid foreign key
- gameweek_id uuid foreign key
- fpl_entry_id bigint not null
- award: champion or wooden_spoon
- selected_by, created_at, updated_at

Unique key: season_id + league_id + gameweek_id + fpl_entry_id + award

Awards use Entry ID instead of mapping ID so unmapped members can be selected.

### Security and indexes

- RLS is enabled on every new table.
- Browser roles receive no direct table access; server/service role is the only data path.
- Indexes cover active league lookup, league/Gameweek membership, Entry/Gameweek scores, and awards.
- Existing tables and data are not dropped.

## Sync Data Flow

1. Require admin access and load all active leagues for the active season.
2. Fetch every page of every FPL Classic League standings endpoint.
3. Validate League IDs and official names.
4. Resolve the target Gameweek from FPL current/next/finished fallback and the local Gameweek catalog.
5. Build membership snapshots for all active leagues.
6. Deduplicate Entry IDs across leagues.
7. Fetch each unique Entry history once, with bounded concurrency.
8. Fetch bootstrap-static once for all player snapshots.
9. Validate every league and Entry result before writing.
10. Call one database RPC/transaction to upsert memberships, scores, players, sync status, and job result.
11. On any failure, rollback the complete new payload and keep the last successful snapshot.

Repeated syncs for the same Gameweek update the same snapshot keys. A new Gameweek creates a new membership and score snapshot without changing previous Gameweeks.

## API Design

### User API

GET /api/fantasy?league=leagueId&gameweek=gameweekNumber&mode=gameweek|season

Response includes active and archived leagues, selected league and Gameweek metadata, current Gameweek, both leaderboards, mapped/unmapped display identity, selected-league awards, global FPL player statistics, and last successful sync/stale state.

The league parameter is required for leaderboard data. Player statistics remain global FPL data.

### Admin API

- GET /api/admin/fantasy/leagues
- POST /api/admin/fantasy/leagues
- PATCH /api/admin/fantasy/leagues/:id
- POST /api/admin/fantasy/leagues/:id/archive
- GET /api/admin/fantasy/mappings
- POST /api/admin/fantasy/mappings
- POST /api/admin/fantasy/sync
- PUT /api/admin/fantasy/awards

League creation/update validates against FPL before persistence and stores the official API name. Mapping options contain only unmapped Entry IDs, deduplicated across active leagues, with all league badges attached.

## UI Flow

### User Fantasy page

1. Show a league selector before leaderboard content.
2. Permit active leagues and archived leagues for historical viewing.
3. After selection, open current-GW leaderboard.
4. Provide Gameweek selector and the existing GW ปัจจุบัน button.
5. Provide Gameweek ที่เลือก and ทั้งฤดูกาล tabs.
6. Show all league members, mapped or unmapped.
7. Keep player statistics global and independent of league selection.

### Admin page

- Manage active/archived league IDs.
- Show official FPL league name and validation/sync status.
- Use one Sync Fantasy button for all active leagues, members, scores, and players.
- Provide LINE user selector and a dropdown of unmapped Entries.
- Display one Entry once with all league badges.
- Select awards by league, Gameweek, and any FPL Entry.

## Ranking Rules

- Gameweek tab sorts by that Gameweek's points descending.
- Season tab sorts by sum of stored FPL points through the selected/current Gameweek descending.
- Missing score rows are treated as zero but the member remains in the ranking.
- Membership is determined by the league snapshot at the selected Gameweek.
- Ties use competition ranking: 1, 1, 3.
- Mapping status does not determine leaderboard eligibility.
- Archived leagues are excluded from current active selection but remain available for historical selection.

## Error Handling

- Invalid/private/unavailable League ID: reject add/update and preserve old configuration.
- Any league pagination failure: fail the complete sync.
- Any Entry history failure: fail the complete sync.
- FPL timeout, rate limit, or malformed response: preserve last successful snapshots.
- Concurrent Sync runs are blocked by a database lock and idempotency key.
- Client receives safe Thai user-facing errors without secrets or internal stack traces.

## Testing Strategy

TDD tests must cover:

- League API pagination and official name validation.
- Duplicate Entry deduplication across leagues.
- Membership snapshot same-GW upsert and new-GW append.
- All members appearing without Mapping.
- Mapped and unmapped display models.
- Gameweek/season ranking and competition ties.
- Archived league historical ranking.
- Awards for unmapped Entries.
- Atomic rollback when any league or Entry fails.
- Sync idempotency and last-success preservation.
- Existing Fantasy and prediction behavior regression.

Verification before completion:

    npm.cmd run test
    npm.cmd run lint
    npm.cmd run build
    git diff --check

Development uses fake providers and test fixtures. No production data is modified during implementation. Supabase migration and production deployment occur only after design and implementation-plan approval.

## Scope Review

- No unresolved work marker remains.
- Dynamic league naming is resolved: official FPL name only.
- Mapping and league membership are explicitly separate.
- All-or-nothing sync applies to every active league and every Entry.
- Archived history and current ranking rules do not conflict.
- Player statistics are explicitly global, not league-filtered.
- No unrelated refactor is included.
