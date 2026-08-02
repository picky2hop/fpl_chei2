# Phase 3A — Sync reliability test evidence

อัปเดตล่าสุด: 2 สิงหาคม 2026

## Scope and safety

- ใช้ fake FPL provider และ injected persistence test doubles
- หลังได้รับอนุมัติ apply migration production โดยตรง และตรวจผลผ่าน schema metadata/read-only queries
- ไม่แก้ production fixtures, predictions, scores หรือ job rows เพื่อทดสอบ
- ไม่เรียก sync เพื่อแก้ production fixtures สำหรับการทดสอบ; ผู้ใช้อนุมัติ production migration และ commit/push แยกภายหลัง

## Automated coverage by requirement

| Requirement | Automated evidence | Expected invariant |
| --- | --- | --- |
| Snapshot เดิมสองรอบ | `tests/sync/sync-runner.test.mts` รัน snapshot 380 fixtures สองครั้ง | audit attempt แยกกันและ external fixture identity มี 380 ค่าเท่าเดิม |
| FPL 403/502/timeout | `tests/sync/fpl-client.test.mts` | typed safe failure; response body ไม่ถูกนำมาใช้หรือบันทึก และ request ที่เหลือถูก abort |
| `job_runs` success/failure | `tests/sync/sync-runner.test.mts` | job เริ่มก่อน fetch; failure เก็บเฉพาะ code/message/details ที่ allow-list; success อยู่ใน atomic transaction |
| Duplicate/missing source | `tests/sync/fpl-core.test.mts` | reject snapshot ก่อน persistence ด้วย `FPL_INVALID_SNAPSHOT` |
| เปลี่ยนเวลาใน GW เดิม | `tests/domain/fixtures.test.mts` | prediction เดิมไม่ถูก void |
| ย้ายข้าม GW | `tests/domain/fixtures.test.mts` และ atomic RPC contract | fixture ถือว่า moved, void prediction, reopen target และ old/new GW เป็นขอบเขต reconciliation |
| แก้ผลย้อนหลัง | `tests/domain/scoring.test.mts` และ `apply_fpl_sync` affected-GW logic | rebuild score/award snapshot ไม่บวก delta และไม่แตะ GW ที่ไม่อยู่ใน affected set |
| Failure ไม่ทิ้ง partial update | `tests/sync/supabase-sync-repository.test.mts` และ `tests/sync/sync-runner.test.mts` | application เรียก persistence ผ่าน RPC เดียว; RPC error ถูก rollback โดย PostgreSQL ก่อน failed job finalization |
| Route ไม่เปิดเผยรายละเอียด | `tests/api/sync-route.test.mts` | ตอบเพียง `{ "error": "Sync failed" }` ด้วย HTTP 502 |

## Database contract

Migration `supabase/migrations/20260802083440_phase_3a_atomic_fpl_sync.sql`:

- เพิ่ม `job_runs.error_code` และ `job_runs.details`
- สร้าง `public.apply_fpl_sync(...)` แบบ `security invoker`
- revoke execution จาก `public`, `anon`, `authenticated` และ grant เฉพาะ `service_role`
- validate duplicate identities ซ้ำที่ database boundary
- ใช้ transaction-level advisory lock เพื่อ serialize active-season sync
- mark `job_runs = succeeded` ภายใน transaction เดียวกับ business writes
- ถ้า retry ด้วย job เดิมหลัง transaction สำเร็จ RPC จะคืนผลสำเร็จเดิม และ failed finalization จะอัปเดตได้เฉพาะ job ที่ยัง `running`
- exception ระหว่าง upsert/reconciliation/scoring ทำให้ PostgreSQL rollback RPC ทั้งหมด แล้ว runner จึง mark job เป็น `failed` ด้วยข้อความปลอดภัย

Read-only post-deployment checks ถูกเพิ่มใน `tests/sql/phase-2-schema.sql` แล้ว

## Verification status

ผล verification หลัง implementation และอัปเดตเอกสาร:

- `npm.cmd run test`: ผ่าน 105/105 tests
- `npm.cmd run lint`: ผ่าน
- `npm.cmd run build`: ผ่านด้วย Next.js 16.2.12
- `git diff --check`: ผ่าน; มีเพียงคำเตือน LF/CRLF ของ working copy บน Windows

## Production migration evidence

- Supabase CLI `2.111.0` linked กับ production project ที่มีสถานะ healthy
- migration history เดิมถูกดึงมาให้ชื่อไฟล์ local ตรงกับ remote โดยไม่ reapply migration เก่า
- `db push --dry-run` แสดงเฉพาะ `20260802083440_phase_3a_atomic_fpl_sync.sql`
- production `db push` apply migration ดังกล่าวสำเร็จเมื่อ 2 สิงหาคม 2026
- migration history หลัง apply มี local/remote version `20260802083440` ตรงกัน
- `apply_fpl_sync` มีอยู่จริง เป็น `SECURITY INVOKER` และกำหนด `search_path=public, pg_temp`
- `anon` และ `authenticated` execute function ไม่ได้ ส่วน `service_role` execute ได้
- `job_runs.error_code` และ `job_runs.details` มีอยู่จริง
- post-deployment `db lint` ไม่พบ schema error
- advisors เหลือ warning เดิม `auth_leaked_password_protection` เท่านั้น ไม่มี error และไม่เกี่ยวกับ sync migration
- ไม่มีการเรียก sync เพื่อเปลี่ยน production fixtures/predictions/scores สำหรับ verification
