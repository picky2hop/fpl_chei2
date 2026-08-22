# Fantasy Current-GW Squad Popup Design

## Goal

ให้ผู้ใช้กดชื่อ FPL Entry ในตารางอันดับ Fantasy แล้วเห็นทีมของ Entry นั้นใน GW ปัจจุบัน โดยแสดงหมายเลข GW ชัดเจน และเก็บข้อมูลทีมไว้เพียง snapshot ล่าสุดต่อ Entry

## Approved behavior

- ทุก Entry ในอันดับที่เป็นสมาชิกของ snapshot สามารถกดดูทีมได้ แม้ยังไม่ได้ mapping กับ LINE ID
- Popup แสดงเฉพาะทีมของ GW ปัจจุบัน ไม่ผูกกับ GW ย้อนหลังที่กำลังเลือกดูใน leaderboard
- เมื่อ GW ปัจจุบันเปลี่ยน ระบบเขียน snapshot ใหม่ทับข้อมูลเดิมของ Entry เดิม
- Entry ที่อยู่ทั้งสองลีกใช้ squad snapshot เดียวกัน ไม่เก็บข้อมูลซ้ำตามลีก
- คะแนนและอันดับย้อนหลังไม่เปลี่ยนแปลง และไม่ใช้ข้อมูล squad ในการคำนวณคะแนน
- หาก FPL API ล้มเหลวหรือยังไม่มีข้อมูล GW ปัจจุบัน ระบบคง snapshot เดิมไว้และแสดงข้อความที่ปลอดภัย

## Architecture

เพิ่ม provider method สำหรับอ่าน picks ของ Entry ใน GW ปัจจุบัน และเพิ่ม server endpoint ที่ทำ cache-on-demand:

1. หน้า leaderboard ส่ง league ID และ FPL Entry ID ไปยัง endpoint เมื่อผู้ใช้กดแถว
2. Server ตรวจ authentication และตรวจว่า Entry อยู่ใน membership snapshot ของลีกที่เลือก
3. ถ้ามี snapshot ของ Entry ที่ตรงกับ GW ปัจจุบัน ให้คืนข้อมูลจากฐานข้อมูล
4. ถ้าไม่มีหรือเป็น GW เก่า ให้เรียก FPL, normalize ข้อมูล และ upsert ทับ snapshot เดิมแบบ atomic
5. Popup แสดงผล JSON ที่ได้รับเป็นการ์ด UI ไม่แสดง JSON ดิบแก่ผู้ใช้

การใช้ cache-on-demand จำกัดจำนวน FPL request เฉพาะ Entry ที่มีคนเปิดดู และยังคงข้อกำหนดว่าเมื่อ GW ใหม่ถูกเปิดดู ข้อมูลเดิมจะถูกเขียนทับ ไม่สะสมราย GW

## Database

เพิ่ม `public.fantasy_entry_current_squads`:

- `season_id`, `fpl_entry_id` เป็น identity ต่อทีม
- `gameweek_id`, `gameweek_number` ระบุ GW ของ snapshot ล่าสุด
- `squad jsonb` เก็บ formation, captain, vice-captain, ตัวจริง, ตัวสำรอง, คะแนน และข้อมูล player ที่จำเป็นต่อการแสดงผล
- `source_synced_at`, `created_at`, `updated_at`
- unique `(season_id, fpl_entry_id)` เพื่อบังคับให้มีเพียง snapshot เดียวต่อ Entry
- เปิด RLS, revoke การเข้าถึงจาก `anon`/`authenticated`, และให้ server ใช้ `service_role` ตาม pattern ตาราง Fantasy เดิม

ไม่สร้างแถวแยกตามลีกและไม่สร้างแถวสะสมตาม GW

## API and validation

เพิ่ม `GET /api/fantasy/team?league=<league-id>&entry=<fpl-entry-id>`:

- ต้องผ่าน `requireUser`
- league ต้องมีอยู่ใน season ปัจจุบัน
- Entry ต้องอยู่ใน membership snapshot ของลีกที่เลือกสำหรับ GW ปัจจุบัน
- entry ID ต้องเป็นจำนวนเต็มบวก
- คืน `gameweek`, `entry`, `squad`, และ `cachedAt`
- ไม่เปิดเผย error จาก FPL, Supabase หรือค่า configuration ภายใน

## UI flow

- เปลี่ยนแถวอันดับเป็นปุ่มเต็มแถวพร้อม focus state และ label ที่สื่อว่ากดเพื่อดูทีม
- กดแล้วเปิด modal กลางหน้าจอ mobile-first พร้อม backdrop
- แสดงชื่อทีม, FPL Entry ID, `ทีม GW ปัจจุบัน · GW X`, formation, สนามตัวจริง, captain/vice-captain และตัวสำรอง
- ระหว่างโหลดแสดง loading state; เมื่อผิดพลาดแสดงข้อความภาษาไทยและปุ่มปิด
- ปิดได้ด้วยปุ่มปิดและ backdrop; ไม่เปลี่ยน tab หรือ GW ของ leaderboard
- ถ้าผู้ใช้กำลังดูอันดับย้อนหลัง Popup ยังคงแสดงทีม GW ปัจจุบัน และต้องมีป้ายระบุชัดเจน

## Testing

- FPL client normalizes picks response and rejects malformed data
- Squad normalizer preserves captain, vice-captain, starters, bench, and points
- Repository returns current snapshot and upserts a newer GW over the previous snapshot
- API rejects unauthenticated, invalid, and non-member requests and returns safe errors
- API uses cached current snapshot before calling FPL and refreshes only when GW changes
- Leaderboard rows remain Entry-based and clickable without aggregating shared LINE IDs
- Existing Fantasy and prediction tests remain green
