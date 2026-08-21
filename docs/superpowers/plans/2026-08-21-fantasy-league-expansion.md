# Fantasy League Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** ขยาย Fantasy App ให้รองรับ FPL Classic League แบบ dynamic พร้อม membership snapshots, leaderboard รายลีก, สมาชิกที่ยังไม่ Mapping และ atomic sync ครบทุก active league

**Architecture:** เพิ่ม League Domain แยกจาก fantasy_entry_mappings เดิม โดยใช้ league configuration, membership snapshot และ Entry score snapshot เป็นแหล่งข้อมูลอันดับใหม่ Sync จะดึงสมาชิกทุกลีก, deduplicate Entry ID, ดึง history เพียงครั้งเดียวต่อ Entry และเขียนข้อมูลทั้งหมดผ่าน RPC/transaction เดียว

**Tech Stack:** Next.js 16.2.12 App Router, TypeScript, Supabase/Postgres, Supabase service client, Node test runner, ESLint

**Spec:** docs/superpowers/specs/2026-08-21-fantasy-league-expansion-design.md

## Global Constraints

- อ่านคำแนะนำ Next.js ใน node_modules/next/dist/docs/ ก่อนแก้ Next.js
- ใช้ supabase:supabase skill สำหรับทุกงาน Supabase
- ใช้ superpowers:test-driven-development ก่อน production code ทุก behavior change
- ใช้ superpowers:systematic-debugging เมื่อพบ test failure หรือ unexpected behavior
- ใช้ fake provider/test fixtures; ห้ามแก้ production data ระหว่างพัฒนา
- ใช้ npm.cmd สำหรับคำสั่ง npm ทั้งหมด
- ห้ามเปิดเผย secret, token, service role key หรือ environment value
- รักษา prediction domain และ unrelated working-tree changes
- ห้าม commit/push จนกว่าจะได้รับอนุมัติอย่างชัดเจน
- Apply production migration ได้หลัง verification และ approval เท่านั้น
- ก่อนสรุปเสร็จต้องรัน npm.cmd run test, npm.cmd run lint, npm.cmd run build และ git diff --check
- ตาม requirement ปัจจุบันไม่ทำ Local Supabase test/reset; ใช้ fake provider และ read-only schema audit แทน

## File Map

Create:
- lib/fantasy/league-types.ts — league/member DTOs และ domain types
- lib/fantasy/league-normalizers.ts — pagination, deduplication และ snapshot payloads
- lib/fantasy/league-scoring.ts — leaderboard ที่รองรับ unmapped members และ competition rank
- lib/fantasy/league-sync-service.ts — all-or-nothing orchestration
- app/api/admin/fantasy/leagues/route.ts
- app/api/admin/fantasy/leagues/[id]/route.ts
- app/api/admin/fantasy/leagues/[id]/archive/route.ts
- tests/fantasy/league-client.test.mts
- tests/fantasy/league-normalizers.test.mts
- tests/fantasy/league-scoring.test.mts
- tests/fantasy/league-sync-service.test.mts
- tests/api/admin-fantasy-leagues-route.test.mts
- the CLI-generated timestamped Supabase migration named fantasy_league_domain.sql

Modify:
- lib/fantasy/types.ts, lib/fantasy/fpl-client.ts
- lib/fantasy/repository.ts, lib/data/fantasy.ts, lib/data/fantasy-admin.ts
- lib/api/admin-fantasy-handler.ts, lib/api/fantasy-handler.ts
- app/api/admin/fantasy/mappings/route.ts
- app/api/admin/fantasy/awards/route.ts
- app/api/admin/fantasy/sync/route.ts
- app/api/fantasy/route.ts
- app/admin/fantasy-admin-panel.tsx, app/fantasy/fantasy-app.tsx
- lib/db/types.ts
- existing Fantasy/API tests for regression coverage

---

### Task 1: Define FPL League Client Contracts

Files:
- Create lib/fantasy/league-types.ts
- Modify lib/fantasy/types.ts and lib/fantasy/fpl-client.ts
- Test tests/fantasy/league-client.test.mts

Interfaces:
- FplLeagueSummary = { leagueId: number; officialName: string }
- FplLeagueMember = { entryId: number; teamName: string; managerName: string; rank: number | null }
- FantasyFplProvider.getLeague(leagueId: number): Promise<FplLeagueSummary>
- FantasyFplProvider.getLeagueMembers(leagueId: number): Promise<FplLeagueMember[]>

- [ ] Write failing tests for official-name normalization, all-page pagination, malformed pages, and safe HTTP errors.
- [ ] Run: node --experimental-strip-types --test tests/fantasy/league-client.test.mts. Expected: FAIL because methods do not exist.
- [ ] Implement details endpoint lookup and standings pagination until has_next is false. Reject missing results, invalid Entry IDs, invalid JSON, and non-2xx responses with safe FantasyFplError codes.
- [ ] Re-run the focused test and require all cases to pass.
- [ ] Add a regression assertion that repeated Entry IDs from pages are passed to the normalizer for deduplication.

### Task 2: Normalize Membership and Shared Entry Payloads

Files:
- Create lib/fantasy/league-normalizers.ts
- Test tests/fantasy/league-normalizers.test.mts

Interfaces:
- deduplicateLeagueMembers(input: LeagueMemberSource[]): DeduplicatedLeagueMember[]
- buildMembershipSnapshotRows(input: MembershipSnapshotInput): FantasyLeagueMembershipInsert[]
- buildEntryScoreRequestIds(rows: FantasyLeagueMembershipInsert[]): number[]

- [ ] Write failing tests for one Entry in two leagues, repeated source rows, missing member fields, same-GW keys, and unique score request IDs.
- [ ] Run the focused test and verify failures are caused by missing normalizers.
- [ ] Implement pure functions with no network/database dependency. An Entry in two leagues creates two membership rows but one score request ID.
- [ ] Re-run focused tests and confirm pass.

### Task 3: Implement League Ranking

Files:
- Create lib/fantasy/league-scoring.ts
- Modify lib/fantasy/scoring.ts only for tested shared helpers
- Test tests/fantasy/league-scoring.test.mts

Interfaces:
- buildLeagueLeaderboard(input: LeagueLeaderboardInput): LeagueLeaderboardRow[]
- rankCompetition(rows: Array<{ points: number }>): Array<{ rank: number; points: number }>
- sumEntrySeasonPoints(scores: EntryScoreRow[], entryId: number, throughGameweek: number): number

- [ ] Write failing tests for all-member inclusion, mapped/unmapped identity, missing scores as zero, GW mode, season mode, shared ranks 1/1/3, and one row per selected league member.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement pure ranking functions. Ranking eligibility comes from membership snapshots, not LINE mapping.
- [ ] Run focused tests plus existing tests/fantasy/scoring.test.mts and preserve prediction scoring behavior.

### Task 4: Add Supabase League Domain Migration

Files:
- Create the timestamped Supabase migration named fantasy_league_domain.sql using the CLI
- Modify lib/db/types.ts
- Test repository types and static SQL audit

Tables:
- fantasy_leagues: season_id, fpl_league_id, official_name, active/archive status and sync status
- fantasy_league_membership_snapshots: league_id, gameweek_id, fpl_entry_id, FPL identity and source timestamp
- fantasy_entry_gameweek_scores: gameweek_id, fpl_entry_id, FPL points/transfer fields and source timestamp
- fantasy_league_awards: league_id, gameweek_id, fpl_entry_id, award and selected_by

Constraints:
- unique season_id + fpl_league_id
- unique season_id + league_id + gameweek_id + fpl_entry_id
- unique season_id + gameweek_id + fpl_entry_id
- unique season_id + league_id + gameweek_id + fpl_entry_id + award

RPC contracts:
- apply_fantasy_league_sync(p_job_run_id, p_synced_at, p_leagues, p_memberships, p_scores, p_players)
- replace_fantasy_league_awards(p_season_id, p_league_id, p_gameweek_id, p_selected_by, p_awards)

- [ ] Create migration: npm.cmd exec --yes supabase@latest -- migration new fantasy_league_domain
- [ ] Write tables, checks, foreign keys, indexes, RLS, service-role-only grants, and initial League ID seed rows joined to the active season using the supplied names as bootstrap labels; the first validated Sync overwrites them with official FPL names.
- [ ] Make the sync RPC validate JSON arrays, acquire a database lock, upsert all payloads, and update job_runs in one transaction.
- [ ] Make the award RPC replace one league/Gameweek award set using Entry IDs.
- [ ] Add typed rows/inserts/RPC definitions to lib/db/types.ts.
- [ ] Run static audit confirming RLS on every new table, no browser grants, service-role-only RPCs, no destructive statements, and no hardcoded generated UUIDs.
- [ ] Review against Supabase security checklist before remote apply.

### Task 5: Extend Repository and Dashboard Queries

Files:
- Modify lib/fantasy/repository.ts
- Modify lib/data/fantasy.ts
- Test tests/fantasy/repository.test.mts and tests/fantasy/dashboard.test.mts

Interfaces:
- listLeagues(seasonId: string, includeArchived: boolean): Promise<FantasyLeague[]>
- createLeague(input: CreateFantasyLeagueInput): Promise<FantasyLeague>
- updateLeagueId(id: string, fplLeagueId: number, officialName: string): Promise<FantasyLeague>
- archiveLeague(id: string): Promise<void>
- getLeagueDashboard(input: LeagueDashboardQuery): Promise<FantasyLeagueDashboard>
- applyLeagueSync(input: LeagueSyncWriteInput): Promise<LeagueSyncWriteResult>

- [ ] Write failing repository tests for active/archive lists, historical membership, unmapped identity, same-GW idempotency, and generic RPC errors.
- [ ] Implement server repository methods with the typed Supabase admin client.
- [ ] Build dashboard queries by joining selected league membership snapshots to Entry score snapshots and optional LINE mapping.
- [ ] Keep player stats sourced from the global current-GW snapshot.
- [ ] Run repository/dashboard tests and existing Fantasy repository tests.

### Task 6: Implement Atomic League Sync

Files:
- Create lib/fantasy/league-sync-service.ts
- Modify lib/data/fantasy-admin.ts
- Test tests/fantasy/league-sync-service.test.mts

Interface:
- runFantasyLeagueSync(dependencies: FantasyLeagueSyncDependencies): Promise<FantasyLeagueSyncResult>
- Result contains jobRunId, gameweekNumber, leaguesSynced, membersUpserted, uniqueEntries, scoresUpserted, playersUpserted, stale, and message.

- [ ] Write failing tests for all-page loading, shared Entry fetched once, league failure rollback, Entry history failure rollback, successful counts, repeated GW upsert, and next/finished GW fallback.
- [ ] Run focused tests and verify intended failures.
- [ ] Implement job creation, active league loading, complete external fetch/validation, membership normalization, Entry deduplication, bounded history fetch, one bootstrap fetch, and one repository transaction call.
- [ ] Finish jobs with safe allow-listed error data; do not write partial payloads.
- [ ] Run focused tests and confirm all-or-nothing behavior.

### Task 7: Add Admin League, Mapping, Sync, and Award APIs

Files:
- Create three league route files under app/api/admin/fantasy/leagues
- Modify lib/api/admin-fantasy-handler.ts, mapping/awards/sync routes
- Test tests/api/admin-fantasy-leagues-route.test.mts and existing admin tests

Interfaces:
- POST league accepts { fplLeagueId: number } and validates official name/members before persistence.
- PATCH league accepts { fplLeagueId: number } and validates before replacing old configuration.
- Mapping GET returns unmappedEntries with entryId, teamName, managerName, leagueIds, and leagueNames.
- Awards PUT accepts leagueId, gameweekId, championEntryIds, and woodenSpoonEntryIds.

- [ ] Write failing tests for admin auth, League ID validation, official-name persistence, duplicate rejection, archive behavior, deduplicated mapping options, and awards for unmapped Entries.
- [ ] Implement route handlers using requireAdmin and repository/provider boundaries.
- [ ] Ensure mapping options exclude Entries already mapped to any app user and show all active league badges.
- [ ] Validate each award Entry belongs to the selected league/Gameweek snapshot.
- [ ] Return safe Thai errors and preserve old data on validation failure.
- [ ] Run focused and existing admin tests.

### Task 8: Add User League Selection and API

Files:
- Modify lib/api/fantasy-handler.ts, app/api/fantasy/route.ts, lib/data/fantasy.ts
- Test tests/api/fantasy-route.test.mts, tests/fantasy/view-model.test.mts

Interfaces:
- Query parser returns leagueId, gameweekNumber, and mode gameweek|season.
- Response contains leagues, selectedLeagueId, currentGameweek, selectedLeaderboardGameweek, both leaderboard modes, global playerStats, awards, and sync status.

- [ ] Write failing tests for required league selection, active/archive list, historical membership, both modes, global player stats, and safe invalid query errors.
- [ ] Implement query validation and selected-league dashboard loading.
- [ ] Keep the existing global current-GW player-stat behavior independent of league selection.
- [ ] Preserve existing authentication and generic error responses.
- [ ] Run focused API/view-model tests and existing Fantasy route tests.

### Task 9: Update Admin and Fantasy UI

Files:
- Modify app/admin/fantasy-admin-panel.tsx
- Modify app/fantasy/fantasy-app.tsx
- Test view-model/API tests and manual mobile checklist

- [ ] Add league management with official name, League ID validation state, active/archive state, and one Sync Fantasy button.
- [ ] Replace manual Entry ID input with a dropdown of unmapped deduplicated Entries and league badges.
- [ ] Add league selector before leaderboard; allow archived leagues for history.
- [ ] Default to current-GW ranking after league selection.
- [ ] Add Gameweek and season tabs, competition-rank display, mapped/unmapped identity display, and global player-stat tab.
- [ ] Keep current-GW button and existing Prediction App visual language.
- [ ] Run lint and focused UI-related tests.

### Task 10: Migration and Production Readiness Audit

Files:
- Migration from Task 4
- Tests/read-only Supabase checks

- [ ] Inspect live schema read-only for seasons, gameweeks, app_users, job_runs, and existing Fantasy tables.
- [ ] Confirm initial League ID seed is idempotent and does not insert members, scores, or player data.
- [ ] Run Supabase security/performance advisors and distinguish existing warnings from new warnings.
- [ ] Verify migration history, RLS, grants, indexes, RPC privileges, and table row counts without writing production data.
- [ ] Do not apply production migration until the user separately approves deployment.

### Task 11: Full Verification and Deployment Handoff

Files:
- No unrelated files; preserve existing working-tree changes

- [ ] Run npm.cmd run test. Expected: all old and new tests pass with zero failures.
- [ ] Run npm.cmd run lint. Expected: exit code 0 with no ESLint errors.
- [ ] Run npm.cmd run build. Expected: exit code 0 and all Fantasy routes listed.
- [ ] Run git diff --check. Expected: no whitespace errors.
- [ ] Manually test mobile/LIFF flow: league-first selection, current/historical GW, both ranking tabs, archived league, mapped/unmapped rows, global player stats, Admin dropdown badges, and failed-sync preservation.
- [ ] Report verification evidence and wait for explicit production approval.
- [ ] Apply the reviewed Supabase migration only after approval, then verify migration history, tables, RLS, and row counts.
- [ ] Review git diff, commit only intended Fantasy files, and push only after explicit approval.

## Self-Review

- Dynamic leagues, initial IDs, all members, unmapped ranking, historical snapshots, atomic sync, global players, archived history, awards, ties, security, tests, and verification each have explicit tasks.
- No task requires Local Supabase reset or production data mutation during development.
- Existing Fantasy and prediction behavior has regression coverage.
- Function names, route paths, payload keys, and table keys are consistent.
- No unrelated refactor or dependency installation is planned.
