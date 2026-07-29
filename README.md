# FPL Chei Chei

เว็บทายผลพรีเมียร์ลีกสำหรับกลุ่มเพื่อนใน LINE สร้างด้วย Next.js App Router และ Tailwind CSS

## Phase 1 MVP

- Landing page ที่ `/` พร้อมทางเข้าเกมทายผลและเกมแฟนตาซีที่ยังไม่เปิด
- Dashboard ที่ `/dashboard` พร้อม 3 tabs: ตารางคะแนน, ทายผล, ผลการแข่งขัน
- เปลี่ยน gameweek ได้ทันทีจาก dropdown
- เลือกผลเหย้า/เสมอ/เยือน พร้อม confirmation modal
- หลังยืนยันคำทาย มี popup ถามแชร์ผลลงกลุ่ม LINE
- ใช้ Lucide icons และ SVG club crests แบบไม่มีกรอบขาว
- ใช้ mock data และ preview profile เพื่อให้ตรวจ flow ได้โดยไม่ต้องมี credentials
- รอบ UX revision จะเพิ่ม LIFF entry gate, bottom navigation, player/fixture detail modals และ SVG club crests

## Run locally

ต้องใช้ Node.js 20.9 ขึ้นไปตามคู่มือ Next.js ที่ติดตั้งในโปรเจกต์

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000` แล้วกดเข้า “ทายผลพรีเมียร์ลีก”

## Environment

คัดลอก `.env.example` เป็น `.env.local` ได้เมื่อจะเริ่มเชื่อม LIFF และ backend:

```env
NEXT_PUBLIC_LIFF_ID=
NEXT_PUBLIC_DEMO_MODE=true

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LINE_CHANNEL_ID=
SESSION_SECRET=
ADMIN_LINE_USER_ID=
FPL_API_BASE_URL=https://fantasy.premierleague.com
FPL_SYNC_TOKEN=
```

`NEXT_PUBLIC_*` เป็นค่าที่ถูก bundle ไปยัง browser จึงใช้ได้เฉพาะ LIFF ID และ demo flag เท่านั้น ห้ามใส่ Supabase service key, session secret, admin ID หรือ sync token ในตัวแปร public. ค่าที่เหลือเป็น server-only และต้องตั้งใน Vercel/`.env.local` โดยไม่ commit ค่า secret.

เมื่อยังไม่มีค่าฝั่ง server ให้ใช้ `NEXT_PUBLIC_DEMO_MODE=true` เพื่อดู Phase 1 preview เท่านั้น; preview mode ไม่อ่านหรือเขียน Supabase.

## Verification

```bash
npm run test
npm run lint
npm run build
```

## Phase 2 integration targets

1. เพิ่ม LIFF SDK และ login/profile sync โดยใช้ LINE user ID เป็นตัวระบุหลัก
2. สร้าง Supabase schema, RLS และ server-side data access
3. เพิ่ม FPL API adapter สำหรับ fixtures, results, gameweeks และ club crests
4. เพิ่ม LINE Messaging webhook และ Flex Message สำหรับแชร์ตาราง/ผลทาย
5. ตั้งค่า environment variables บน Vercel แล้ว deploy production

## Phase 2 approved design

Phase 2 ใช้ Vercel Free เป็น frontend/backend และใช้ Google Apps Script เป็น scheduler ภายนอกแทน Vercel Cron โดย Apps Script เรียก protected Vercel endpoint ทุก 10 นาทีตามช่วงเวลาที่กำหนดใน [Phase 2 backend design](docs/superpowers/specs/2026-07-29-fpl-phase-2-backend-design.md)

ระบบจริงจะใช้ LIFF identity, Supabase PostgreSQL, FPL sync, server-side prediction lock, scoring/recalculation และหน้า `/admin` สำหรับ admin คนเดียว. ผู้ใช้ใหม่เข้าฤดูกาลปัจจุบันอัตโนมัติ ส่วนการ exclude เป็นราย gameweek และไม่ลบประวัติ

ยังไม่เริ่ม implementation ของ Phase 2 จนกว่าจะตรวจสอบเอกสาร Design และสร้าง implementation plan เสร็จ
