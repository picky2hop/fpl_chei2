# Match Results LINE Share Design

## Goal

เพิ่มปุ่มแชร์ใน modal รายละเอียดแมตช์ของแท็บ `ผลการแข่งขัน` เพื่อส่งผลคำทายของแมตช์นั้นเข้า group chat ผ่าน LINE Share Target Picker โดย Flex bubble ต้องแสดงข้อมูลและ visual language เดียวกับรายละเอียดในแอปและภาพอ้างอิง

งานนี้เป็น UI/LINE presentation change เท่านั้น ไม่เปลี่ยนกติกาคะแนน, prediction flow, API contract, Supabase schema/data, LIFF configuration, environment variables หรือ production data

## Approved behavior

1. ผู้ใช้เปิดแท็บ `ผลการแข่งขัน`
2. ผู้ใช้แตะ match card เพื่อเปิด `FixtureDetail` modal เดิม
3. ผู้ใช้กดปุ่ม `แชร์ผลทายเข้า LINE` ที่ด้านล่างของรายละเอียดคนทาย
4. ระบบใช้ข้อมูล dashboard ที่โหลดอยู่แล้ว ได้แก่ fixture, prediction percentages, leaderboard entries และ `predictionBookByGameweek`
5. ระบบสร้าง Flex bubble สำหรับแมตช์เดียวและเปิด `liff.shareTargetPicker` ผ่าน `shareFlexMessage` เดิม
6. เมื่อแชร์สำเร็จ modal ยังคงเปิดและแสดงสถานะสำเร็จ
7. เมื่อยกเลิกหรือเกิดข้อผิดพลาด modal ยังคงเปิด แสดงข้อความที่เหมาะสม และให้ลองใหม่ได้
8. ระหว่างกำลังเปิด LINE ปุ่มแชร์ถูก disable เพื่อป้องกันการกดซ้ำ

## Architecture and scope

### UI component

ปรับ `app/components/prediction-app-final.tsx` ดังนี้:

- เพิ่ม state สำหรับ fixture share status โดยผูกกับ fixture ที่กำลังเปิด
- เพิ่ม callback สำหรับสร้างและแชร์ Flex ของ selected fixture
- ใช้ predictor list ชุดเดียวกับที่ `FixtureDetail` แสดง เพื่อป้องกันข้อมูลใน modal กับ Flex ไม่ตรงกัน
- เพิ่มปุ่มแชร์ใน `FixtureDetail`
- เพิ่ม inline status/error โดยใช้ `role="status"` สำหรับ success และ `role="alert"` สำหรับ error
- reset share status เมื่อเปลี่ยน gameweek, ปิด modal หรือเปิด fixture อื่น

ไม่เปลี่ยน behavior ของการเปิด fixture modal, การคำนวณเปอร์เซ็นต์ หรือการบันทึก prediction

### Flex payload

เพิ่ม builder สำหรับรายละเอียดคำทายของแมตช์เดียวใน `lib/line/flex.ts` และ wrapper ที่รับ domain data ใน `lib/line/share-payload.ts`

Builder ต้อง:

- สร้าง Flex bubble เดียว
- ใช้ helper เดิมสำหรับ team logo, avatar fallback, footer app button และ validation
- รองรับทีม, crest, kickoff date/time, status/score, prediction percentages และ predictor rows
- จัดกลุ่ม predictor เป็น `home`, `draw`, `away`
- แสดง empty state เมื่อกลุ่มใดไม่มีคนเลือก
- ใช้เวลาเขต `Asia/Bangkok` และ fallback `dateLabel` เมื่อ kickoff ไม่ถูกต้อง
- แปลง Premier League badge SVG เป็น PNG ตาม helper เดิม และไม่ส่ง SVG เข้า LINE
- แบ่ง nested box เมื่อรายชื่อมีจำนวนมาก เพื่อให้ทุก box อยู่ในข้อจำกัดของ Flex
- ปล่อยให้ validation เดิมจัดการกรณี payload ใหญ่เกินไปหรือ schema ไม่ถูกต้อง

Input ของ builder จะเป็นข้อมูล presentation ที่สร้างจาก selected fixture และ predictor list ไม่ใช่การอ่านข้อมูลใหม่จาก Supabase

## Flex visual design

โครงสร้าง bubble:

1. Match header
   - ชื่อและโลโก้ทีมเหย้า/ทีมเยือน
   - `VS` สำหรับเกมที่ยังไม่จบ หรือ score เมื่อ finished
   - วันและเวลาเตะใน Bangkok timezone

2. Prediction groups
   - pill `เหย้า`, `เสมอ`, `เยือน`
   - percentage ของแต่ละฝั่ง
   - predictor row พร้อม avatar, display name และ choice badge
   - สีสอดคล้องกับแอป: home `#ff647c`, draw `#47d7a0`, away `#6da9ff`
   - empty state สี muted เมื่อไม่มีคนเลือก

3. Footer
   - ปุ่ม `เปิดแอป FPL Chei Chei`
   - ใช้ LIFF URI และ footer treatment เดิม

`altText` ต้องระบุว่าเป็นผลคำทายของแมตช์และ gameweek เพื่อให้สื่อความหมายเมื่อ Flex ไม่ถูก render

## Interaction and error handling

สถานะที่ต้องรองรับ:

- `idle`: ปุ่มพร้อมใช้งาน
- `sharing`: ปุ่ม disabled และแสดง `กำลังเปิด LINE…`
- `shared`: แสดงข้อความสำเร็จใน modal
- `cancelled`: แสดงว่ายกเลิกการแชร์และยังลองใหม่ได้
- `SHARE_TARGET_PICKER_UNAVAILABLE`: แนะนำให้เปิดผ่าน LINE WebView
- `FLEX_MESSAGE_TOO_LARGE`: แจ้งว่าเนื้อหามากเกินไปสำหรับ LINE
- `FLEX_MESSAGE_INVALID`: แจ้งว่าไม่สามารถสร้างรูปแบบแชร์ได้
- error อื่น: ใช้ข้อความ fallback ที่ไม่เปิดเผยข้อมูลภายในหรือ secret

การ share สำเร็จหรือยกเลิกต้องไม่เปลี่ยน prediction state และไม่ทำให้เกิด database write เพิ่ม

## Accessibility and responsive requirements

- ปุ่มแชร์ต้องรองรับ keyboard และ focus-visible style เดิม
- มีพื้นที่กดเหมาะกับ mobile
- ใช้ `aria-busy` ระหว่าง sharing
- ใช้ live status/error roles ตามสถานะ
- คง accessible label ของ modal เดิม แม้ซ่อน title สีขาวใน match detail modal
- mobile ใช้ modal แบบ bottom sheet และปุ่มแชร์เต็มความกว้าง
- tablet/desktop คง modal max-width เดิมและจัดวางกึ่งกลาง
- ชื่อทีมและชื่อผู้เล่นยาวต้อง wrap หรือ truncate อย่างปลอดภัยโดยไม่ทำให้ Flex invalid

## Tests and verification

เพิ่ม unit tests ใน:

- `tests/line/flex.test.mts`
  - match header, team assets, Bangkok date/time และ score/VS
  - prediction groups, percentages, predictor avatar/name/badge
  - empty groups
  - single bubble, footer app action และ Flex validation
  - long predictor list และ SVG-to-PNG conversion
- `tests/line/share-payload.test.mts`
  - wrapper maps fixture and predictor data correctly
  - existing personal prediction share behavior remains unchanged

ก่อนสรุปงานต้องรัน:

- `npm.cmd test`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`

ต้องตรวจด้วยตนเองบน mobile, tablet และ desktop รวมถึง share success, cancel, unavailable picker, invalid payload และ retry

## Files in scope

- `app/components/prediction-app-final.tsx`
- `lib/line/flex.ts`
- `lib/line/share-payload.ts`
- `tests/line/flex.test.mts`
- `tests/line/share-payload.test.mts`

ไม่อยู่ใน scope:

- Supabase schema หรือ production data
- API route contract
- LIFF ID, LINE configuration หรือ environment variables
- scoring/business rules
- unrelated files and existing user changes
