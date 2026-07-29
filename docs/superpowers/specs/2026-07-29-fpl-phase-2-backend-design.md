# FPL Chei Chei Phase 2 Backend Design

**วันที่:** 29 กรกฎาคม 2026

**สถานะ:** Design approved; implementation ยังไม่เริ่ม
**เป้าหมาย:** เปลี่ยน Phase 1 mock dashboard ให้เป็นระบบใช้งานจริงสำหรับกลุ่มประมาณ 20 คน โดยมี LINE identity, Supabase data, FPL sync, prediction locking, scoring และสถิติที่คำนวณใหม่ได้

## Scope และหลักการ

- รองรับฤดูกาลปัจจุบันก่อน และมี `season_id` เพื่อรองรับหลายฤดูกาลภายหลัง
- ใช้เวลาเก็บใน PostgreSQL เป็น `timestamptz` และแสดงผลด้วย `Asia/Bangkok`
- คำทายถูกได้ 3 คะแนน ผิดหรือไม่ทายได้ 0 คะแนน
- ผู้ใช้หนึ่งคนมีคำทายที่ใช้งานได้หนึ่งรายการต่อหนึ่ง fixture
- แก้คำทายได้ก่อน `kickoff_at` เท่านั้น
- ผู้ใช้ใหม่ที่ผ่าน LIFF ถูกเพิ่มเข้าฤดูกาลปัจจุบันอัตโนมัติ
- การ exclude เป็นราย gameweek และไม่ลบ user หรือประวัติ
- GW ที่ถูก exclude จะไม่รวมใน season total ของผู้ใช้นั้น และ UI แสดงจำนวน GW ที่เข้าร่วม
- คะแนนเท่ากันให้สถานะแชมป์/บ๊วยพร้อมกันทุกคน
- ไม่เชื่อข้อมูลคะแนน สถานะ fixture หรือ deadline จาก frontend

## สถาปัตยกรรมที่เลือก

```text
LINE LIFF
  -> Next.js server authentication/session
  -> Vercel Route Handlers
  -> Supabase PostgreSQL

Google Apps Script trigger
  -> protected Vercel FPL sync endpoint
  -> FPL API
  -> Supabase upsert + scoring recalculation
```

Vercel Free ใช้สำหรับ frontend และ backend routes โดยไม่ใช้ Vercel Cron. Google Apps Script เป็น scheduler ภายนอกและเก็บเพียง sync URL กับ sync token ใน Script Properties. Supabase secret key อยู่ฝั่ง Vercel server เท่านั้น

## Supabase schema

### `seasons`

เก็บฤดูกาล เช่น `2026-27`, จำนวน gameweek 38, ช่วงเวลา และสถานะ active

### `gameweeks`

เก็บ `season_id`, หมายเลข GW 1–38, สถานะ `upcoming`, `open`, `closed` หรือ `reopened`, เวลา close และ scoring version

### `teams`

เก็บ FPL team ID, ชื่อ, short name, crest URL และเวลาที่ sync ล่าสุด

### `fixtures`

เก็บ internal ID, `season_id`, `fpl_fixture_id`, `gameweek_id`, ทีมเหย้า/เยือน, `kickoff_at`, สถานะ `scheduled`, `live`, `finished`, `postponed`, คะแนน และเวลาที่ sync ล่าสุด

`fpl_fixture_id` ต้อง unique ต่อฤดูกาล และ fixture ID เดิมต้องถูกใช้ต่อเมื่อคู่ถูกเลื่อน

### `fixture_gameweek_history`

เก็บ fixture ที่ย้ายระหว่าง gameweek พร้อม gameweek เดิม, gameweek ใหม่, source, เวลาเปลี่ยน และข้อมูล provider ที่จำเป็นต่อ audit

### `app_users`

เก็บ internal user ID, LINE user ID, display name, profile image, สถานะ active และ timestamps

### `gameweek_participants`

เก็บ user ต่อ gameweek พร้อมสถานะ `active` หรือ `excluded`, เหตุผล และเวลาเปลี่ยนสถานะ

### `predictions`

เก็บ user, fixture, choice `home`/`draw`/`away`, สถานะ `active` หรือ `voided`, เหตุผลการ void และ timestamps โดยมี unique constraint สำหรับคำทายที่ใช้งานต่อ user/fixture

### `prediction_events`

เก็บประวัติการสร้าง แก้ไข และ void คำทาย รวมถึง choice เดิม เหตุผล และเวลาที่เกิดเหตุการณ์

### `gameweek_scores`

เก็บ user, gameweek, points, จำนวนทายถูก, จำนวนคู่ที่ทาย, จำนวน fixture ที่นำมาคิด และ scoring version

### `gameweek_awards`

เก็บ user, gameweek, award `champion` หรือ `wooden_spoon`, คะแนน และ scoring version. คะแนนเท่ากันจะมีหลายแถว

### `job_runs`

เก็บ sync/scoring job, mode, source, status, เวลาเริ่ม/จบ, gameweek ที่ได้รับผลกระทบ, error และ idempotency key

## Authentication และ authorization

1. LIFF client ส่ง LIFF ID token เข้า `/api/auth/liff`
2. Server ตรวจ token กับ LINE และใช้ข้อมูลที่ตรวจแล้วเท่านั้น
3. Server upsert `app_users`
4. Server ออก HttpOnly, Secure, SameSite session cookie ที่เซ็นด้วย `SESSION_SECRET`
5. ทุก protected request ตรวจ session ฝั่ง server
6. Admin ตรวจ LINE user ID กับ `ADMIN_LINE_USER_ID`

Route หลัก:

- `/api/auth/liff`
- `/api/dashboard`
- `/api/predictions`
- `/api/sync/fpl`
- `/api/admin/sync`
- `/api/admin/participants`
- `/admin`

## RLS และ Supabase access

- เปิด RLS ทุก table
- ไม่ให้ browser อ่าน/เขียน Supabase โดยตรง
- revoke สิทธิ์ `anon` และ `authenticated` จาก table ธุรกิจ
- ใช้ Supabase secret key เฉพาะ Vercel server
- ไม่ส่ง secret key ไป frontend
- ใช้ database constraints และ RPC/transaction สำหรับคำสั่งที่ต้อง atomic

Server authorization ตรวจ session, admin identity, participant status และ business rules ก่อนเรียก database. RLS เป็น defense-in-depth และป้องกันการเปิด Data API โดยไม่ตั้งใจ

## Prediction rules

การบันทึก/แก้คำทายต้องผ่าน server และตรวจตามลำดับ:

1. ตรวจ session
2. ตรวจผู้ใช้ไม่ถูก exclude ใน GW
3. ตรวจ fixture เป็น fixture ที่ระบบเปิดให้ทาย
4. ตรวจ `now() < kickoff_at`
5. ตรวจ choice ถูกต้อง
6. upsert คำทายใน transaction

เมื่อ kickoff แล้ว request แก้คำทายต้องถูกปฏิเสธ แม้ frontend จะถูกแก้ไขหรือเรียก API โดยตรง

## Scoring และ awards

ผล fixture ถูกแปลงเป็น outcome:

- home score มากกว่า away score = `home`
- คะแนนเท่ากัน = `draw`
- home score น้อยกว่า away score = `away`

คำทายตรง outcome ได้ 3 คะแนน คำทายผิดหรือไม่มีคำทายได้ 0 คะแนน. Scoring engine เป็น pure TypeScript function ที่มี unit tests และมี server/database transaction สำหรับ replace `gameweek_scores` และ `gameweek_awards` แบบ idempotent

การ recalculation จะ rebuild gameweek ที่ได้รับผลกระทบ แล้วรวม season total ใหม่จาก gameweek ที่ผู้ใช้เข้าร่วม. ไม่ใช้การบวก delta เพื่อป้องกันคะแนนซ้ำ

แชมป์คือคะแนนสูงสุดของ GW และบ๊วยคือคะแนนต่ำสุดของ GW. Tie ทุกคนถูก insert เป็น award แยกแถว

## Postponed และ rescheduled fixtures

สถานะที่ใช้คือ `scheduled`, `live`, `finished` และ `postponed`; ไม่มีสถานะยกเลิกถาวรใน domain นี้

เมื่อ fixture เป็น `postponed`:

- void คำทายเดิม
- ไม่คิดคะแนนใน GW เดิม
- fixture ยังอยู่ใน database
- UI แสดงว่ารอ gameweek ใหม่
- GW เดิมสามารถปิดและคำนวณได้เมื่อไม่มี fixture `scheduled` หรือ `live` เหลืออยู่ และ fixture ที่แข่งจบถูกนำมาคิด
- ต้องมี fixture `finished` อย่างน้อยหนึ่งคู่ก่อนสร้าง award; หากทั้ง GW ยังไม่มีคู่จบ ให้รอผลก่อน

เมื่อ FPL ระบุว่า fixture ย้ายจาก GW5 ไป GW10:

- บันทึกประวัติการย้าย
- เปลี่ยน `fixtures.gameweek_id` เป็น GW10
- ทุกคนต้องทายใหม่
- คำทายเดิมไม่ถูกนำไปคิดคะแนน
- GW10 ถูก reopen หากเคยปิดแล้ว
- เมื่อ fixture ใหม่แข่งจบ ให้ recalculate GW10 และ season total

ถ้าเปลี่ยนเฉพาะ kickoff แต่ gameweek เดิมและยังไม่เริ่มแข่ง ให้คงคำทายเดิมและใช้ deadline ใหม่

## FPL sync schedule

Google Apps Script มี trigger ทุก 10 นาทีเพียงตัวเดียว และเลือก mode จากเวลา Asia/Bangkok:

- คืนวันเสาร์ 18:00–02:00: results sync
- คืนวันอาทิตย์ 18:00–02:00: results sync
- จันทร์–ศุกร์หลัง 06:00: results sync วันละครั้ง
- อังคารและศุกร์หลัง 18:00: schedule sync
- Admin: manual sync ได้ทุกเวลา

ผลลัพธ์จากทุก mode ส่งเข้า protected `/api/sync/fpl`. Sync ตรวจ `job_runs`, ใช้ fixture ID เดิม, lock กันงานซ้อน และทำซ้ำได้โดยไม่สร้างข้อมูล/คะแนนซ้ำ

Schedule sync ตรวจตารางปัจจุบัน, kickoff, gameweek assignment และการเลื่อน. Results sync ตรวจสถานะและผลการแข่งขัน. เมื่อข้อมูลเปลี่ยนจะ recalculate เฉพาะ gameweek ที่ได้รับผลกระทบ

## Admin

`/admin` เป็น server-protected page ที่มีเฉพาะ LINE user ID ตรงกับ `ADMIN_LINE_USER_ID`:

- Sync ผลการแข่งขัน
- Sync ตารางแข่งขัน
- Recalculate gameweek
- เลือก gameweek
- Exclude/Restore ผู้เล่น
- ดูสถานะและ error ของ jobs

การ exclude ไม่ลบ user หรือคำทาย แต่ทำให้ไม่ถูกนับใน GW นั้นและไม่รวม GW นั้นใน season total

## LINE Messaging และ Flex

เตรียม server-only:

- `/api/line/webhook`
- webhook signature verification
- pure Flex Message builders
- share payload สำหรับ standings, results และ rescheduled fixtures

การแชร์ด้วย `shareTargetPicker` ใช้เมื่อผู้ใช้กดเอง. Push/broadcast ผ่าน Messaging API จะเปิดใช้หลัง core prediction/scoring ผ่านการตรวจสอบแล้ว

## Environment และ deployment

Public:

```env
NEXT_PUBLIC_LIFF_ID=
NEXT_PUBLIC_DEMO_MODE=false
```

Server-only:

```env
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SESSION_SECRET=
ADMIN_LINE_USER_ID=
GAS_SYNC_TOKEN=
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
```

Google Apps Script Script Properties:

```text
SYNC_ENDPOINT_URL
GAS_SYNC_TOKEN
```

ไม่มี secret จริงใน Git หรือ frontend. ไม่ใช้ Vercel Cron ใน architecture นี้

## Verification และ acceptance criteria

ก่อนสรุป Phase 2 ต้องตรวจด้วยข้อมูลจริงบน Supabase และรัน:

```text
npm run test
npm run lint
npm run build
```

Acceptance criteria:

- LIFF login สร้าง/อัปเดต profile จริง
- prediction บันทึกและแก้ได้ก่อน kickoff เท่านั้น
- prediction ถูกล็อกหลัง kickoff จาก server/database
- sync fixture/result ผ่าน Apps Script และ manual admin
- fixture postponed void คำทายเดิมได้
- fixture ย้าย GW แล้วให้ทายใหม่และคำนวณ GW ใหม่ได้
- result correction recalculates คะแนนและ awards ถูกต้อง
- missing prediction ได้ 0 คะแนน
- tie แชมป์/บ๊วยถูกเก็บครบทุกคน
- exclude ราย GW ไม่ลบข้อมูลและไม่รวมใน season total
- admin เห็นเฉพาะผู้มีสิทธิ์
- ไม่มี secret อยู่ใน frontend หรือ Git
- Vercel production route และ Supabase data ตรวจสอบได้จริง

## Out of scope ของ implementation ชุดแรก

- หลายฤดูกาลแบบเต็มรูปแบบใน UI
- หน้า admin ที่มีหลาย role
- Redis/queue/worker แยก
- automatic LINE broadcast ก่อน core scoring ผ่าน verification
