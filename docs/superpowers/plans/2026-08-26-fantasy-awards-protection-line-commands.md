# Fantasy Awards Protection and LINE Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect existing Fantasy champion/wooden-spoon records from accidental replacement and add the two approved Fantasy Awards LINE commands.

**Architecture:** Keep `fantasy_league_awards` as the source of truth. The Admin PUT handler performs a server-side preflight and returns a non-mutating conflict when the selected league/GW already has awards; the client opens a confirmation modal and retries with an explicit replacement flag. The LINE bot adds a read-only Fantasy Awards data reader, a Flex builder matching the existing prediction-awards style, and separate command behavior for Chei (Flex plus group mentions) and Khao Kho (Flex only).

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase server repository, LINE Messaging API Flex/textV2 messages, Node test runner.

**Spec:** Approved requirements in the conversation on 2026-08-26.

## Global Constraints

- Do not modify unrelated working-tree changes.
- Do not mutate production data while implementing or testing.
- Preserve the existing prediction-awards command and its payload.
- `แชมป์บ๊วยเชย` maps to FPL League ID `819498`, is the only new menu item, and may mention recipients in group/room chats.
- `แชมป์บ๊วยเขาค้อ` maps to FPL League ID `819502`, is not added to the menu, and returns only one Flex message with no text announcement.
- Use the existing `fantasy_league_awards` table and existing RPC; no new table is required.
- Use `npm.cmd` for npm commands.

### Task 1: Protect existing Admin Fantasy Awards

**Files:**
- Modify: `lib/fantasy/repository.ts`
- Modify: `lib/api/admin-fantasy-handler.ts`
- Modify: `app/admin/fantasy-admin-panel.tsx`
- Create: `app/admin/admin-awards-confirmation-modal.tsx`
- Test: `tests/api/admin-fantasy-league-awards-route.test.mts`
- Test: `tests/fantasy/fantasy-admin-award-protection.test.mts`

**Interfaces:**
- Produce `listLeagueAwards(seasonId)` returning `{ leagueId, gameweekId, fplEntryId, award }[]`.
- Accept `confirmReplace?: boolean` in the Admin awards PUT body.
- Return HTTP 409 with code `FANTASY_AWARDS_EXIST` before any write when the selected league/GW already has awards and `confirmReplace` is false.

- [ ] Write a failing route test proving an existing award returns 409 and `replaceLeagueAwards` is not called.
- [ ] Run the focused route test and verify it fails because the current handler replaces immediately.
- [ ] Write a failing route test proving `confirmReplace: true` performs the replacement.
- [ ] Implement the repository read and handler preflight while preserving existing validation.
- [ ] Implement a custom confirmation modal and a two-step Admin save flow; cancellation must leave the existing award untouched.
- [ ] Run the focused Admin tests and verify they pass.

### Task 2: Add Fantasy Awards data and presentation helpers

**Files:**
- Modify: `lib/data/line-bot-core.ts`
- Modify: `lib/data/line-bot.ts`
- Modify: `lib/line/flex.ts`
- Modify: `lib/line/announcement.ts`
- Test: `tests/data/line-bot.test.mts`
- Test: `tests/line/flex.test.mts`
- Test: `tests/line/announcement.test.mts`

**Interfaces:**
- Produce `FantasyAwardsData` with league name, GW number, champions, and wooden spoons; each recipient carries display name, team name, avatar URL, LINE user ID, and points.
- Produce `buildFantasyAwardsFlex(input)` matching the existing prediction-awards Flex layout.
- Produce `buildFantasyAwardsAnnouncement(input)` with optional LINE mentions and the Fantasy league title.

- [ ] Write failing pure mapping tests for Fantasy award rows, including missing mappings and points.
- [ ] Run the focused data test and verify it fails because the Fantasy mapping helper does not exist.
- [ ] Write failing Flex tests for league title, GW, team names, points, and valid payload shape.
- [ ] Write failing announcement tests for mention-enabled Chei output and plain no-mention Khao output.
- [ ] Implement the pure types/mappers and the two presentation builders without changing prediction output.
- [ ] Run the focused data, Flex, and announcement tests and verify they pass.

### Task 3: Add the two LINE commands and data reader

**Files:**
- Modify: `lib/line/commands.ts`
- Modify: `lib/line/webhook.ts`
- Modify: `lib/data/line-bot.ts`
- Modify: `tests/line/commands.test.mts`
- Modify: `tests/line/webhook.test.mts`

**Interfaces:**
- Parse `แชมป์บ๊วยเชย` as the Chei Fantasy Awards command and `แชมป์บ๊วยเขาค้อ` as the Khao Kho Fantasy Awards command.
- Add `getFantasyAwards(leagueFplId: 819498 | 819502)` to the LINE data reader.
- Select the newest closed GW with stored awards for the requested Fantasy league, then resolve scores, membership names, mappings, and avatars.

- [ ] Write failing command tests for both aliases and for the menu containing only `แชมป์บ๊วยเชย`.
- [ ] Write failing webhook tests proving Chei returns Flex plus mention text and Khao returns exactly one Flex message.
- [ ] Run focused command/webhook tests and verify they fail for the missing command branches.
- [ ] Implement the command aliases/menu and the read-only Supabase data reader.
- [ ] Implement the webhook branches with safe empty/error responses and the approved mention behavior.
- [ ] Run focused command/webhook tests and verify they pass.

### Task 4: Full verification

**Files:**
- Review: all files changed by Tasks 1–3

- [ ] Run `npm.cmd test` and confirm zero failures.
- [ ] Run `npm.cmd run lint` and confirm exit code 0.
- [ ] Run `npm.cmd run build` and confirm exit code 0.
- [ ] Run `git diff --check` and inspect the diff for unrelated files.
- [ ] Do not commit or push unless separately authorized.
