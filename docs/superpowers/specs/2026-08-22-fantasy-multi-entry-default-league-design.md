# Fantasy Multi-Entry Mapping และ Default League Design

วันที่: 2026-08-22
สถานะ: รอผู้ใช้ review

## เป้าหมาย

ปรับระบบ Fantasy ให้ LINE ID เดียวสามารถ Mapping กับ FPL Entry ID ได้หลายรายการในฤดูกาลเดียวกัน โดยแต่ละ Entry ยังคงเป็นทีมแยกกันสำหรับคะแนน อันดับ และ Awards พร้อมปรับหน้า Fantasy ให้เปิดลีก FPL ID `819498` เป็นค่าเริ่มต้น และยังสลับลีกได้จาก Dashboard

ขอบเขตนี้ไม่รวมการรวมคะแนนหลาย Entry เป็นคะแนนเดียวของผู้ใช้ LINE และไม่เปลี่ยนกติกาคะแนนจาก FPL

## กฎทางธุรกิจ

- 1 LINE ID สามารถ Mapping ได้หลาย FPL Entry ID ต่อ 1 ฤดูกาล
- 1 FPL Entry ID สามารถ Mapping กับ LINE ID ได้เพียง 1 คนต่อ 1 ฤดูกาล
- FPL Entry ID เดียวกันสามารถเป็นสมาชิกของหลายลีกได้
- Mapping 1 แถวแทน FPL team 1 ทีม ไม่ใช่ผู้ใช้ LINE แบบรวมยอด
- อันดับแสดงแยกตาม FPL Entry ID แม้หลายแถวจะเป็น LINE ID เดียวกัน
- คะแนนและ Awards คำนวณแยกตาม FPL Entry ID
- Mapping เดิมไม่ถูกลบหรือย้าย
- กฎคนละฤดูกาลไม่ชนกัน

## UX Flow

### การเปิดแอป

1. หน้า `/fantasy` โหลดรายชื่อลีก
2. เลือกลีก FPL ID `819498` เป็นค่าเริ่มต้น
3. โหลด Dashboard ของลีกเริ่มต้นทันที
4. ไม่แสดงหน้าจอแยกสำหรับ “เลือกลีกก่อนดูอันดับ”

### การสลับลีก

- Dashboard ยังคงมี league dropdown ตามรูปแบบปัจจุบัน
- ผู้ใช้สลับระหว่าง `เชยเชย Cup` และ `เขาค้อ inLove` ได้
- การเปลี่ยนลีกจะโหลดอันดับของลีกที่เลือกใหม่
- แท็บตารางคะแนน/สถิตินักเตะและตัวเลือก Gameweek ยังคงทำงานเหมือนเดิม
- สถิตินักเตะเป็นข้อมูลรวมจาก FPL และไม่เปลี่ยนตามลีก

### กรณีหลายทีมของ LINE ID เดียว

แต่ละทีมจะแสดงเป็นคนละแถว โดยใช้ชื่อทีมและ FPL Entry ID แยกกัน เช่น:

- Team A · FPL 1001
- Team B · FPL 1002

ชื่อผู้ใช้ LINE อาจเหมือนกันได้ แต่คะแนน อันดับ และ Awards ต้องแยกตาม Entry

### Fallback และ Error Handling

- หากลีก `819498` ไม่พร้อมใช้งาน ให้เลือก active league แรกเป็น fallback
- หากไม่มี active league ให้แสดงข้อความผิดพลาดที่เข้าใจง่าย
- หากโหลด Dashboard ล้มเหลว ให้แสดง error state และ retry โดยไม่ทำให้หน้าลีกเสียหาย

## Database Design

ตาราง `fantasy_entry_mappings` ยังคงใช้เป็น mapping ระหว่าง season, LINE user และ FPL Entry โดยเพิ่มความสามารถผ่าน migration ใหม่:

- ลบเฉพาะ partial unique index ที่บังคับ `(season_id, app_user_id)` สำหรับ active mappings
- คง partial unique index ที่บังคับ `(season_id, fpl_entry_id)` สำหรับ active mappings
- ไม่แก้ migration ที่ apply ไปแล้ว
- ไม่ลบหรือ duplicate ข้อมูล Mapping เดิม
- RLS, server-only grants และ policies คงเหมือนเดิม

ตาราง Fantasy league snapshots และ score tables ไม่ต้องเปลี่ยนโครงสร้าง เพราะใช้ FPL Entry ID เป็น identity อยู่แล้ว

## API และ Data Flow

### Mapping API

`POST /api/admin/fantasy/mappings`

- รับ LINE user และ FPL Entry ตามเดิม
- ตรวจว่า Entry อยู่ใน league membership snapshot
- อนุญาต LINE user เดิมที่ยังไม่มี mapping กับ Entry นั้น
- ปฏิเสธ Entry ที่ active mapping ให้ LINE user อื่นแล้ว

`GET /api/admin/fantasy/mappings`

- แสดง mapping rows ทุกแถว รวมถึงหลายแถวของ LINE user เดียว
- รายการ unmapped entries ยังคงกรอง Entry ที่ active mapping แล้วออก

### Fantasy Dashboard

- ใช้ `leagueId` เป็นตัวเลือกลีก
- ใช้ `fpl_entry_id` เป็นตัวระบุทีมในการสร้าง leaderboard
- ไม่ aggregate หลาย Entry ที่มี `app_user_id` เดียวกัน
- League membership, score และ mapping จะถูก join ตาม Entry ID

## Component Boundaries

ไฟล์หลักที่คาดว่าจะเกี่ยวข้อง:

- `app/fantasy/fantasy-app.tsx`: default league และ flow การโหลด Dashboard
- `lib/fantasy/repository.ts`: คง data flow ตาม Entry ID และตรวจสอบ mapping behavior
- `lib/api/admin-fantasy-handler.ts`: รองรับการสร้าง mapping หลาย Entry ให้ user เดิม
- `lib/fantasy/league-scoring.ts`: ยืนยันการจัดอันดับแยก Entry
- `supabase/migrations/`: migration ใหม่สำหรับ unique index
- `tests/fantasy/`, `tests/api/`: regression และ behavior tests

จะหลีกเลี่ยงการแก้ไฟล์ของระบบทายผลและ shared files ที่ไม่จำเป็น เพื่อไม่ชนกับงาน bug fix ของอีกแชท

## Testing Strategy

เพิ่มหรือปรับ automated tests สำหรับ:

- LINE ID เดียว Mapping ได้หลาย Entry ในฤดูกาลเดียวกัน
- Entry เดียว Mapping ให้หลาย LINE ID ไม่ได้
- Mapping ต่างฤดูกาลทำได้
- leaderboard แสดงหลาย Entry เป็นหลายแถว
- คะแนนของหลาย Entry ไม่ถูกรวมกัน
- หน้า Fantasy default เป็นลีก `819498`
- สลับลีกจาก Dashboard แล้วใช้ league ID ถูกต้อง
- fallback เมื่อ default league ไม่พร้อมใช้งาน
- ระบบทายผลเดิมยังผ่าน regression tests

ก่อนสรุปงานจะตรวจด้วย `npm.cmd test`, `npm.cmd run lint`, `npm.cmd exec -- tsc --noEmit`, `npm.cmd run build` และ `git diff --check`

## Deployment และความปลอดภัย

- ไม่แก้ข้อมูล Production ระหว่าง implementation โดยไม่ขออนุมัติ
- Migration Production ต้องขออนุมัติแยกก่อน apply
- ไม่เปิดเผย secret, token หรือ environment value
- ไม่ commit/push โดยไม่มีการอนุมัติที่ชัดเจน
- ต้องตรวจสอบว่า changes ของแชททายผลที่มีอยู่ไม่ถูกแก้หรือนำไปรวมโดยไม่ได้ตั้งใจ

## Self-review Checklist

- [x] ระบุ cardinality ของ LINE ID และ FPL Entry ชัดเจน
- [x] ระบุว่า leaderboard แยกทีม ไม่รวมผู้ใช้
- [x] ระบุ default league และการสลับลีกใน Dashboard
- [x] ระบุ fallback และ error handling
- [x] ระบุ migration ที่ไม่ลบข้อมูลเดิม
- [x] ระบุ test behavior และ regression checks
- [x] ไม่พบ TODO, TBD หรือ placeholder
- [x] ไม่รวม scope การ aggregate คะแนนหรือแก้ระบบทายผล
