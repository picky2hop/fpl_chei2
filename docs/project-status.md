# Project Status

Current cutover evidence: [production-only cutover](production-only-cutover-evidence.md).

> เอกสารนี้สรุปสถานะปัจจุบัน ณ 11 สิงหาคม 2026 ส่วน design/plan เดิมใน `docs/superpowers/` เป็น historical reference
> กฎ Autosync ปัจจุบันอยู่ใน [scheduler README](../scheduler/google-apps-script/README.md) และ [deployment runbook](phase-2-deployment-runbook.md); ข้อความ scheduler ในส่วน historical ด้านล่างไม่ใช่ค่าปัจจุบัน

## Current phase

### Phase 2 — Production integration / live validation

สถานะ: implementation และ deployment เสร็จแล้ว; production smoke test ผ่านแล้ว และเหลือ live validation จากการแข่งขันจริงเพื่อยืนยัน scoring/recalculation

### 2026-08-22 — Prediction reliability remediation (implemented and migrations applied)

- เพิ่ม dashboard re-fetch ทุก 30 วินาทีแบบ `no-store` และแสดง score/status ของคู่ `live` ในหน้าทายผล ผลแข่ง และรายละเอียดผู้เล่น/คู่แข่ง
- ล็อกปุ่มทายฝั่ง client หลัง kickoff และเปลี่ยนการบันทึกทั้ง GW เป็น batch RPC transaction เดียว เพื่อลด partial save
- เพิ่ม migration `20260822074829_prediction_batch_write.sql` สำหรับ batch prediction write
- เพิ่ม migration `20260822074947_partial_finished_scoring.sql` ให้คำนวณคะแนนจากคู่ `finished` ได้ทันที แม้คู่ถัดไปใน GW ยัง `scheduled`/`live`; ไม่คำนวณจากคู่ `live`
- Production apply สำเร็จผ่าน Supabase connector; migration history บันทึกทั้งสองรายการด้วย version ข้างต้น และตรวจ function/privilege แบบ read-only แล้ว
- ก่อน apply เวลา `2026-08-22 07:28 UTC`: fixtures 380/source records 380, สถานะยัง `live=1`, `scheduled=379`, score rows 0, award rows 0; ไม่มีการ trigger sync หรือแก้ข้อมูล production เพื่อทดสอบ
- คงเวลา scheduler เดิมตามที่อนุมัติ; การเปลี่ยนสถานะ fixture/คำนวณคะแนนจะเกิดเมื่อ sync รอบถัดไปรับ snapshot จาก provider

หลักฐาน production ล่าสุด:

- Production: `https://fpl-chei2.vercel.app`
- Supabase connector เชื่อมต่อ project `bripkfdcfanjyruqcgji` ได้แบบ read-only
- `app_users`: 1 row
- `gameweek_participants`: 38 rows
- `fixtures`: 380 rows
- `predictions`: 20 rows
- `prediction_events`: 90 rows
- `job_runs`: 8 rows

ตรวจผ่านแล้ว:

- LIFF login และ auto-join active season
- Dashboard อ่านข้อมูลจริงผ่าน server API
- prediction ก่อน kickoff สำเร็จ 10/10 คู่ใน GW2
- prediction หลัง kickoff ถูกปฏิเสธด้วย database error `55P03` โดยทดสอบด้วย transaction rollback
- `/admin` และสิทธิ์ `ADMIN_LINE_USER_ID`
- manual sync ได้ 380 fixtures
- Google Apps Script scheduler เรียก scheduled sync สำเร็จ; transient FPL 403 ถูกบันทึกใน `job_runs` และ retry สำเร็จในรอบถัดไป
- LINE Flex/Bot production smoke test ผ่าน: `เมนู`, `ขอตาราง`, `บอลวันนี้`, `ผลทาย`, unknown text ไม่ตอบกลับ, standings share และ prediction share เข้า LINE group
- เพิ่ม match-result share จาก modal รายละเอียดผลแข่ง: Flex bubble เดียวแสดงทีม/เวลา/สกอร์/เปอร์เซ็นต์ และรายชื่อผู้ทายของคู่ที่เลือก; automated verification ผ่านแล้ว และรอ manual production check
- ตรวจ Flex presentation ผ่าน: logo, ลำดับทีม, avatar, selected highlight, เวลาแข่ง และปุ่มเปิดแอป
- Mobile/LIFF regression ผ่านทั้ง LINE WebView และ Chrome Android ครบ login, prediction, lock message, dashboard, admin และ share flow
- `npm.cmd run test`: 124 passed; lint, build และ `git diff --check` ผ่านเมื่อ 11 สิงหาคม 2026

ยังรอการยืนยันจากการแข่งขันจริง:

- fixture `finished` และการคำนวณคะแนน/leaderboard
- postponed/rescheduled fixture และการคำนวณ GW ที่ได้รับผลกระทบ
- scheduler ระหว่าง live match window หลายรอบ
- manual production check ของปุ่มแชร์ผลแข่งรายคู่ใน LINE WebView

### Phase 3A — Pre-season hardening

สถานะ: LINE Flex/Bot ผ่าน production smoke test และ Mobile/LIFF regression แล้ว; sync reliability implementation ผ่าน automated verification และ migration ถูก apply production พร้อม read-only verification แล้วเมื่อ 2 สิงหาคม 2026

Sync reliability ที่เพิ่มในรอบนี้:

- whole-snapshot validation และ FPL timeout/safe error classification
- dependency-injected job lifecycle สำหรับ fake provider/test doubles
- atomic Supabase RPC สำหรับ upsert, move reconciliation, selective scoring และ success finalization
- `job_runs.error_code` และ allow-listed `details`
- automated coverage สำหรับ 380-row rerun, 403/502/timeout, malformed/duplicate source, safe job failure และ generic route response

Migration `20260802083440_phase_3a_atomic_fpl_sync.sql` ถูก apply production โดยตรงตามคำอนุมัติเมื่อ 2 สิงหาคม 2026 โดยไม่มี local/staging database migration test; migration history, schema, function security และ privileges ผ่าน read-only verification ดู [รายละเอียด Phase 3A](phase-3a-preseason-hardening.md) และ [หลักฐาน sync reliability](phase-3a-sync-reliability-test-evidence.md)

Live smoke check: production homepage ตอบ HTTP 200, unauthenticated sync request ตอบ HTTP 401, fixtures/source records มี 380 รายการเท่ากันและไม่มี duplicate external identity; authenticated provider sync ถูกส่งต่อให้ scheduler ด้วย secret ที่มีอยู่เดิม และไม่เป็น blocker ของ Phase 3A

Bot push/broadcast ยังไม่ได้ทำและไม่ใช่ blocker เพราะอยู่นอก scope ที่อนุมัติในรอบนี้

Closure: ผู้ใช้ยอมรับและข้าม `auth_leaked_password_protection` เพราะแอปปัจจุบันไม่มี password sign-in flow และปิดกระบวนการ Sync reliability, LINE production smoke test และ Mobile/LIFF regression แล้ว

## Phase 1 — UI/UX MVP (เสร็จแล้ว)

สถานะ: UX revision เสร็จ และ production application ใช้งานผ่าน LIFF/ข้อมูลจริงโดยไม่มี preview fallback

เสร็จแล้ว:

- Landing page และ route `/dashboard`
- Mock ตารางคะแนน, เกมวีค, คู่แข่งขัน และผลการแข่งขัน
- 3 tabs: ตารางคะแนน, ทายผล, ผลแข่ง
- เปลี่ยน gameweek และเลือกคำทายได้ทันที
- Test, lint และ production build ผ่านก่อนรอบ UX revision
- Commit ก่อนหน้า: `bc26758`

เสร็จในรอบนี้:

- ใช้พื้นหลัง navy เดียวกับ Landing ทั้งแอป
- Bottom navigation แบบ fixed
- Player prediction detail modal
- ไฮไลท์ชื่อทีมฝั่งที่ผู้เล่นเลือกใน player detail
- Fixture prediction detail modal
- ปุ่มแชร์ผลทายของทุกคนจาก Fixture prediction detail modal
- SVG club crests จาก Premier League resource
- ตัดกรอบขาวรอบ club crest
- Share confirmation popup หลังยืนยันคำทาย
- Lucide icons สำหรับ navigation, share, close และ success state
- LIFF auto-login gate ตั้งแต่ Landing และต้องใช้ Production LIFF authentication
- Animation เฉพาะ loading, transition, modal และ save success
- Test helper สำหรับ player/fixture detail
- `@line/liff` SDK และ auto-login gate เมื่อมี `NEXT_PUBLIC_LIFF_ID`

## Routes

| Route | Purpose |
| --- | --- |
| `/` | LIFF entry gate + Landing |
| `/dashboard` | ตารางคะแนน, ทายผล, ผลการแข่งขัน |

## Environment variables

```env
NEXT_PUBLIC_LIFF_ID=
```

`NEXT_PUBLIC_LIFF_ID` เป็นค่าที่ต้องสร้างจาก LINE Developers Console และเติมใน `.env.local`/Vercel ในรอบ integration จริง ห้าม commit ค่า secret หรือ token ลง Git

## Decisions

- Mobile-first และ max-width ประมาณ 520px เพื่อเหมาะกับ LINE WebView
- ใช้ client state สำหรับ tab/gameweek/selection ใน Phase 1 เพื่อให้เปลี่ยนข้อมูลทันที
- ใช้ system font และ SVG/image URLs เพื่อไม่ต้องดาวน์โหลด font ระหว่าง build
- Preview mode ถูกยกเลิก; production ต้องตั้ง LIFF ID และใช้ auto-login

## Historical roadmap ก่อนเริ่ม Phase 2

รายการนี้ถูกดำเนินการต่อใน Phase 2 แล้ว; งาน LINE Messaging API/Flex Message ถูกย้ายมาเป็นงานแรกของ Phase 3A

## Phase 2 — Approved Design (historical design status)

อัปเดตล่าสุด: 29 กรกฎาคม 2026

สถานะ: Design ผ่านการอนุมัติแล้ว และ implementation ถูกนำไปใช้ใน production แล้ว

เอกสารหลัก: [FPL Phase 2 Backend Design](superpowers/specs/2026-07-29-fpl-phase-2-backend-design.md)

Decisions ที่ล็อกแล้ว:

- ใช้ฤดูกาลปัจจุบันก่อน โดย schema มี `season_id`
- ใช้ LIFF token + server session + server-only Supabase client
- ใช้ Vercel Free และ Google Apps Script เป็น external scheduler
- Apps Script ใช้ trigger ทุก 10 นาที แล้วเรียก Vercel sync endpoint ตามช่วงเวลา Asia/Bangkok
- ผลการแข่งขัน sync คืนวันเสาร์/อาทิตย์ 18:00–02:00 และวันธรรมดาหลัง 06:00 วันละครั้ง
- ตารางแข่งขัน sync อังคารและศุกร์หลัง 18:00
- ผู้ใช้ใหม่ผ่าน LIFF แล้วเข้า active season อัตโนมัติ
- มี `/admin` เฉพาะ admin คนเดียวที่ระบุด้วย `ADMIN_LINE_USER_ID`
- Exclude ผู้เล่นเฉพาะ gameweek โดยไม่ลบบัญชีหรือประวัติ และไม่รวม GW ที่ exclude ใน season total
- ทายถูก 3 คะแนน; ผิดหรือไม่ทาย 0 คะแนน
- แก้คำทายได้จนถึง kickoff และ server/database เป็นผู้ล็อกคำทาย
- Fixture ที่ postponed จะ void คำทายเดิม และให้ทายใหม่เมื่อถูกย้ายไป GW ใหม่
- GW เดิมคำนวณได้เมื่อไม่มี fixture scheduled/live เหลือ โดยไม่นับ fixture postponed
- คะแนนเท่ากันทุกคนได้สถานะแชมป์หรือบ๊วย และเก็บเป็น award แยกแถว

เอกสาร implementation และผลทดสอบปัจจุบัน:

- [Phase 2 Production Status](phase-2-production-status.md)
- [Phase 2 deployment runbook](phase-2-deployment-runbook.md)
- [Phase 3A pre-season hardening](phase-3a-preseason-hardening.md)
