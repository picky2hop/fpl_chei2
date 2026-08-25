# Fantasy Score Recalculation and Sync Separation Design

**Status:** Design ready for review
**Date:** 2026-08-25

## Goal

เปลี่ยนการบันทึกคะแนน Fantasy ในตาราง `fantasy_entry_gameweek_scores` ให้ใช้คะแนนนักเตะตัวจริงลำดับที่ 1–11 รวมคะแนนกัปตันอีก 1 เท่า, รองรับการคำนวณคะแนนเก่าจากหน้า Admin และแยกการ Sync คะแนนออกจากการ Sync สถิตินักเตะ โดยไม่แตะระบบคะแนน Fantasy แบบเก่าใน `fantasy_gameweek_scores`.

## Approved decisions

- ใช้แนวทาง A: ขยายตารางคะแนน Fantasy หลายลีกเดิม
- ตัวจริงคือ `pickPosition` 1–11 จาก FPL Picks API
- คะแนนรวมคือผลรวมคะแนนดิบของ 11 คน + คะแนนดิบกัปตันอีก 1 เท่า
- ไม่รวมตัวสำรอง และไม่ใช้ `multiplier` เป็นตัวตัดสินตัวจริง
- Picks API ล้มเหลว: ไม่สร้าง/เขียนทับคะแนน และไม่ใช้ History เป็น fallback
- คะแนนเก่าถูกคำนวณใหม่ครั้งแรกผ่านปุ่ม Admin แยก
- Sync ปกติคำนวณ GW ปัจจุบันและ GW ที่ยังไม่มีคะแนนสูตรใหม่
- เพิ่ม `calculation_method` เพื่อแยก `legacy_fpl_history` กับ `starting_xi_captain_v1`
- เก็บเฉพาะคะแนนรวมต่อ Entry/GW ไม่เก็บ JSON รายชื่อนักเตะย้อนหลัง
- เก็บ transfer/bench metadata จาก FPL History เหมือนเดิม แต่ไม่ใช้คำนวณ `points`
- ปรับเฉพาะ `fantasy_entry_gameweek_scores`; ไม่เปลี่ยน `fantasy_gameweek_scores`
- Admin มี `Sync Fantasy Scores`, `Sync Player Statistics`, `Recalculate Fantasy Scores`
- Sync คะแนนยังคง Sync สมาชิกทุกลีกพร้อมกัน
- Sync Player Statistics ซิงก์เฉพาะ GW ปัจจุบัน
- Partial success: บันทึกเฉพาะผลสำเร็จ และแสดงรายการ Entry/GW ที่ล้มเหลว

## Current state

หน้าปัจจุบันใช้ `runFantasyLeagueSync` และอ่านคะแนนจาก `fantasy_entry_gameweek_scores`. Service ใช้ `event.points` จาก Entry History และอาจแทนคะแนน GW ปัจจุบันด้วย `eventTotal` จาก League Standings. ข้อมูลสถิตินักเตะถูกเขียนพร้อมกับ Sync ลีกผ่าน `apply_fantasy_league_sync`.

ระบบมี `getEntryPicks(entryId, gameweekNumber)` อยู่แล้วสำหรับ Popup ทีม แต่ Snapshot ทีมเก็บเฉพาะ GW ปัจจุบันและเขียนทับเมื่อขึ้น GW ใหม่ จึงไม่ใช้เป็นแหล่งย้อนหลัง. การคำนวณย้อนหลังจะเรียก Picks API ต่อ Entry/GW แล้วเก็บเฉพาะผลรวม.

## Architecture

### Score calculator

เพิ่ม pure function สำหรับรับ picks ที่ normalize แล้วและคืนผลลัพธ์ `points`, `captainPlayerId` และ `calculationMethod = starting_xi_captain_v1`.

Validation:

- ต้องมี picks ครบ 15 รายการ
- `pickPosition` ต้องครบ 1–15 และไม่ซ้ำ
- ตัวจริงคือ picks 1–11 เท่านั้น
- ตัวจริงทุกคนต้องมีคะแนนเป็นตัวเลข; `null` คือ failure
- ต้องพบกัปตันในตัวจริงหนึ่งคน
- สูตรคือ `sum(starters.points) + captain.points`
- ตัวสำรองและ transfer cost ไม่อยู่ในสูตร

### Sync Fantasy Scores

1. อ่าน Bootstrap, active leagues และสมาชิกทุกลีก
2. Deduplicate สมาชิกตาม FPL Entry ID
3. อ่าน Entry History เพื่อหา GW และเก็บ transfer/bench metadata
4. อ่าน score rows พร้อม `calculation_method`
5. สร้าง target จาก GW ปัจจุบัน, GW ที่ไม่มี row และ row ที่ยังเป็น legacy
6. เรียก Picks API ต่อ Entry/GW ด้วย concurrency limit
7. คำนวณด้วย pure function
8. สร้าง score row เฉพาะผลที่ผ่าน validation
9. ข้าม Entry/GW ที่ล้มเหลว โดยคง row เดิมไว้
10. เขียน leagues, memberships และ scores ใน transaction/RPC เดียว โดยส่ง `p_players = []`
11. คืนจำนวนสำเร็จและรายละเอียด failure

League/member stage ยังคงเป็น all-or-nothing ตามระบบเดิม. Partial success ใช้เฉพาะระดับ Entry/GW หลัง stage นี้ผ่านแล้ว.

### Recalculate Fantasy Scores

1. อ่าน active season, active league members, score rows และ Entry History
2. เลือกเฉพาะ legacy rows หรือคู่ Entry/GW ที่ยังไม่มี row
3. ดึง Picks API และใช้ calculator เดียวกัน
4. Upsert ผลสำเร็จเป็น `starting_xi_captain_v1`
5. คง legacy row เดิมเมื่อดึง Picks หรือ validation ล้มเหลว
6. คืน report จำนวน target, สำเร็จ, ข้าม และล้มเหลวพร้อม Entry/GW

การกดซ้ำจะข้าม rows ที่เป็นสูตรใหม่.

### Sync Player Statistics

ใช้ service/RPC แยก: อ่าน Bootstrap หนึ่งครั้ง, เลือก GW ปัจจุบัน, normalize players และเขียนเฉพาะ `fantasy_player_gameweek_stats`. ไม่อ่านสมาชิกลีก, Entry History หรือ Picks API และใช้ feedback/job แยกจาก score sync.

## Database design

เพิ่มคอลัมน์ใน `public.fantasy_entry_gameweek_scores`: `calculation_method text not null default 'legacy_fpl_history' check (calculation_method in ('legacy_fpl_history', 'starting_xi_captain_v1'))`.

ผลกระทบ:

- rows เดิมเป็น legacy โดยไม่เปลี่ยน `points` ทันที
- rows ที่คำนวณใหม่สำเร็จเป็นสูตรใหม่
- ไม่มี row ต่อนักเตะ จึงไม่เพิ่มขนาดฐานข้อมูล 11 เท่า

ปรับ `apply_fantasy_league_sync` ให้รับ method ใน `p_scores`; score sync ส่ง players ว่าง. เพิ่ม RPC สำหรับ player-stat-only และ score-only recalculation เพื่อแยกขอบเขตชัดเจน. RPC ใช้ `security invoker`, ตรวจ JSON shape และ advisory transaction lock ตาม pattern เดิม.

ตารางยังคง server-only: เปิด RLS, revoke `anon`/`authenticated`, grant เฉพาะ `service_role`.

ปรับ TypeScript:

- `FantasyGameweekScoreInsert` เพิ่ม `calculation_method`
- DB generated types เพิ่ม column/RPC signatures
- repository เพิ่มการอ่าน score method และ write methods สำหรับ score-only/player-stat-only
- dashboard อ่าน method ได้สำหรับ diagnostics แต่ leaderboard ยังคงใช้ `points`

## Admin UI and API

แยก loading state และ feedback ของ 3 ปุ่ม:

- `Sync Fantasy Scores`: สมาชิกลีก + คะแนน
- `Sync Player Statistics`: สถิตินักเตะ GW ปัจจุบันเท่านั้น
- `Recalculate Fantasy Scores`: legacy/missing rows เท่านั้น

คง route score sync เดิมเพื่อ compatibility และเพิ่ม route สำหรับ player stats กับ recalculation. ทุก route เรียก `requireAdmin()` และส่งกลับเฉพาะ safe messages ไม่ส่ง secret หรือ upstream response body.

Feedback Popup ต้องแสดงจำนวนสำเร็จ/ล้มเหลว และรายการ Entry/GW ที่คำนวณไม่ได้. ห้ามบันทึก 0 และห้ามใช้ History/League Standings เป็น fallback ของสูตรใหม่.

## Testing strategy

ใช้ TDD ก่อน production code:

1. Calculator: รวม 11 ตัวจริง, กัปตันเพิ่มหนึ่งเท่า, ไม่รวม bench, รองรับติดลบ, reject picks ไม่ครบ/ซ้ำ/captain หาย/null
2. Normalizer/rows: legacy method จาก History และ new method จาก calculator; metadata เดิมยังอยู่
3. Score sync: เรียก Picks เฉพาะ current/missing/legacy, ไม่เรียกซ้ำสูตรใหม่, partial failure และ league-stage rollback
4. Recalculate: ประมวลผล legacy, ข้ามสูตรใหม่, คง old row เมื่อ failure
5. Separation: stats sync ไม่เขียน scores และ score sync ไม่เขียน player stats
6. Route/UI: endpoint ถูกตัว, Admin guard และ Feedback Popup
7. SQL: column/default/check, RLS/grants และ RPC mapping

ก่อนสรุปงานต้องรัน `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build` และ `git diff --check`.

## Rollout and safety

1. เพิ่ม migration โดย default rows เดิมเป็น legacy
2. Deploy code ที่รองรับ column และปุ่มใหม่
3. ตรวจว่า Sync Scores ไม่เขียน player stats
4. กด Recalculate จาก Admin และตรวจ report
5. ตรวจ leaderboard ปัจจุบัน/ย้อนหลัง
6. กด Sync Player Statistics แยกและตรวจเฉพาะ GW ปัจจุบัน
7. ตรวจ migration/RLS/advisors และ test query หลัง migration

ห้ามแก้ production data ระหว่าง development และห้ามใช้ SQL ad hoc แทน migration workflow.

## Non-goals

- ไม่เปลี่ยนระบบ `fantasy_gameweek_scores` แบบเก่า
- ไม่เก็บรายละเอียดนักเตะย้อนหลัง
- ไม่เปลี่ยน transfer cost, bench points หรือ awards
- ไม่เพิ่ม automatic scheduler ใหม่ในรอบนี้

## References

- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/reference/javascript/rpc
- https://supabase.com/docs/guides/database/postgres/row-level-security
