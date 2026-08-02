# Google Apps Script scheduler

## Setup

1. สร้าง Apps Script project แล้ววาง `Code.gs`
2. ตั้ง Script Properties:
   - `VERCEL_SYNC_URL`: `https://fpl-chei2.vercel.app/api/sync`
   - `FPL_SYNC_TOKEN`: ค่าเดียวกับ Vercel `FPL_SYNC_TOKEN`
3. รัน `installTenMinuteTrigger` เพียงครั้งเดียวและอนุมัติสิทธิ์ Apps Script

เก็บ token ใน Script Properties เท่านั้น ห้ามใส่ Supabase key, LINE secret หรือ token ในโค้ดและ Git

## Schedule rules

Trigger ทำงานทุก 10 นาทีใน timezone `Asia/Bangkok` แต่จะเรียก Vercel เฉพาะช่วงที่กำหนด:

- เสาร์/อาทิตย์ 18:00–02:00: results sync ทุก 10 นาที
- จันทร์–ศุกร์หลัง 06:00: results sync วันละ 1 ครั้ง
- อังคาร/ศุกร์หลัง 18:00: schedule sync วันละ 1 ครั้ง

การเรียกซ้ำในช่วง daily/schedule ถูกกันด้วย Script Properties ส่วนการเรียก API สำเร็จจึงจะบันทึกวันที่สำเร็จ

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
