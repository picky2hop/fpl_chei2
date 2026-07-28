# FPL Chei Chei

เว็บทายผลพรีเมียร์ลีกสำหรับกลุ่มเพื่อนใน LINE สร้างด้วย Next.js App Router และ Tailwind CSS

## Phase 1 MVP

- Landing page ที่ `/` พร้อมทางเข้าเกมทายผลและเกมแฟนตาซีที่ยังไม่เปิด
- Dashboard ที่ `/dashboard` พร้อม 3 tabs: ตารางคะแนน, ทายผล, ผลการแข่งขัน
- เปลี่ยน gameweek ได้ทันทีจาก dropdown
- เลือกผลเหย้า/เสมอ/เยือน พร้อม confirmation modal
- ใช้ mock data และ preview profile เพื่อให้ตรวจ flow ได้โดยไม่ต้องมี credentials

## Run locally

ต้องใช้ Node.js 20.9 ขึ้นไปตามคู่มือ Next.js ที่ติดตั้งในโปรเจกต์

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000` แล้วกดเข้า “ทายผลพรีเมียร์ลีก”

## Environment

คัดลอก `.env.example` เป็น `.env.local` ได้เมื่อจะเริ่มเชื่อม LIFF:

```env
NEXT_PUBLIC_LIFF_ID=
NEXT_PUBLIC_DEMO_MODE=true
```

Phase 1 ยังไม่เรียก LIFF SDK, Supabase, Fantasy Premier League API หรือ LINE Messaging API จริง จึงไม่มี secret จริงใน repository

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
