# Project Status

อัปเดตล่าสุด: 28 กรกฎาคม 2026

## Current phase

### Phase 1 — UI/UX MVP

สถานะ: UX revision เสร็จใน mock/preview mode

เสร็จแล้ว:

- Landing page และ route `/dashboard`
- Mock ตารางคะแนน, เกมวีค, คู่แข่งขัน และผลการแข่งขัน
- 3 tabs: ตารางคะแนน, ทายผล, ผลแข่ง
- เปลี่ยน gameweek และเลือกคำทายได้ทันที
- Test, lint และ production build ผ่านก่อนรอบ UX revision
- Commit ก่อนหน้า: `bc26758`

เสร็จในรอบนี้:

- ใช้พื้นหลัง navy เดียวกับ Landing ทั้งแอป
- Bottom navigation แบบ fixed
- Player prediction detail modal
- ไฮไลท์ชื่อทีมฝั่งที่ผู้เล่นเลือกใน player detail
- Fixture prediction detail modal
- SVG club crests จาก Premier League resource
- ตัดกรอบขาวรอบ club crest
- Share confirmation popup หลังยืนยันคำทาย
- Lucide icons สำหรับ navigation, share, close และ success state
- LIFF auto-login gate ตั้งแต่ Landing พร้อม preview fallback
- Animation เฉพาะ loading, transition, modal และ save success
- Test helper สำหรับ player/fixture detail
- `@line/liff` SDK และ auto-login gate เมื่อมี `NEXT_PUBLIC_LIFF_ID`

## Routes

| Route | Purpose |
| --- | --- |
| `/` | LIFF entry gate + Landing |
| `/dashboard` | ตารางคะแนน, ทายผล, ผลการแข่งขัน |

## Environment variables

```env
NEXT_PUBLIC_LIFF_ID=
NEXT_PUBLIC_DEMO_MODE=true
```

`NEXT_PUBLIC_LIFF_ID` เป็นค่าที่ต้องสร้างจาก LINE Developers Console และเติมใน `.env.local`/Vercel ในรอบ integration จริง ห้าม commit ค่า secret หรือ token ลง Git

## Decisions

- Mobile-first และ max-width ประมาณ 520px เพื่อเหมาะกับ LINE WebView
- ใช้ client state สำหรับ tab/gameweek/selection ใน Phase 1 เพื่อให้เปลี่ยนข้อมูลทันที
- ใช้ system font และ SVG/image URLs เพื่อไม่ต้องดาวน์โหลด font ระหว่าง build
- Preview mode มีไว้สำหรับพัฒนาเท่านั้น; production ต้องตั้ง LIFF ID และใช้ auto-login

## Next phases

1. เชื่อม LIFF profile กับ Supabase user table และ RLS
2. เชื่อม FPL official API สำหรับ gameweeks, fixtures, results และ teams
3. เพิ่ม LINE Messaging API/Flex Message
4. ตั้งค่า Vercel environment และ deploy production

## Phase 2 — Approved Design

อัปเดตล่าสุด: 29 กรกฎาคม 2026

สถานะ: Design ผ่านการอนุมัติแล้ว; ยังไม่เริ่ม implementation

เอกสารหลัก: [FPL Phase 2 Backend Design](superpowers/specs/2026-07-29-fpl-phase-2-backend-design.md)

Decisions ที่ล็อกแล้ว:

- ใช้ฤดูกาลปัจจุบันก่อน โดย schema มี `season_id`
- ใช้ LIFF token + server session + server-only Supabase client
- ใช้ Vercel Free และ Google Apps Script เป็น external scheduler
- Apps Script ใช้ trigger ทุก 10 นาที แล้วเรียก Vercel sync endpoint ตามช่วงเวลา Asia/Bangkok
- ผลการแข่งขัน sync คืนวันเสาร์/อาทิตย์ 18:00–02:00 และวันธรรมดาหลัง 06:00 วันละครั้ง
- ตารางแข่งขัน sync อังคารและศุกร์หลัง 18:00
- ผู้ใช้ใหม่ผ่าน LIFF แล้วเข้า active season อัตโนมัติ
- มี `/admin` เฉพาะ admin คนเดียวที่ระบุด้วย `ADMIN_LINE_USER_ID`
- Exclude ผู้เล่นเฉพาะ gameweek โดยไม่ลบบัญชีหรือประวัติ และไม่รวม GW ที่ exclude ใน season total
- ทายถูก 3 คะแนน; ผิดหรือไม่ทาย 0 คะแนน
- แก้คำทายได้จนถึง kickoff และ server/database เป็นผู้ล็อกคำทาย
- Fixture ที่ postponed จะ void คำทายเดิม และให้ทายใหม่เมื่อถูกย้ายไป GW ใหม่
- GW เดิมคำนวณได้เมื่อไม่มี fixture scheduled/live เหลือ โดยไม่นับ fixture postponed
- คะแนนเท่ากันทุกคนได้สถานะแชมป์หรือบ๊วย และเก็บเป็น award แยกแถว

ถัดไป:

1. เขียน implementation plan แยกตาม subsystem หลังผู้ใช้ตรวจ Design document
2. อ่าน Next.js/Supabase/LINE documentation ที่เกี่ยวข้องก่อน implementation
3. สร้าง Supabase migration และ server data flow แบบ TDD
4. ตรวจข้อมูลจริงบน Supabase ก่อนสรุปงาน
