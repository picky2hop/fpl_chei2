# Prompt สำหรับแชทใหม่ — LINE Flex Message และ Bot

คัดลอกข้อความด้านล่างไปเริ่มแชทใหม่:

```text
ผมต้องการดำเนินการต่อจาก Phase 3A — Pre-season hardening ของโปรเจกต์ Fantasy Premier League Prediction App

Repository:
C:\Users\picky\Desktop\fpl_chei2

Production:
- Vercel: https://fpl-chei2.vercel.app
- LIFF Endpoint: https://fpl-chei2.vercel.app/
- Git branch: main
- Latest application commit: bc9f9e7
- ห้าม commit/push จนกว่าผมจะ review และอนุมัติ

สถานะที่ยืนยันแล้ว:
- LIFF login ใช้งานได้
- app_users มี 1 row
- gameweek_participants มี 38 rows
- fixtures มี 380 rows
- predictions มี 20 rows
- prediction_events มี 90 rows
- Dashboard อ่านข้อมูลจริงผ่าน server API
- /admin เข้าได้ด้วย ADMIN_LINE_USER_ID
- Manual sync อัปเดต fixtures 380 รายการแล้ว
- Google Apps Script scheduler ทำงานและมี job_runs สำเร็จ
- prediction lock หลัง kickoff ระดับ database ผ่านด้วย error code 55P03 โดยใช้ transaction rollback
- npm.cmd run test: 40 tests passed
- npm.cmd run lint: passed
- npm.cmd run build: passed
- git diff --check: passed

งานแรกที่ต้องทำ:
ทดสอบระบบแชร์ผลลงกลุ่ม LINE ด้วย Flex Message และทดสอบ LINE Bot

ขอบเขตที่ต้องแยกให้ชัด:
1. user-initiated share จาก LIFF ด้วย shareTargetPicker
2. LINE Messaging API webhook/reply
3. bot push หรือ broadcast หากจำเป็นและได้รับอนุมัติ
4. Flex Message สำหรับผลทายและ/หรือตารางคะแนน

ข้อกำหนดการทำงาน:
- ใช้ supabase:supabase สำหรับงาน Supabase ทุกครั้ง
- ใช้ superpowers:brainstorming ก่อนแก้หรือเพิ่ม behavior
- ใช้ superpowers:systematic-debugging หากพบปัญหา
- ใช้ superpowers:test-driven-development ก่อนแก้ code
- ใช้ superpowers:verification-before-completion ก่อนสรุปผล
- ใช้ npm.cmd บน Windows
- เริ่มจากตรวจ read-only และอ่านโค้ดปัจจุบันก่อน
- ห้ามขอหรือรับ secret ผ่านแชท
- ห้ามใส่ LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, FPL_SYNC_TOKEN, SESSION_SECRET หรือ Supabase key ใน Git/เอกสาร/แชท
- หาก configuration หรือสิทธิ์ LINE ยังไม่พร้อม ให้บอกขั้นตอนที่ผมต้องทำใน LINE Developers Console โดยไม่ขอค่า secret
- ห้ามแก้ fixture จริงค้างไว้เพื่อทดสอบ
- ห้าม reset --hard หรือลบข้อมูล
- ห้าม commit/push จนกว่าผมจะอนุมัติ

เริ่มด้วย:
1. ตรวจสถานะ git และ diff เดิมแบบ read-only
2. ตรวจว่าปัจจุบันปุ่มแชร์และ LINE integration มี implementation จริงแค่ไหน
3. ตรวจเอกสาร design ที่เกี่ยวข้องใน docs/superpowers/specs/2026-07-29-fpl-phase-2-backend-design.md
4. เสนอ test plan และ design สั้น ๆ ให้ผมอนุมัติก่อน implementation
5. หลังอนุมัติ ค่อยเขียน failing tests แล้ว implement ขั้นต่ำ

เป้าหมายการทดสอบ:
- สร้าง payload Flex ที่ตรวจสอบได้ด้วย unit test
- ทดสอบ shareTargetPicker ใน LIFF/LINE WebView
- ทดสอบ webhook signature และ reply/push ใน test group หรือ channel ที่กำหนด
- ตรวจว่า failure แสดงข้อความที่เข้าใจได้และไม่เปิดเผย secret
- สรุปหลักฐานการทดสอบแยกเป็น LIFF share, Bot webhook และ Bot push/broadcast
```
