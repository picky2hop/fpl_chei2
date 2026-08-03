# Phase 2 Production Status

See the current [production-only cutover evidence](production-only-cutover-evidence.md) for the retirement of preview/test resources and the final verification checklist.

อัปเดตล่าสุด: 3 สิงหาคม 2026

## Production-only cutover

เมื่อ 3 สิงหาคม 2026 repository และ deployment ถูกปรับให้ใช้ Production เป็น environment เดียว: Vercel project `fpl-chei2` และ Supabase project `fpl_chei` (`bripkfdcfanjyruqcgji`). Preview profile, mock dashboard fallback, Vercel test project และ Supabase test project ถูกยกเลิกตามเอกสาร [Production-only cutover](superpowers/specs/2026-08-03-production-only-cutover-design.md). ห้ามเพิ่ม test fixtures หรือใช้ Production write เพื่อจำลอง state transition.

## Current deployment

- Production URL: `https://fpl-chei2.vercel.app`
- Vercel deploy จาก GitHub `main` อัตโนมัติ
- LIFF endpoint URL: `https://fpl-chei2.vercel.app/`
- Production environment variables ครบ 9 ค่าแล้ว; ค่า secret ไม่บันทึกในเอกสารหรือแชท
- Supabase project: `fpl_chei` (`bripkfdcfanjyruqcgji`)
- ห้ามล้างฐานข้อมูลหรือ reset ข้อมูล production

## Verified production state

### Authentication and dashboard

- LIFF login ใช้งานได้
- `app_users`: 1 row สำหรับ `picky2hop`
- `gameweek_participants`: 38 rows
- Dashboard อ่านข้อมูลจริงผ่าน server API
- non-admin ใช้ role `player` ได้ถูกต้อง
- `picky2hop` เข้า `/admin` ได้ด้วย `ADMIN_LINE_USER_ID`

### Predictions

- prediction ก่อน kickoff ผ่านแล้ว: บันทึก 10/10 คู่ใน GW2
- `predictions`: 20 rows
- `prediction_events`: 90 rows
- prediction lock หลัง kickoff ผ่านระดับ database ด้วย error code `55P03` (`Prediction is locked`)
- การทดสอบ lock ใช้ fixture GW3 ชั่วคราวใน transaction และ rollback จึงไม่มีข้อมูลทดสอบค้าง

### FPL sync and scheduler

- production sync สำเร็จ: อัปเดต fixtures 380 รายการ
- `job_runs`: 8 rows ณ การตรวจล่าสุด
- manual sync สำเร็จและบันทึก job run
- Google Apps Script scheduler ทำงานตามเงื่อนไขเวลาและเรียก scheduled sync สำเร็จ
- scheduled run หนึ่งครั้งเจอ `FPL source returned 403` แต่รอบถัดไป retry สำเร็จ; ไม่พบหลักฐานว่าเป็นปัญหา PostgREST หรือ idempotency

## Repository verification

ผลตรวจล่าสุดจาก commit `bc9f9e7` และการตรวจหลังทดสอบ lock:

- `npm.cmd run test` — 40 tests passed
- `npm.cmd run lint` — passed
- `npm.cmd run build` — passed
- `git diff --check` — passed

## Remaining Phase 2 live validation

ยังไม่สามารถยืนยันด้วยการแข่งขันจริงได้จนกว่าฤดูกาลจะเริ่ม:

1. sync fixture ที่มีสถานะ `live` และ `finished`
2. ตรวจ scoring และ leaderboard หลังมีผลแข่งจริง
3. ตรวจ postponed/rescheduled fixture และ GW ที่ได้รับผลกระทบ
4. เฝ้าดู scheduler ระหว่าง live match window หลายรอบ

การทดสอบ lock ระดับ database ผ่านแล้ว; ไม่จำเป็นต้องแก้ fixture จริงค้างไว้ใน production เพื่อจำลอง kickoff อีก

## Next phase

LINE Flex/Bot ของ Phase 3A ผ่าน production แล้ว และมี [sync reliability implementation](phase-3a-sync-reliability-test-evidence.md) ที่ถูก commit/push ใน `66802bc`

Atomic sync migration ถูก apply production แล้ว และ application code ถูก push ใน `66802bc`; live authenticated provider run หลัง deployment ยังรอ scheduler ที่มี secret นอก repository

`auth_leaked_password_protection` เป็น advisor warning ที่ผู้ใช้ยอมรับและข้าม เนื่องจากแอปปัจจุบันไม่มี password sign-in flow

## Security and change policy

- ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `FPL_SYNC_TOKEN`, LINE channel secret/access token หรือ secret อื่นใน Git, เอกสาร หรือแชท
- การตรวจ production ผ่าน Supabase connector ให้เริ่มจาก read-only
- ห้าม `reset --hard` หรือคำสั่งทำลายข้อมูล
- ห้าม commit/push จนกว่าผู้ใช้จะ review และอนุมัติ
