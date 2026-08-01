# LINE Flex Commands and Avatar Fix Design

**Date:** 2026-08-01

**Status:** Approved by user for implementation planning

## Goal

ทำให้ LINE Bot ตอบเฉพาะคีย์เวิร์ดที่กำหนดด้วยข้อมูลจริงจาก Supabase, ทำ Flex Message สำหรับตารางคะแนน/บอลวันนี้/ผลทายให้ใช้ visual language เดียวกับแอป, เชื่อมปุ่มเปิด LIFF ในทุก Flex และแก้ initials ที่ซ้อนทับบนรูป avatar ในแอป

## Scope

อยู่ใน scope รอบนี้:

- Flex ตารางคะแนนจากข้อมูลจริง
- Flex โปรแกรมบอลวันนี้จากข้อมูลจริง
- Flex ผลทายจากข้อมูลจริง
- ปุ่ม `เปิดแอป FPL Chei Chei` ด้านล่างของทุก Flex
- ปุ่มแชร์ตารางคะแนนในแอปต้องเรียก `shareTargetPicker` จริง
- LINE Bot command routing สำหรับคีย์เวิร์ดที่กำหนด
- อ่านข้อมูลผ่าน server-only Supabase access layer โดยไม่แก้ข้อมูล production
- แก้ avatar fallback ไม่ให้แสดง initials ทับรูปที่โหลดสำเร็จ
- automated tests, lint, build และ production smoke-test evidence

นอก scope:

- group ID allowlist
- push, multicast, narrowcast หรือ broadcast
- การแก้ schema/migration ของ Supabase หากไม่จำเป็น
- การแก้ fixture จริงเพื่อสร้างสถานะทดสอบ
- การทำภาพ branding หรือ animation เพิ่มเติม

## Visual design

ใช้สีเดียวกับแอปปัจจุบัน:

- Main background: `#071525`
- Card/background block: `#10253A`
- Primary accent: `#D9FF58`
- Muted text: `#8CA6BD`
- Primary text: `#FFFFFF`
- Success/highlight: `#47D7A0`
- Prediction highlight: `#D9FF58` with a dark text label

ทุก Flex ต้องมี footer button แบบ URI action ที่เปิด `https://fpl-chei2.vercel.app/` และมี label `เปิดแอป FPL Chei Chei` ปุ่มต้องอยู่ด้านล่างของ bubble หรือทุก bubble ใน carousel ที่ใช้แบ่งข้อมูล

## Flex 1: ตารางคะแนน

หัวข้อแสดง `ตารางคะแนน GW {number}` และรายการแต่ละแถวต้องแสดงตามลำดับ:

1. อันดับ
2. รูปผู้ใช้แบบวงกลม
3. ชื่อผู้ใช้
4. คะแนน

ถ้า avatar URL ไม่มีหรือใช้ไม่ได้ ให้แสดง fallback ที่ไม่ซ้อนทับบนรูป ผู้ใช้ที่มีรูปต้องเห็นเฉพาะรูปจริง

ข้อมูลเกินความสูงที่อ่านง่ายให้แบ่งเป็น carousel bubbles โดยคงรูปแบบแถวและ footer action เดิมทุก bubble ไม่ตัดรายชื่อหรือคะแนนทิ้งเงียบ ๆ

## Flex 2: บอลวันนี้

หัวข้อแสดง `บอลวันนี้` และวันที่ไทย รายการแต่ละคู่ต้องจัดวางแบบนี้เสมอ:

```text
ชื่อทีมเหย้า + โลโก้ทีมเหย้า    เวลา/สถานะ    โลโก้ทีมเยือน + ชื่อทีมเยือน
```

ชื่อทีมเหย้าต้องอยู่ก่อนโลโก้เหย้า และโลโก้ทีมเยือนต้องอยู่ก่อนชื่อทีมเยือน ตามข้อกำหนดของผู้ใช้

แสดงเวลาเตะใน `Asia/Bangkok`; ถ้าเริ่มแข่งแล้วให้แสดงสถานะที่เหมาะสม เช่น `LIVE` หรือผลการแข่งขันจริงตามข้อมูลที่มี ถ้าไม่มีคู่ในวันนั้นให้แสดง `วันนี้ไม่มีการแข่งขัน`

## Flex 3: ผลทาย

ส่วนหัวต้องแสดง:

- รูปผู้ทาย
- ชื่อผู้ทาย
- `ผลทาย GW {number}`

แต่ละคู่ต้องจัดวางทีมตามลำดับเดียวกัน:

```text
ชื่อทีมเหย้า + โลโก้ทีมเหย้า    VS    โลโก้ทีมเยือน + ชื่อทีมเยือน
```

ผลที่ผู้ทายเลือกต้องใช้ highlight สี `#D9FF58`:

- `home`: highlight ฝั่งชื่อ+โลโก้ทีมเหย้า
- `away`: highlight ฝั่งโลโก้+ชื่อทีมเยือน
- `draw`: highlight ป้าย `เสมอ` ตรงกลาง

ทุกคู่ต้องแสดงชื่อทีมและโลโก้ ไม่ใช้ข้อความรวมแบบ `ทีม A vs ทีม B` เป็นแถวเดียวอีกต่อไป

## Match display consistency in the app

กติกาลำดับชื่อ/โลโก้นี้ใช้กับจุดแสดงคู่แข่งขันในหน้าแอปด้วย ไม่จำกัดเฉพาะ Flex:

- prediction cards: `ชื่อเหย้า + โลโก้เหย้า` และ `โลโก้เยือน + ชื่อเยือน`
- results cards: ใช้ลำดับเดียวกันทั้งสองฝั่ง
- fixture detail modal: ใช้ลำดับเดียวกันทั้งสองฝั่ง
- player prediction detail: แสดงชื่อและโลโก้ของทั้งสองทีม พร้อม highlight ผลที่เลือก

การแก้ layout ต้องไม่เปลี่ยนข้อมูลคะแนน, สถานะการแข่งขัน, prediction choice หรือ interaction เดิมของจุดเหล่านี้

## Bot commands

การจับคำสั่งจะ trim whitespace, normalize case และ match แบบ exact alias ไม่ใช้ partial match เพื่อไม่จับข้อความทั่วไปโดยไม่ตั้งใจ

| Alias | Response |
|---|---|
| `ขอตาราง`, `ตารางคะแนน`, `คะแนน`, `อันดับ` | ตารางคะแนน GW ปัจจุบันแบบ Flex |
| `บอลวันนี้`, `โปรแกรมบอล`, `คู่วันนี้` | โปรแกรมบอล FPL ของวันนี้แบบ Flex |
| `ผลทาย`, `คำทาย` | ผลทายของผู้ส่งข้อความแบบ Flex |
| `เมนู`, `ช่วย`, `คำสั่ง` | ข้อความรายการคำสั่งที่รองรับ |

ข้อความที่ไม่ตรง alias จะไม่ถูกประมวลผลและไม่ส่ง reply เพื่อให้ Bot จับเฉพาะข้อความที่ต้องการ ผู้ส่งที่ใช้ `ผลทาย` ต้องมี `event.source.userId` ที่ map กับ `app_users.line_user_id`; ถ้าไม่พบ ให้ตอบข้อความปลอดภัยที่แนะนำให้เปิด LIFF ก่อน โดยไม่เปิดเผยรายละเอียดฐานข้อมูลหรือ secret

## Data flow

1. Webhook ตรวจ raw-body signature ตาม implementation เดิม
2. Webhook ส่ง text event เข้า pure command router
3. Router คืน command หรือ `null` โดยไม่แตะ Supabase
4. Server command handler ใช้ `event.source.userId` เฉพาะคำสั่งที่ต้องระบุตัวผู้ใช้
5. Server-only data layer อ่าน active season/gameweek, teams, fixtures, users, predictions และ scores จาก Supabase
6. Flex builders รับ serializable DTO ที่เตรียมแล้วและไม่รู้จัก Supabase หรือ secret
7. Webhook reply ส่ง text หรือ Flex ผ่าน LINE reply API

ไม่มี schema change ใน design นี้ เว้นแต่การตรวจ code/schema ระหว่าง implementation พบว่าข้อมูลที่จำเป็นไม่มีอยู่จริง; หากพบ จะหยุดเสนอ migration แยกก่อนทำ

## LIFF share flow

- ปุ่มแชร์ตารางคะแนนใน `Leaderboard` จะสร้าง standings DTO จาก gameweek/mode ที่กำลังดู
- เรียก `shareTargetPicker` ผ่าน adapter เดิม
- แยกผลลัพธ์ `shared`, `cancelled`, unavailable และ unexpected failure ด้วยข้อความไทยที่ไม่เปิดเผย secret
- ปุ่มแชร์ผลทายเดิมต้องใช้ Flex layout ใหม่ที่มีทีม+โลโก้และ highlight

## Avatar fix

แก้ทั้ง `Avatar` ใน Dashboard และ avatar ขนาดเล็กใน Landing page:

- ถ้ามี `avatarUrl`: render รูปเท่านั้น
- ถ้าไม่มี `avatarUrl`: render initials fallback
- ห้าม render initials layer พร้อมกับรูปที่มี URL

## Error handling

- Supabase read failure: reply ข้อความทั่วไป เช่น `ตอนนี้โหลดข้อมูลไม่ได้ครับ ลองใหม่อีกครั้ง`
- Unknown user for `ผลทาย`: reply `กรุณาเปิดแอป FPL Chei Chei ก่อน เพื่อเชื่อมบัญชี LINE`
- No fixtures today: Flex empty state
- No predictions: Flex empty state
- Invalid/expired image URL: fallback initials or omitted image without failing the whole Flex
- No error response may contain channel secret, access token, Supabase key, session secret, raw webhook body หรือ internal database error

## Acceptance criteria

- ตารางคะแนน Flex แสดงอันดับ รูป ชื่อ และคะแนนจากข้อมูลจริง และมีปุ่มเปิด LIFF
- บอลวันนี้ Flex แสดงเวลา ทีมเหย้า+โลโก้เหย้า และโลโก้เยือน+ชื่อทีมเยือนจากข้อมูลจริง
- ผลทาย Flex แสดงผู้ทาย รูป ชื่อ ทีม+โลโก้ และ highlight ตามผลที่เลือก
- ทุกจุดที่แสดงคู่แข่งขันใช้ลำดับชื่อ/โลโก้ตามข้อกำหนดนี้
- จุดแสดงคู่แข่งขันในแอปทุกจุดใช้ลำดับเดียวกันและยังเปิด detail/selection ได้เหมือนเดิม
- ปุ่มแชร์ตารางคะแนนเรียก `shareTargetPicker` จริง
- Bot ตอบเฉพาะ aliases ที่กำหนด
- Avatar ที่มีรูปไม่แสดง initials ทับรูป
- Unit tests ตรวจ payload structure, action URI, team ordering, highlight และ command routing
- `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build` และ `git diff --check` ผ่านก่อนสรุป
- Manual evidence แยกเป็น Bot command, LIFF share, Flex rendering และ avatar regression

## References

- [LINE Flex Messages](https://developers.line.biz/en/docs/messaging-api/using-flex-messages/)
- [LINE Flex Message reference](https://developers.line.biz/en/reference/messaging-api/nojs/)
- [LINE actions](https://developers.line.biz/en/docs/messaging-api/actions/)
