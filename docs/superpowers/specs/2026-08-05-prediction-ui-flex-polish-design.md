# Prediction UI and Flex Polish Design

## Goal

ปรับประสบการณ์หน้าทายผลและ Flex ผลทายให้ตรงกับภาพอ้างอิง โดยลบข้อความสำเร็จซ้ำหลังจบ flow แชร์ จัดวางทีมให้สม่ำเสมอ จัดกลุ่มคู่แข่งตามวันและเวลาเตะ และลดหัวข้อที่ไม่ต้องการใน popup รายละเอียดผลแข่ง

## Approved behavior

### 1. Remove the post-share saved toast

- คง `SharePrompt` หลังบันทึกคำทายไว้ เพื่อให้ผู้ใช้เลือกแชร์เข้า LINE หรือไม่แชร์ได้
- เมื่อผู้ใช้เลือกแชร์สำเร็จ ยกเลิกการแชร์ หรือกดไม่แชร์ ให้ปิด `SharePrompt` และไม่แสดง toast ด้านล่างซ้ำ
- ลบ state, handler และ markup ของ toast ที่แสดงข้อความ `บันทึกคำทาย {x}/{y} คู่ แล้ว`
- ไม่เปลี่ยน behavior การบันทึกคำทายหรือข้อความ error ของการแชร์

### 2. Align team layout on the prediction page

- แก้เฉพาะ `FixturePredictionCard` ในหน้าทายผล
- ทั้งทีมเหย้าและทีมเยือนใช้ลำดับแนวตั้งเดียวกัน: โลโก้ด้านบน ชื่อทีมด้านล่าง
- คงปุ่มเลือกผล สี สถานะการแข่งขัน และ layout ของหน้าผลแข่ง/รายละเอียดแมตช์ไว้เหมือนเดิม

### 3. Group prediction-result Flex fixtures by Bangkok date and kickoff time

- ใช้ `kickoffAt` เป็นแหล่งข้อมูลหลัก และแสดงวันที่/เวลาในเขตเวลา `Asia/Bangkok`
- แสดงกลุ่มวันที่ก่อน จากนั้นแบ่งเป็นกลุ่มเวลาเตะภายในวันนั้น
- แสดงเวลาเตะอยู่เหนือคู่แข่งขัน เช่น `02:00 · 2 คู่`
- คู่ที่มีวันและเวลาเตะเดียวกันต้องอยู่ในกลุ่มเวลาเดียวกัน
- เรียงกลุ่มวันและกลุ่มเวลาตามเวลาเตะจากเร็วไปช้า และรักษาลำดับคู่ภายในกลุ่มตาม input
- รองรับ fixture ที่ไม่มีหรือมี `kickoffAt` ไม่ถูกต้องด้วย fallback เดิมของวันที่ และ label เวลา fallback ที่ชัดเจน โดยไม่ทำให้ Flex invalid
- คงรูปแบบ bubble เดียว, profile card, team assets, choice colors, selected-side highlight และ action behavior เดิม

ตัวอย่างโครงสร้างที่ต้องการ:

```text
เสาร์ 19 กันยายน 2569
02:00 · 2 คู่
คู่ที่ 1
คู่ที่ 2
18:30 · 1 คู่
คู่ที่ 3
```

### 4. Remove the white match title from the results detail modal

- เฉพาะ modal ที่เปิดจากหน้าผลแข่ง ให้ซ่อน title สีขาว เช่น `Arsenal vs Coventry City`
- คง eyebrow `MATCH DETAILS`, ปุ่มปิด, ข้อมูลทีม และรายชื่อคนทายไว้
- modal รายละเอียดผู้เล่นและ modal บันทึกคำทายยังแสดง title ตามเดิม
- รักษาความสามารถในการเข้าถึงของ dialog ด้วย accessible label ที่ใช้ title เดิมหรือ eyebrow เป็น fallback

## Architecture and scope

- ปรับ UI flow ใน `app/components/prediction-app-final.tsx` โดยนำ saved-toast state/render ออก และจัด layout ของ `FixturePredictionCard` ใหม่
- เพิ่มความสามารถซ่อน title แบบเลือกใช้ได้ใน `app/components/detail-modal.tsx` แล้วเปิดใช้เฉพาะ selected-fixture modal
- ปรับ helper/group builder ใน `lib/line/flex.ts` ให้แยก date grouping และ kickoff-time grouping โดยไม่เปลี่ยน input contract ของ `buildPredictionResultFlex`
- ขยาย unit tests ใน `tests/line/flex.test.mts` ให้ตรวจว่าคู่เวลาเดียวกันถูกรวมกลุ่ม และเวลาถูกวางเหนือ fixture rows
- ไม่เปลี่ยน Supabase schema/data, API contract, LINE configuration, LIFF URL, fixture source หรือ share transport

## Verification

ต้องตรวจสอบด้วยคำสั่งต่อไปนี้ก่อนสรุปงาน:

- `npm.cmd run test`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

การตรวจสอบต้องยืนยันเพิ่มเติมว่า:

- ไม่มีการ render saved toast เดิมหลังเลือกแชร์หรือไม่แชร์
- หน้าทายผลแสดงชื่อทีมทั้งสองทีมใต้โลโก้
- Flex มี date groups และ time groups ตาม `Asia/Bangkok`
- modal ผลแข่งไม่มี white match title แต่ modal อื่นยังมี title
