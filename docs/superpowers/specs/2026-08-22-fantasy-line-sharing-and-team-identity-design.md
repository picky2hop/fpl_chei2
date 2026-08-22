# Fantasy LINE Sharing and Team Identity Design

## Goal

ปรับหน้า Fantasy ให้แสดงชื่อทีมอ่านง่ายขึ้น และเพิ่มการแชร์ leaderboard, player stats และทีมของ Entry ผ่าน LINE LIFF โดยยังใช้ข้อมูลและ shareTargetPicker flow เดิม และไม่เพิ่มตารางฐานข้อมูล

## Approved behavior

- Leaderboard แสดงชื่อผู้จัดการด้วยขนาดเดิม และแสดง `ชื่อทีม : <ชื่อทีม>` เป็นสีเขียว
- Leaderboard ไม่แสดง FPL Entry ID หรือข้อความ mapping ในบรรทัดทีม
- ปุ่มแชร์ leaderboard แชร์รายการที่กำลังดูอยู่: GW ที่เลือก หรือทั้งฤดูกาลของ GW ที่เลือก
- Player stats ใช้ dropdown สำหรับหมวดหมู่และตำแหน่ง และแชร์ผลลัพธ์ตามตัวกรองปัจจุบัน
- Current-squad popup มีปุ่มแชร์ทีมของ Entry ที่กำลังเปิดอยู่
- ทีมที่แชร์จัดเป็นการ์ดขนาดกะทัดรัด 5 แถว GK, DEF, MID, FWD และตัวสำรอง เพื่อให้เหมาะกับมือถือ
- Popup แสดงรูป LINE ของผู้จัดการที่ mapping แล้ว โดยใช้ `avatarUrl` จาก leaderboard; ผู้ที่ยังไม่ mapping ใช้ fallback initials
- แชร์ผ่าน LIFF `shareTargetPicker`; การแชร์ที่ถูกยกเลิกหรือใช้จาก browser ที่ไม่รองรับต้องมีข้อความภาษาไทยที่ปลอดภัย
- ใช้ข้อมูลที่โหลดอยู่ในหน้าเป็น source ของ payload การแชร์ ไม่สร้าง write ใหม่ใน Supabase

## Architecture

เพิ่ม pure share-payload builders ใน `lib/fantasy/fantasy-share-payload.ts` สำหรับ leaderboard, player stats และ current squad โดยคืน Flex message ที่ผ่าน `shareFlexMessage` ได้ทันที การสร้าง payload แยกจาก React เพื่อให้ทดสอบการเลือก period, filter, captain multiplier, row order และการตัด Entry ID ได้โดยไม่ต้อง render UI

`app/fantasy/fantasy-app.tsx` จะเรียก shareTargetPicker ตาม pattern ของ prediction app เดิม เพิ่มสถานะ loading/success/error แยกตามพื้นที่ และส่ง `avatarUrl` จาก leaderboard เข้า selected-entry state เพื่อใช้ใน popup ไม่มี endpoint หรือ schema ใหม่

## UI and data flow

1. ผู้ใช้เลือก league และ GW ตาม flow เดิม
2. Leaderboard ใช้ mode เดิม (`gameweek`/`season`) และปุ่มแชร์ใช้ entries ชุดเดียวกับที่แสดงบนหน้าจอ
3. Player stats ใช้ category/position state เดิม แต่เปลี่ยน controls เป็น native dropdown และแชร์ `visiblePlayerStats(...)` ชุดเดียวกับที่แสดง
4. ผู้ใช้กดแถว leaderboard เพื่อเปิด popup; selected entry เก็บ `avatarUrl` เพิ่มจากข้อมูล row เดิม
5. Popup แสดง avatar LINE และปุ่มแชร์เมื่อ squad load สำเร็จ; payload ใช้ GW, formation, 5 rows และคะแนนที่ผ่าน `playerDisplayPoints`

## Flex constraints

- ทุก URL รูปต้องเป็น HTTPS และใช้ helper/validation เดิม
- จำกัดรายการในแต่ละ bubble ให้เหมาะกับมือถือและแบ่งข้อมูล leaderboard เป็นหน้าตาม helper เดิม
- ไม่ใส่ FPL Entry ID ในข้อความที่ผู้ใช้เห็นหรือ payload ที่แชร์
- กรณีไม่มีรูป ใช้ initials/fallback ไม่ทำให้ Flex invalid

## Testing

- เพิ่ม tests สำหรับ payload builders ทั้งสามชนิด
- เพิ่ม tests ยืนยัน leaderboard period และ points, player-stat filters, squad five-row order และ captain x2
- เพิ่ม tests ยืนยันทีม mapping แล้วส่ง avatar URL และ mapping ไม่แล้วใช้ fallback
- เพิ่ม tests สำหรับ shareTargetPicker success, cancelled และ unavailable/error
- รัน test, lint, build และ `git diff --check` ก่อนสรุปงาน

## Non-goals

- ไม่เพิ่มหรือลบตาราง Supabase
- ไม่เปลี่ยนกฎคะแนน, ranking, mapping หรือการ refresh squad
- ไม่แก้ระบบทายผลเดิมนอกจาก reuse share helper ที่มีอยู่แล้ว
