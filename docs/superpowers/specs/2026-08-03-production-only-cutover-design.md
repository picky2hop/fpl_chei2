# Production-only Cutover Design

## Goal

ยกเลิก preview/test environment ที่แยกไว้สำหรับ Phase 3A และให้แอป, deployment และเอกสารอ้างอิง Production เป็น environment เดียว โดยไม่เขียนข้อมูลทดสอบลง Production และไม่เปิดเผย secret.

## Scope

- Production Vercel project `fpl-chei2` และ Production Supabase project ref `bripkfdcfanjyruqcgji` เป็นทรัพยากรที่คงไว้.
- ลบ Vercel test project `fpl-chei2-test` และ Supabase test project ref `iarcgspwoordcemebdoz` หลังตรวจยืนยันชื่อและ Production target แบบ read-only.
- ตัด preview profile, mock dashboard fallback และ `NEXT_PUBLIC_DEMO_MODE` ออกจาก production application path.
- คง unit, domain และ route tests ที่ไม่ต้องใช้ฐานข้อมูลภายนอก.
- ยกเลิก integration harness/CI job ที่พึ่งพา test Supabase project เพื่อไม่ให้ CI ยิง write test เข้า Production.
- อัปเดต README, project status, deployment runbook และ Phase 3A evidence ให้สะท้อน Production-only architecture และระบุ integration evidence เดิมเป็น historical.

## Non-goals

- ไม่แก้กติกาคะแนน, scoring, prediction lock หรือ sync reliability ในงานนี้.
- ไม่ลบข้อมูลหรือ migration ของ Production.
- ไม่ย้ายข้อมูล synthetic จาก test project ไป Production.
- ไม่ใช้ Production credentials ใน automated write tests.

## Cutover behavior

1. LIFF gate ต้องใช้ `NEXT_PUBLIC_LIFF_ID` และ server authentication; เมื่อไม่มีค่าให้แสดง error ไม่สร้าง demo profile.
2. Dashboard ต้องโหลด `/api/dashboard` จาก Production และแสดง error เมื่อ API ใช้งานไม่ได้; ห้าม fallback ไป mock data.
3. Production environment ใช้ `NEXT_PUBLIC_DEMO_MODE=false` หรือไม่ต้องมีตัวแปรนี้อีกหลัง code ไม่อ่านค่า.
4. CI รันเฉพาะ `npm.cmd run test`, `npm.cmd run lint` และ `npm.cmd run build` พร้อมตรวจ diff; ไม่มี `SUPABASE_TEST_*` secrets หรือ test integration step.

## Safety and verification

- ตรวจ `git status` และชื่อ project ก่อนการลบ.
- ตรวจ Production URL, Supabase ref และ row-count invariants แบบ read-only ก่อนและหลัง cutover.
- ลบเฉพาะทรัพยากรที่ชื่อ/ref ตรงกับ test target.
- หลัง deploy ตรวจ HTTP homepage, unauthenticated protection และ authenticated LIFF/dashboard flow โดยไม่สร้างข้อมูลทดสอบค้างใน Production.
- รัน `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build` และ `git diff --check`.
