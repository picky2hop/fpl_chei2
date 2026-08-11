# Phase 3A — LINE Flex/Bot test evidence

สถานะเอกสารนี้: production smoke test ผ่านแล้วเมื่อ 4 สิงหาคม 2026 หลัง deploy โดยทดสอบใน LINE group ที่กำหนด และไม่บันทึก user ID, raw payload, signature หรือ secret

## LIFF share

- เพิ่ม standings share จากปุ่มใน leaderboard ผ่าน `shareTargetPicker`
- แชร์ตาม mode ที่ผู้ใช้กำลังดู: GW หรือทั้งฤดูกาล
- prediction share ส่งชื่อ/avatar ผู้ทาย, โลโก้ทีม และ choice highlight
- cancellation และ unavailable environment แสดงข้อความภาษาไทยที่ปลอดภัย โดยไม่แสดง configuration value
- Flex ทุกแบบมีปุ่มเปิด LIFF app ด้านล่าง

## Bot webhook

- รองรับ exact command aliases: `เมนู`, `ขอตาราง`, `ตารางคะแนน`, `คะแนน`, `อันดับ`, `บอลวันนี้`, `โปรแกรมบอล`, `คู่วันนี้`, `ผลทาย`, `คำทาย`
- `ผลทาย` ใช้ LINE sender user ID เพื่อค้นหาบัญชีใน server-side data reader
- ข้อความที่ไม่อยู่ในรายการและ non-text event ไม่ตอบกลับ
- ตรวจ signature ก่อน parse/process และตอบกลับผ่าน LINE reply endpoint

## Bot push/broadcast

- ไม่ได้เพิ่มหรือเรียก push/broadcast ใน batch นี้ ตาม scope ที่อนุมัติ

## Flex and app display

- standings: rank, avatar, name, points
- today fixtures: kickoff time, home name + home logo, away logo + away name
- prediction: predictor avatar/name, home name + home logo, away logo + away name, selected side highlight
- match-result share: selected fixture team/score/time, outcome percentages, and all predictors for that fixture in one app-style bubble
- app prediction/results/player detail/fixture detail ใช้ลำดับทีมเดียวกัน
- avatar initials แสดงเฉพาะเมื่อไม่มี avatar URL

## Automated evidence from implementation batches

- `npm.cmd run test` → 72 tests passed, 0 failed
- `npm.cmd run lint` → passed
- `npm.cmd run build` → passed
- `git diff --check` → passed
- no Supabase write or fixture mutation was performed for this batch

## 2026-08-01 production regression follow-up (historical batch)

- Bot data commands now choose the flagged current gameweek and fall back to the lowest-numbered gameweek when the FPL source has no `is_current` flag.
- LIFF share now treats only `{ status: "success" }` as a successful send; cancellation or any non-success result is shown as cancelled.
- Follow-up verification: `npm.cmd run test` → 74 passed, `npm.cmd run lint` → passed, `npm.cmd run build` → passed, `git diff --check` → passed.

## Current repository verification — 4 August 2026

- `npm.cmd run test` → 113 passed, 0 failed
- `npm.cmd run lint` → passed
- `npm.cmd run build` → passed
- `git diff --check` → passed; มีเฉพาะคำเตือน LF/CRLF ของ working copy บน Windows

## 2026-08-11 match-result share implementation

- เพิ่มปุ่มแชร์ใน modal รายละเอียดคู่ของแท็บผลแข่ง
- ใช้ข้อมูล prediction book ของ gameweek และ fixture ที่เลือก เพื่อไม่ให้รายชื่อผู้ทายจากคู่อื่นปะปน
- Flex ใช้ bubble เดียว, Bangkok date/time, score/status, outcome percentages, predictor avatar/name/choice และ existing LIFF app footer
- รองรับ empty state และ predictor list จำนวนมากด้วย nested boxes ภายใต้ข้อจำกัด child ของ LINE Flex
- เพิ่ม safe error mapping สำหรับ picker unavailable, invalid/oversized payload, cancellation และ unknown errors
- Automated verification: `npm.cmd run test` → 124 passed, `npm.cmd run lint` → passed, `npm.cmd run build` → passed, `git diff --check` → passed
- Manual production verification ของฟีเจอร์ใหม่นี้ยังรอการตรวจจากผู้ใช้ใน LINE WebView; ผล smoke test เดิมด้านล่างยังเป็นหลักฐานของ batch ก่อนหน้า

## Regression fixes in this review batch

- Live player and fixture detail now use the active prediction book from the dashboard read model instead of the mock-only prediction book.
- Flex payloads use `giga` bubbles, circular image assets, PNG-compatible Premier League badge URLs, the approved LIFF URL, and a dark-text app action.
- The exact `ทายผล` bot alias is supported, and approved data commands return a safe retry message when a read-only data reader fails.

## Production smoke test — ผ่านแล้ว

ผลการตรวจใน LINE group:

1. `เมนู`, `ขอตาราง`, `บอลวันนี้`, `ผลทาย` — ผ่านครบ
2. ข้อความทั่วไปที่ไม่ใช่ command — ไม่มีการตอบกลับ
3. แชร์ตารางจาก LIFF — ผ่าน
4. แชร์ผลทายเข้า LINE group — ผ่าน
5. logo/order, avatar, selected highlight, เวลาเตะ และปุ่มเปิดแอป — ผ่าน
6. กดปุ่ม Flex เพื่อเปิด LIFF endpoint — ผ่าน

## Mobile/LIFF regression — ผ่านแล้ว

ทดสอบใน LINE WebView และ Chrome Android ครบ login, prediction, lock message, dashboard, admin และ share flow — ผ่านทั้งหมด
