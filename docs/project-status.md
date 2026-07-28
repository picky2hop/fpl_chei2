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
- Fixture prediction detail modal
- SVG club crests จาก Premier League resource
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
