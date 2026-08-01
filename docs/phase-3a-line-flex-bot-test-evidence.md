# Phase 3A — LINE Flex/Bot test evidence

สถานะเอกสารนี้เป็นหลักฐานจาก local verification ของ implementation batch ปัจจุบันเท่านั้น ยังไม่ใช่ผล production smoke test หลัง deploy

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
- app prediction/results/player detail/fixture detail ใช้ลำดับทีมเดียวกัน
- avatar initials แสดงเฉพาะเมื่อไม่มี avatar URL

## Automated evidence

- `npm.cmd run test` → 69 tests passed, 0 failed
- `npm.cmd run lint` → passed
- `npm.cmd run build` → passed
- `git diff --check` → passed
- no Supabase write or fixture mutation was performed for this batch

## Production smoke test pending review/deploy

หลัง review และ deploy ให้ตรวจใน LINE test group โดยไม่บันทึก user ID, raw payload, signature หรือ secret:

1. ส่ง `เมนู`, `ขอตาราง`, `บอลวันนี้`, `ผลทาย`
2. ส่งข้อความทั่วไปที่ไม่ใช่ command และยืนยันว่าไม่มี reply
3. กดแชร์ตารางจาก LIFF และแชร์ผลทายหลังบันทึกคำทาย
4. ตรวจ logo/order, avatar, selected highlight, เวลาเตะ และปุ่มเปิดแอป
5. ทดสอบกดปุ่ม Flex เพื่อเปิด LIFF endpoint
