# Phase 3A — Pre-season hardening

อัปเดตล่าสุด: 2 สิงหาคม 2026

## Purpose

เตรียมระบบให้พร้อมที่สุดก่อนคู่แรกของฤดูกาล โดยทำงานขนานกับการรอยืนยัน scoring จากการแข่งขันจริงใน Phase 2

Phase 3A เป็นรอบ hardening และ integration test ไม่ใช่การขยายฟีเจอร์ขนาดใหญ่ งานที่เพิ่มต้องช่วยให้ตรวจพบปัญหาและกู้คืนได้ก่อนเปิดใช้งานจริง

## Current baseline

- Production: `https://fpl-chei2.vercel.app`
- Phase 2 implementation deploy แล้ว
- FPL fixtures ใน Supabase: 380 รายการ
- LIFF, dashboard, admin, manual sync และ scheduler ผ่าน smoke test แล้ว
- prediction lock ระดับ database ผ่านด้วย `55P03` และ rollback ไม่เหลือข้อมูลทดสอบ
- ยังรอ fixture จริงที่ `finished` เพื่อยืนยัน scoring/leaderboard

## Workstreams

### 1. LINE Flex Message และ Bot — งานแรก

- ตรวจ flow แชร์จาก LIFF ด้วย `shareTargetPicker`
- ออกแบบและทดสอบ Flex Message สำหรับผลทาย/ตารางคะแนน
- ตรวจ LINE Messaging API webhook, signature verification, reply และ push ตามขอบเขตที่เลือก
- แยก user-initiated share ออกจาก bot push/broadcast ให้ชัดเจน
- เก็บ LINE secret/access token เฉพาะใน server/Vercel หรือ LINE Developers; ห้ามใส่ใน Git หรือแชท

จุดเริ่มต้นคือ [Prompt สำหรับแชทใหม่](phase-3a-line-flex-bot-chat-prompt.md)

### 2. State-transition test matrix

ทดสอบ `scheduled → live → finished`, kickoff lock, scoring, leaderboard, tie award, excluded participant และ postponed/rescheduled โดยใช้ test data ที่ rollback ได้หรือ test environment

### 3. Sync reliability

สถานะ: implementation และ automated tests ใน repository เสร็จแล้ว และ migration ถูก apply production พร้อม read-only schema/privilege verification เมื่อ 2 สิงหาคม 2026

- validate snapshot ทั้งชุดก่อนเขียนข้อมูล รวม duplicate IDs, missing fields และ unknown references
- จำกัด FPL request ด้วย timeout และแยก safe error code สำหรับ 403, 502, timeout และ invalid snapshot
- ใช้ `apply_fpl_sync` RPC เดียวสำหรับ upsert, fixture reconciliation, selective recalculation และ success finalization ภายใน transaction
- sync snapshot 380 fixtures เดิมซ้ำใช้คนละ audit attempt แต่ไม่เพิ่ม business identity ซ้ำ
- `job_runs` เก็บ `error_code` และ allow-listed `details` โดยไม่เก็บ raw provider/database error
- migration ถูก apply production โดยตรงตามคำอนุมัติหลังข้าม local/staging database migration test; post-deployment checks ผ่านและไม่มีการเรียก sync เพื่อแก้ production fixtures สำหรับการทดสอบ

ดู [Sync reliability test evidence](phase-3a-sync-reliability-test-evidence.md), [approved design](superpowers/specs/2026-08-02-phase-3a-sync-reliability-design.md) และ [implementation plan](superpowers/plans/2026-08-02-phase-3a-sync-reliability.md)

### 4. Operations visibility

ตรวจ Apps Script Executions, `job_runs`, Vercel logs และ Supabase/PostgREST health ให้สามารถแยก source failure, database failure และ scheduler failure ได้

### 5. Mobile/LIFF regression

ทดสอบ login, prediction, lock message, dashboard, admin และ share flow ใน LINE WebView และ Chrome Android

## Acceptance criteria before the first kickoff

- Flex Message payload ถูกต้องและแสดงผลใน LINE group ได้
- Bot reply/push ทดสอบสำเร็จตาม scope โดยไม่เปิดเผย secret
- prediction save/lock/scoring มี automated coverage และหลักฐานจาก production ที่เหมาะสม
- sync ซ้ำไม่สร้าง fixtures/predictions/events ซ้ำ
- scheduler ทำงานตามช่วงเวลาและตรวจสอบย้อนหลังได้
- failure path มีข้อความและ runbook ที่ระบุขั้นตอน recovery
- `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build` และ `git diff --check` ผ่าน
- เอกสารและ diff ผ่านการ review ก่อน commit/push

## Boundaries

- ไม่ล้างฐานข้อมูล
- ไม่แก้ fixture จริงค้างไว้เพื่อจำลอง kickoff
- ไม่ใช้ secret ผ่านแชท
- ไม่ commit/push จนกว่าผู้ใช้อนุมัติ

## What closes Phase 2

Phase 2 จะปิดเมื่อมีการแข่งขันจริงที่ sync เป็น `finished`, scoring/leaderboard ถูกตรวจสอบ และ scheduler ทำงานผ่าน live match window อย่างน้อยหนึ่งรอบ

Phase 3A สามารถดำเนินต่อก่อนได้ โดยไม่ต้องรอให้ Phase 2 ปิดอย่างเป็นทางการ
