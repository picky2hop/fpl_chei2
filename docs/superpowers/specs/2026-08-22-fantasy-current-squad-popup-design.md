# Fantasy Current-GW Squad Popup Design

## Goal

ให้ผู้ใช้กดชื่อ FPL Entry ในตารางอันดับ Fantasy แล้วเห็นทีมของ Entry นั้นใน GW ปัจจุบัน โดยแสดงหมายเลข GW ชัดเจน และเก็บข้อมูลทีมไว้เพียง snapshot ล่าสุดต่อ Entry

## Approved behavior

- ทุก Entry ในอันดับที่เป็นสมาชิกของ snapshot สามารถกดดูทีมได้ แม้ยังไม่ได้ mapping กับ LINE ID
- Popup แสดงเฉพาะทีมของ GW ปัจจุบัน ไม่ผูกกับ GW ย้อนหลังที่กำลังเลือกดูใน leaderboard
- เมื่อ GW ปัจจุบันเปลี่ยน ระบบเขียน snapshot ใหม่ทับข้อมูลเดิมของ Entry เดิม
- ทุกครั้งที่เปิด Popup ระบบดึงข้อมูลทีมและคะแนนล่าสุดจาก FPL แม้ยังอยู่ GW เดิม แล้ว upsert ทับ snapshot เดิมของ Entry เดิม
- Entry ที่อยู่ทั้งสองลีกใช้ squad snapshot เดียวกัน ไม่เก็บข้อมูลซ้ำตามลีก
- คะแนนและอันดับย้อนหลังไม่เปลี่ยนแปลง และไม่ใช้ข้อมูล squad ในการคำนวณคะแนน
- หาก FPL API ล้มเหลวหรือยังไม่มีข้อมูล GW ปัจจุบัน ระบบคง snapshot เดิมไว้และแสดงข้อความที่ปลอดภัย
- คะแนนรายนักเตะใช้ `event_points` จาก FPL bootstrap ล่าสุด; คะแนนที่แสดงคือคะแนนดิบของนักเตะ และแสดงป้าย Captain/VC แยกต่างหาก
- รูปนักเตะใช้ค่า `photo` จาก FPL bootstrap เช่น `154561.jpg` เป็น photo key สำหรับ URL มาตรฐาน และมี fallback เมื่อรูปโหลดไม่ได้; ห้ามใช้ FPL player ID เป็นชื่อไฟล์รูป
- สีของแถวผู้เล่นแยก GK, DEF, MID, FWD และตัวสำรองอย่างชัดเจน

## Architecture

เพิ่ม provider method สำหรับอ่าน picks ของ Entry ใน GW ปัจจุบัน และเพิ่ม server endpoint ที่ refresh-on-open:

1. หน้า leaderboard ส่ง league ID และ FPL Entry ID ไปยัง endpoint เมื่อผู้ใช้กดแถว
2. Server ตรวจ authentication และตรวจว่า Entry อยู่ใน membership snapshot ของลีกที่เลือก
3. ทุกคำขอที่ผ่าน validation เรียก FPL picks และ bootstrap ล่าสุด เพื่อได้คะแนนรายนักเตะและ metadata ล่าสุด
4. normalize ข้อมูลและ upsert ทับ snapshot เดิมแบบ atomic ทั้งกรณี GW เดิมและ GW ใหม่
5. หาก FPL ล้มเหลว ให้คืน snapshot เดิมที่มีอยู่เมื่อทำได้ พร้อมข้อความสถานะที่ปลอดภัย
6. Popup แสดงผล JSON ที่ได้รับเป็นการ์ด UI ไม่แสดง JSON ดิบแก่ผู้ใช้

การ refresh-on-open จำกัดจำนวน FPL request เฉพาะ Entry ที่มีคนเปิดดู และยังคงข้อกำหนดว่าเมื่อ GW ใหม่ถูกเปิดดู ข้อมูลเดิมจะถูกเขียนทับ ไม่สะสมราย GW โดยไม่มีการเพิ่ม TTL/cooldown ในรอบนี้

## Database

เพิ่ม `public.fantasy_entry_current_squads`:

- `season_id`, `fpl_entry_id` เป็น identity ต่อทีม
- `gameweek_id`, `gameweek_number` ระบุ GW ของ snapshot ล่าสุด
- `squad jsonb` เก็บ formation, captain, vice-captain, ตัวจริง, ตัวสำรอง, คะแนน, position และ photo URL ที่จำเป็นต่อการแสดงผล
- `fantasy_player_gameweek_stats.photo_key` เก็บ photo key จาก FPL เพื่อให้หน้าสถิตินักเตะสร้างรูปได้ถูกต้องทั้ง 700+ รายการ
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
- คืน `entryId`, `gameweekNumber`, `squad`, `cached`, และ `sourceSyncedAt`
- ไม่เปิดเผย error จาก FPL, Supabase หรือค่า configuration ภายใน

## UI flow

- เปลี่ยนแถวอันดับเป็นปุ่มเต็มแถวพร้อม focus state และ label ที่สื่อว่ากดเพื่อดูทีม
- กดแล้วเปิด modal กลางหน้าจอ mobile-first พร้อม backdrop
- แสดงชื่อทีม, FPL Entry ID, `ทีม GW ปัจจุบัน · GW X`, formation, รายการตัวจริง, captain/vice-captain และตัวสำรอง
- ระหว่างโหลดแสดง loading state; เมื่อผิดพลาดแสดงข้อความภาษาไทยและปุ่มปิด
- ปิดได้ด้วยปุ่มปิดและ backdrop; ไม่เปลี่ยน tab หรือ GW ของ leaderboard
- ถ้าผู้ใช้กำลังดูอันดับย้อนหลัง Popup ยังคงแสดงทีม GW ปัจจุบัน และต้องมีป้ายระบุชัดเจน
- แถวผู้เล่นใช้สีพื้น/เส้นขอบตามตำแหน่ง: GK, DEF, MID, FWD และใช้โทนแยกสำหรับตัวสำรอง
- สถิตินักเตะและผู้เล่นใน Popup แสดงรูปนักเตะจาก FPL พร้อม fallback เป็นตัวอักษรย่อเมื่อรูปใช้ไม่ได้
- ขนาดรูปนักเตะเพิ่มเป็น 2 เท่าจากขนาดเดิมใน Popup และหน้าสถิตินักเตะ

## Admin feedback modal

- ผลลัพธ์ success/error ของ Fantasy admin actions และ admin prediction actions แสดงใน modal ที่เข้าถึงได้ แทนข้อความ inline ใต้ปุ่ม
- ครอบคลุม Sync, Manual sync, Mapping, League create/update/archive, Mapping archive, Awards และ Participation exclude/restore
- ปุ่ม Archive ของลีกและ Mapping ต้องเปิด confirmation modal ก่อนเรียก API; ยกเลิกแล้วต้องไม่มีการเปลี่ยนข้อมูล
- modal มี title, ข้อความภาษาไทย, สถานะ success/error, ปุ่มปิด และไม่เปิดเผยรายละเอียดภายในของ server

## Testing

- FPL client normalizes picks response and rejects malformed data
- Squad normalizer preserves captain, vice-captain, starters, bench, and points
- Repository returns current snapshot and upserts a newer GW over the previous snapshot
- API rejects unauthenticated, invalid, and non-member requests and returns safe errors
- API refreshes the current Entry snapshot on every valid Popup open, including the same GW, and preserves the previous snapshot if the upstream request fails
- Leaderboard rows remain Entry-based and clickable without aggregating shared LINE IDs
- FPL player event points and image URL are normalized into current squad/player-stat display data
- Admin success and error actions expose an accessible feedback modal instead of inline status text
- Archive confirmation does not call the archive endpoint until the user confirms
- Position colors and player-image fallback are deterministic and render for both stats and squad rows
- Existing Fantasy and prediction tests remain green
