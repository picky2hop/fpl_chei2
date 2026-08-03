# FPL Chei Chei

เว็บทายผลพรีเมียร์ลีกสำหรับกลุ่มเพื่อนใน LINE สร้างด้วย Next.js App Router และ Tailwind CSS

สถานะล่าสุด: Production-only cutover เสร็จในระดับ repository; ระบบใช้งานผ่าน Production Vercel และ Production Supabase เท่านั้น ดู [สถานะ production](docs/phase-2-production-status.md) และ [roadmap Phase 3A](docs/phase-3a-preseason-hardening.md)

## Phase 1 MVP

- Landing page ที่ `/` พร้อมทางเข้าเกมทายผลและเกมแฟนตาซีที่ยังไม่เปิด
- Dashboard ที่ `/dashboard` พร้อม 3 tabs: ตารางคะแนน, ทายผล, ผลการแข่งขัน
- เปลี่ยน gameweek ได้ทันทีจาก dropdown
- เลือกผลเหย้า/เสมอ/เยือน พร้อม confirmation modal
- หลังยืนยันคำทาย มี popup ถามแชร์ผลลงกลุ่ม LINE
- ใช้ Lucide icons และ SVG club crests แบบไม่มีกรอบขาว
- ใช้ LIFF authentication และข้อมูลจริงจาก server API สำหรับการใช้งาน Production
- preview profile และ mock dashboard fallback ถูกยกเลิกหลัง Production-only cutover

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

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LINE_CHANNEL_ID=
SESSION_SECRET=
ADMIN_LINE_USER_ID=
FPL_API_BASE_URL=https://fantasy.premierleague.com
FPL_SYNC_TOKEN=
```

`NEXT_PUBLIC_*` เป็นค่าที่ถูก bundle ไปยัง browser จึงใช้ได้เฉพาะ LIFF ID เท่านั้น ห้ามใส่ Supabase service key, session secret, admin ID หรือ sync token ในตัวแปร public. ค่าที่เหลือเป็น server-only และต้องตั้งใน Vercel/`.env.local` โดยไม่ commit ค่า secret.

การใช้งาน Production ต้องมี `NEXT_PUBLIC_LIFF_ID` และค่าฝั่ง server ครบถ้วน ระบบไม่มี preview fallback และไม่ควรใช้ข้อมูลจำลองแทน Production API.

## Verification

```bash
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
```

## Current roadmap

### Phase 2 — Production integration

Implementation และ deployment เสร็จแล้ว. ระบบที่ยืนยันแล้วคือ LIFF login, Supabase server data flow, FPL sync 380 fixtures, prediction ก่อน kickoff, database-authoritative lock, `/admin`, manual sync และ Google Apps Script scheduler.

สิ่งที่ยังรอข้อมูลการแข่งขันจริงคือการตรวจ scoring/leaderboard หลังมี fixture `finished` และการตรวจ postponed/rescheduled ใน production.

### Phase 3A — Pre-season hardening

LINE Flex/Bot ผ่าน production แล้ว ส่วน sync reliability มี implementation และ automated tests สำหรับ idempotent rerun, provider failures, safe `job_runs`, fixture moves, selective scoring และ atomic RPC โดย migration `20260802083440_phase_3a_atomic_fpl_sync.sql` ถูก apply production และตรวจ schema/privileges แบบ read-only แล้วเมื่อ 2 สิงหาคม 2026

รายละเอียดอยู่ใน [Phase 3A pre-season hardening](docs/phase-3a-preseason-hardening.md) และ [sync reliability test evidence](docs/phase-3a-sync-reliability-test-evidence.md). State-transition integration evidence เดิมเป็น historical หลังยกเลิก test environment; เอกสาร design/plan เก็บไว้ที่ `docs/superpowers/`.
