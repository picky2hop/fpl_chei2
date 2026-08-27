# Google Apps Script scheduler

## Setup

1. สร้าง Apps Script project แล้ววาง `Code.gs`
2. ตั้ง Script Properties:
   - `VERCEL_SYNC_URL`: `https://fpl-chei2.vercel.app/api/sync`
   - `FPL_SYNC_TOKEN`: ค่าเดียวกับ Vercel `FPL_SYNC_TOKEN`
3. รัน `installAutosyncTrigger` เพียงครั้งเดียวและอนุมัติสิทธิ์ Apps Script ตัวติดตั้งจะลบ trigger เดิมของ `runFplSyncScheduler` แล้วสร้าง heartbeat ทุก 10 นาที

เก็บ token ใน Script Properties เท่านั้น ห้ามใส่ Supabase key, LINE secret หรือ token ในโค้ดและ Git

## Schedule rules

Trigger heartbeat ทำงานทุก 10 นาทีใน timezone `Asia/Bangkok` และระบบจะเรียก Vercelจริงไม่ถี่เกิน 20 นาทีในช่วง live โดยใช้ `LAST_LIVE_SYNC_AT`:

- เสาร์ 18:00–23:50: results sync ทุก 20 นาที
- อาทิตย์ 00:01–02:10: results sync ทุก 20 นาที
- อาทิตย์ 18:00–23:50: results sync ทุก 20 นาที
- จันทร์ 00:01–02:10: results sync ทุก 20 นาที
- จันทร์–ศุกร์หลัง 06:00: results sync วันละ 1 ครั้ง
- อังคาร/ศุกร์หลัง 18:00: schedule sync วันละ 1 ครั้ง
- Fantasy player statistics sync ทุกชั่วโมงตลอด 24 ชั่วโมง ตามเวลา `Asia/Bangkok`

การเรียกซ้ำในช่วง daily/schedule ถูกกันด้วย Script Properties ส่วนช่วง live จะเรียกเมื่อครบอย่างน้อย 20 นาทีจาก live sync สำเร็จครั้งก่อน Fantasy player statistics ใช้ `LAST_FANTASY_PLAYER_STATS_ATTEMPT_HOUR` เพื่อให้มีความพยายามไม่เกิน 1 ครั้งต่อชั่วโมง แม้ FPL จะตอบกลับเป็น error; รายละเอียด success/failure จะถูกบันทึกใน `job_runs` สำหรับผู้ที่มี trigger เดิมอยู่แล้ว ให้รัน `installAutosyncTrigger` หนึ่งครั้งเพื่อเปลี่ยนการตั้งค่าและป้องกัน trigger ซ้อนกัน

เมื่อ fixture sync และ Fantasy player statistics ครบกำหนดใน heartbeat เดียวกัน ระบบจะเรียก endpoint เดิมแยกเป็น mode `scheduled` และ `fantasy_player_stats` ตามลำดับ เพื่อไม่ให้การ sync สถิตินักเตะเปลี่ยน behavior ของระบบทายผล

หมายเหตุ: Google Apps Script รองรับ `everyMinutes` เฉพาะ 1, 5, 10, 15 และ 30 นาที จึงใช้ heartbeat 10 นาทีร่วมกับ time gate เพื่อให้ effective sync cadence เป็น 20 นาที

## Verified run

ตรวจจาก Apps Script Executions และ `public.job_runs` แล้ว:

- scheduled run เวลา `2026-07-30 12:51 UTC` ล้มเหลวด้วย `FPL source returned 403`
- scheduled retry เวลา `2026-07-30 12:53 UTC` สำเร็จ
- failed run ไม่ถูก mark เป็นวันที่สำเร็จ จึง retry ได้ตามเงื่อนไข

ผลนี้ยืนยันว่า scheduler ไม่ได้ทำงานนอกช่วงเวลาที่กำหนดจาก logic ใน `Code.gs`; การยืนยันระยะยาวให้ตรวจ Apps Script Executions เพิ่มเมื่อมี live match จริง

## Troubleshooting

- `Missing VERCEL_SYNC_URL or FPL_SYNC_TOKEN`: ตรวจ Script Properties โดยไม่ส่งค่ามาในแชท
- `Vercel sync failed: 403`: ตรวจ FPL source และรอ retry; หลัง deploy Phase 3A ให้ตรวจ `job_runs.error_code = FPL_HTTP_403`
- `Vercel sync failed: 502`: ตรวจ Vercel logs และ Supabase/PostgREST health ก่อน retry

หลัง deploy Phase 3A ให้ใช้ `job_runs.error_code` และ `details` สำหรับแยก source/timeout/database failure โดยไม่ใช้ raw error body; migration ถูก apply production และตรวจ execute privileges แล้วเมื่อ 2 สิงหาคม 2026
