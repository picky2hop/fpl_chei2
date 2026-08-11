# Phase 3A — Pre-season hardening

อัปเดตล่าสุด: 11 สิงหาคม 2026

## Purpose

เตรียมระบบให้พร้อมที่สุดก่อนคู่แรกของฤดูกาล โดยทำงานขนานกับการรอยืนยัน scoring จากการแข่งขันจริงใน Phase 2

Phase 3A เป็นรอบ hardening และ integration test ไม่ใช่การขยายฟีเจอร์ขนาดใหญ่ งานที่เพิ่มต้องช่วยให้ตรวจพบปัญหาและกู้คืนได้ก่อนเปิดใช้งานจริง

## Current baseline

- Production: `https://fpl-chei2.vercel.app`
- Phase 2 implementation deploy แล้ว
- FPL fixtures ใน Supabase: 380 รายการ
- LIFF, dashboard, admin, manual sync และ scheduler ผ่าน smoke test แล้ว
- prediction lock ระดับ database ผ่านด้วย `55P03` และ rollback ไม่เหลือข้อมูลทดสอบ
- Production-only cutover เสร็จแล้ว; ไม่มี preview deployment หรือ Supabase test project เหลืออยู่
- LINE Flex/Bot production smoke test ผ่านแล้วตาม [หลักฐาน LINE Flex/Bot](phase-3a-line-flex-bot-test-evidence.md)
- เพิ่ม match-result share จาก modal ผลแข่ง โดย automated verification ผ่านแล้ว และรอ manual production check ใน LINE WebView
- Mobile/LIFF regression ผ่านทั้ง LINE WebView และ Chrome Android
- ยังรอ fixture จริงที่ `live`/`finished` เพื่อยืนยัน scoring/leaderboard และ state transition ใน production

## Workstreams

### 1. LINE Flex Message และ Bot — เสร็จแล้ว

- ตรวจ flow แชร์ตารางและผลทายจาก LIFF ด้วย `shareTargetPicker` ในกลุ่ม LINE จริง
- ตรวจคำสั่ง `เมนู`, `ขอตาราง`, `บอลวันนี้`, `ผลทาย` ผ่านครบ
- ตรวจข้อความทั่วไปว่าไม่มีการตอบกลับ
- ตรวจ Flex presentation: logo, ลำดับทีม, avatar, selected highlight, เวลาแข่ง และปุ่มเปิดแอป
- ตรวจ implementation ของ Flex สำหรับผลแข่งรายคู่: score/status, outcome percentages, predictor list, empty state และ safe share errors
- ตรวจ LINE Messaging API webhook, signature verification และ reply ตามขอบเขตที่เลือก
- แยก user-initiated share ออกจาก bot push/broadcast ให้ชัดเจน
- Bot push/broadcast ยังไม่ได้ทำและไม่อยู่ใน scope รอบนี้
- เก็บ LINE secret/access token เฉพาะใน server/Vercel หรือ LINE Developers; ห้ามใส่ใน Git หรือแชท

จุดเริ่มต้นคือ [Prompt สำหรับแชทใหม่](phase-3a-line-flex-bot-chat-prompt.md)

### 2. State-transition test matrix

State-transition integration evidence เดิมครอบคลุม `scheduled → live → finished`, kickoff lock, scoring, leaderboard, tie award, excluded participant และ postponed/rescheduled ใน test project ที่ถูกยกเลิกแล้ว และเก็บไว้เป็น historical evidence. การตรวจต่อจากนี้ใช้ unit/domain/route tests และการตรวจ Production แบบ read-only หรือการแข่งขันจริงเท่านั้น ห้ามสร้าง test fixtures ค้างใน Production.

### 3. Sync reliability

สถานะ: implementation และ automated tests ใน repository เสร็จแล้ว และ migration ถูก apply production พร้อม read-only schema/privilege verification เมื่อ 2 สิงหาคม 2026; Sync reliability ปิดกระบวนการแล้วตามคำยืนยันของผู้ใช้

- validate snapshot ทั้งชุดก่อนเขียนข้อมูล รวม duplicate IDs, missing fields และ unknown references
- จำกัด FPL request ด้วย timeout และแยก safe error code สำหรับ 403, 502, timeout และ invalid snapshot
- ใช้ `apply_fpl_sync` RPC เดียวสำหรับ upsert, fixture reconciliation, selective recalculation และ success finalization ภายใน transaction
- sync snapshot 380 fixtures เดิมซ้ำใช้คนละ audit attempt แต่ไม่เพิ่ม business identity ซ้ำ
- `job_runs` เก็บ `error_code` และ allow-listed `details` โดยไม่เก็บ raw provider/database error
- migration ถูก apply production โดยตรงตามคำอนุมัติหลังข้าม local/staging database migration test; post-deployment checks ผ่านและไม่มีการเรียก sync เพื่อแก้ production fixtures สำหรับการทดสอบ

ดู [Sync reliability test evidence](phase-3a-sync-reliability-test-evidence.md), [approved design](superpowers/specs/2026-08-02-phase-3a-sync-reliability-design.md) และ [implementation plan](superpowers/plans/2026-08-02-phase-3a-sync-reliability.md)

### 4. Operations visibility — ผ่าน baseline แล้ว; ต้องติดตามระหว่างแข่งจริง

ตรวจ Apps Script Executions, `job_runs`, Vercel logs และ Supabase/PostgREST health ได้แล้ว; เหลือเฝ้าดู scheduler ระหว่าง live match window จริงหลายรอบ

### 5. Mobile/LIFF regression — เสร็จแล้ว

ทดสอบ login, prediction, lock message, dashboard, admin และ share flow ผ่านทั้ง LINE WebView และ Chrome Android

## Acceptance criteria before the first kickoff

- Flex Message payload ถูกต้องและแสดงผลใน LINE group ได้ — ผ่านแล้ว
- match-result share payload และ modal flow ผ่าน automated verification; manual production check — รอดำเนินการ
- Bot reply ทดสอบสำเร็จตาม scope โดยไม่เปิดเผย secret — ผ่านแล้ว
- Bot push/broadcast — ยังไม่ทำและไม่อยู่ใน scope รอบนี้
- prediction save/lock/scoring มี automated evidence เดิมและต้องยืนยัน scoring/leaderboard จากการแข่งขันจริงโดยไม่ใช้ Production เป็น test database
- sync ซ้ำไม่สร้าง fixtures/predictions/events ซ้ำ
- scheduler ทำงานตามช่วงเวลาและตรวจสอบย้อนหลังได้
- failure path มีข้อความและ runbook ที่ระบุขั้นตอน recovery
- `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build` และ `git diff --check` ผ่าน
- เอกสารและ diff ต้องอัปเดตให้ตรงกับ production status ก่อน commit/push

## Boundaries

- ไม่ล้างฐานข้อมูล
- ไม่แก้ fixture จริงค้างไว้เพื่อจำลอง kickoff
- ไม่ใช้ secret ผ่านแชท
- ไม่ commit/push จนกว่าผู้ใช้อนุมัติ

## What closes Phase 2

Phase 2 จะปิดเมื่อมีการแข่งขันจริงที่ sync เป็น `finished`, scoring/leaderboard ถูกตรวจสอบ และ scheduler ทำงานผ่าน live match window อย่างน้อยหนึ่งรอบ

Phase 3A สามารถดำเนินต่อก่อนได้ โดยไม่ต้องรอให้ Phase 2 ปิดอย่างเป็นทางการ
