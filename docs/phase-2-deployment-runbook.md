# Phase 2 deployment and operations runbook

เอกสารนี้ใช้สำหรับ production ของ `https://fpl-chei2.vercel.app`. เก็บ secret ไว้เฉพาะใน Vercel Environment Variables และ Google Apps Script Script Properties ห้ามใส่ใน Git, เอกสาร หรือแชท

หลัง Production-only cutover ระบบมี environment เดียวคือ Production Vercel project `fpl-chei2` และ Production Supabase project `fpl_chei` (ref `bripkfdcfanjyruqcgji`) เท่านั้น ไม่มี preview fallback, test deployment หรือ test database ให้ใช้งานอีกต่อไป

## 1. Vercel project

ตั้งค่าจาก GitHub repository `picky2hop/fpl_chei2`:

- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Node.js: 20.x หรือเวอร์ชันที่ติดตั้งในโปรเจกต์รองรับ

Production environment variable names ที่ใช้งาน:

```text
NEXT_PUBLIC_LIFF_ID
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LINE_CHANNEL_ID
SESSION_SECRET
ADMIN_LINE_USER_ID
FPL_API_BASE_URL=https://fantasy.premierleague.com
FPL_SYNC_TOKEN
```

ห้ามบันทึกค่าจริงของ `SESSION_SECRET`, `FPL_SYNC_TOKEN`, Supabase service key หรือ LINE secret/access token ใน repository

## 2. LINE LIFF

ตั้ง LIFF endpoint URL เป็น:

```text
https://fpl-chei2.vercel.app/
```

`NEXT_PUBLIC_LIFF_ID` ต้องเป็น LIFF ID เต็ม และ LINE channel ที่ใช้ verify ID token ต้องตรงกับ `LINE_CHANNEL_ID` ฝั่ง server

## 3. Production checks ที่ผ่านแล้ว

- LIFF login และ auto-join active season
- Dashboard อ่านข้อมูลจริงผ่าน server API
- prediction ก่อน kickoff และ audit event
- database-authoritative prediction lock หลัง kickoff (`55P03`)
- `/admin` สำหรับ `ADMIN_LINE_USER_ID`
- manual sync: 380 fixtures
- Google Apps Script scheduler และ `job_runs`

รายละเอียดหลักฐานอยู่ที่ [Phase 2 Production Status](phase-2-production-status.md)

## 4. วิธีตรวจ prediction

### ก่อน kickoff

1. เปิด LIFF URL ใน LINE
2. เข้า `/dashboard` และเลือก GW ที่มี fixture `scheduled` ในอนาคต
3. เลือกผลให้ครบทุกคู่แล้วกดยืนยัน
4. ตรวจข้อความบันทึกสำเร็จและ `prediction_events` ผ่าน read-only query

### หลัง kickoff

ใช้การทดสอบจริงเมื่อมี fixture เริ่มแข่ง หรือใช้ unit/database test ที่ rollback ได้ ห้ามแก้ fixture จริงค้างไว้ใน production

ผลที่คาดหวังคือ server/API ตอบ `409` และ database function ตอบ error code `55P03` โดยไม่สร้างหรือแก้ prediction

## 5. Manual FPL sync

1. เข้า `/admin` ด้วยบัญชี admin
2. กด `Manual sync`
3. คาดหวังข้อความ `อัปเดต fixtures 380 รายการแล้ว` หรือจำนวนที่ API ส่งกลับจริง
4. ตรวจ `public.job_runs` ด้วย read-only query:

```sql
select idempotency_key, mode, status, error_code, error_message, details, started_at, finished_at
from public.job_runs
order by started_at desc
limit 10;
```

ถ้า FPL ตอบ 403 ให้รอแล้ว retry; ระบบต้องบันทึก failed job และไม่ mark scheduler date สำเร็จก่อน sync สำเร็จ

## 6. Google Apps Script scheduler

1. วาง `scheduler/google-apps-script/Code.gs` ใน Apps Script
2. ตั้ง Script Properties:
   - `VERCEL_SYNC_URL`: `https://fpl-chei2.vercel.app/api/sync`
   - `FPL_SYNC_TOKEN`: ค่าเดียวกับ Vercel
3. รัน `installTenMinuteTrigger` เพียงครั้งเดียว
4. ตรวจ Executions ของ Apps Script และ `public.job_runs`

เงื่อนไขเวลา Asia/Bangkok:

- เสาร์/อาทิตย์ 18:00–02:00: results sync ทุก 10 นาที
- จันทร์–ศุกร์หลัง 06:00: results sync วันละ 1 ครั้ง
- อังคาร/ศุกร์หลัง 18:00: schedule sync วันละ 1 ครั้ง

## 7. Phase 3A atomic sync deployment

Migration `20260802083440_phase_3a_atomic_fpl_sync.sql` เป็น additive migration และต้องผ่าน review ก่อน apply production

ลำดับ deployment หลังได้รับอนุมัติ:

1. หยุดหรือเลี่ยง scheduler window ชั่วคราวเพื่อไม่ให้ old/new application versions sync พร้อมกัน
2. Apply migration ผ่าน workflow Supabase ที่อนุมัติ
3. รัน read-only checks ใน `tests/sql/phase-2-schema.sql`; `anon` และ `authenticated` ต้อง execute `apply_fpl_sync` ไม่ได้ และ `service_role` ต้อง execute ได้
4. Deploy application code
5. เรียก manual sync หนึ่งรอบในช่วงที่ปลอดภัย แล้วตรวจ `status`, `error_code`, `details`, counts และ affected GW ใน `job_runs`
6. เปิด scheduler กลับตามเดิม

หาก application deployment ต้อง rollback ให้ rollback application ก่อน ส่วน function/columns ใหม่เป็น additive และเก็บไว้ได้จนกว่าจะมี migration ถัดไปที่ผ่าน review ห้าม drop function หรือ columns ระหว่างที่ยังมี application version ใหม่เรียกใช้งาน

Migration นี้ถูก apply production แล้วเมื่อ 2 สิงหาคม 2026 หลัง dry-run ยืนยันว่ามีเพียง Phase 3A migration รายการเดียว จากนั้น migration history, schema columns, function security/search path และ execute privileges ผ่าน read-only verification โดยไม่ได้เรียก sync เพื่อแก้ production fixtures สำหรับการทดสอบ

ตามคำสั่งผู้ใช้ ไม่มีขั้นตอน apply/test migration บน local หรือ staging database หลัง review ต้องได้รับคำอนุมัติ apply production แยกต่างหาก แล้วจึงทำตามลำดับข้างต้นโดยตรง

## 8. Repository verification evidence

คำสั่งต่อไปนี้รันผ่านแล้วบน Windows เพื่อยืนยัน application code เท่านั้น ไม่ได้ execute migration กับ local database และไม่ใช่ deployment step ที่ยังค้างอยู่:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
```

ให้ผู้ใช้ review diff ก่อน commit/push และก่อน apply production ทุกครั้ง
