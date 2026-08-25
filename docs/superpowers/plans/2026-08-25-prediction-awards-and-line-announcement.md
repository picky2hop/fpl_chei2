# Prediction Awards and LINE Announcement Implementation Plan

> **For agentic workers:** Execute this plan inline task-by-task with TDD checkpoints. Do not commit or push until the user reviews the final diff.

**Goal:** Align post-GW participation and scoring with active predictions, then add the latest completed prediction-awards announcement to the LINE bot.

**Architecture:** Keep `is_current` as the app default-gameweek source. Enforce prediction eligibility in the domain scorer and both database scoring paths, while keeping the LINE bot's awards selection independent and based on the latest closed gameweek with awards. Build the awards Flex and text-v2 announcement as isolated LINE presentation helpers.

**Tech Stack:** Next.js 16.2.12, TypeScript, Node test runner, Supabase PostgreSQL migrations/RPC, LINE Messaging API Flex and text-v2 messages.

**Spec:** `docs/superpowers/specs/2026-08-25-prediction-awards-and-line-announcement-design.md`

## Global Constraints

- Do not change the app default gameweek rule: use `is_current`.
- Do not add new participants to `closed` or `reopened` gameweeks.
- Count only active predictions for fixtures in the target gameweek when deciding scoring eligibility.
- Preserve tie-all awards among eligible participants.
- The awards Flex must not include an app button.
- Do not expose secrets or mutate production data for testing.
- Use `npm.cmd` on Windows and use Supabase migration tooling/patterns for SQL changes.
- Write the failing test and observe RED before each production behavior change.

---

### Task 1: Restrict new-user participation to open/upcoming gameweeks

**Files:**
- Modify: `lib/data/auth.ts:90-123`
- Modify: `lib/auth/user-repository-core.ts:20-26`
- Test: `tests/auth/user-repository-core.test.mts`

**Interfaces:**
- `getMissingParticipantGameweekIds` accepts the season gameweek IDs that are eligible for onboarding and returns only missing IDs.
- `joinActiveSeason` loads `id,status` and passes only `open`/`upcoming` IDs to the helper.

- [ ] Write a test proving a new user is not assigned a `closed` or `reopened` gameweek while open/upcoming gameweeks are assigned.
- [ ] Run `npm.cmd run test -- tests/auth/user-repository-core.test.mts` and observe the expected RED failure.
- [ ] Implement the smallest helper/data-query change.
- [ ] Re-run the focused test and then the auth test group.

### Task 2: Make domain scoring eligible only with an active GW prediction

**Files:**
- Modify: `lib/domain/scoring.ts:63-109`
- Test: `tests/domain/scoring.test.mts`

**Interfaces:**
- `calculateGameweekScoring` continues to return scores and tie-all awards, but scores/awards only active participants with at least one active prediction whose fixture belongs to the input fixture set.

- [ ] Add a failing test where an active participant has no prediction and must receive neither score nor award.
- [ ] Add a failing test where an eligible participant predicts incorrectly and receives zero points but remains eligible for the lowest award.
- [ ] Run the focused domain tests and confirm RED.
- [ ] Filter eligible participant IDs from active predictions and use that set for score and award construction.
- [ ] Run the focused domain tests and confirm GREEN.

### Task 3: Apply the same eligibility rule to Supabase scoring

**Files:**
- Create: the timestamped file produced by `supabase migration new prediction_awards_require_active_prediction`
- Modify: `lib/scoring/recalculate.ts:10-33` only if the domain interface requires an input normalization change
- Test: `tests/sql/provisional-finished-scoring-migration.test.mts`
- Test: `tests/domain/scoring.test.mts`

**Interfaces:**
- The migration replaces `apply_fpl_sync` and `replace_gameweek_scoring` only as needed so both paths persist score rows and awards for eligible participants only.

- [ ] Add SQL assertions that the atomic sync scoring insert contains an active prediction eligibility condition.
- [ ] Add SQL assertions for the manual replacement path if its caller/domain path is changed.
- [ ] Run the SQL migration tests and observe RED.
- [ ] Create the migration using the repository's Supabase migration workflow and make the SQL change atomically.
- [ ] Run SQL/domain tests and confirm GREEN.
- [ ] Record that the next successful fixture sync will recalculate finished GW1 through the existing atomic path; do not manually mutate production rows for testing.

### Task 4: Add latest completed prediction-awards data reader

**Files:**
- Modify: `lib/data/line-bot.ts`
- Modify: `lib/data/line-bot-core.ts` if a pure selector is extracted
- Test: `tests/data/line-bot.test.mts`

**Interfaces:**
- Add `getPredictionAwards(): Promise<PredictionAwardsData | null>` to the LINE data reader.
- Return the newest closed gameweek with at least one persisted award, each recipient's display name, avatar URL, points, award type, and LINE user ID.

- [ ] Add a pure selector test proving GW5 remains selected while GW6 is not closed and GW6 is selected after it has awards.
- [ ] Add mapping tests for multiple tied champions/wooden-spoon recipients.
- [ ] Run focused data tests and observe RED.
- [ ] Implement read-only queries and mapping.
- [ ] Run focused data tests and confirm GREEN.

### Task 5: Add awards Flex without an app button

**Files:**
- Modify: `lib/line/flex.ts`
- Test: `tests/line/flex.test.mts`

**Interfaces:**
- Add `PredictionAwardsFlexInput` and `buildPredictionAwardsFlex(input)`.
- Render a single awards Flex with the GW title, champion/wooden-spoon sections, avatar fallback, names, and points.
- Do not call or render `footerButton()` in this Flex.

- [ ] Add a failing payload test for the title, two sections, profile image URLs, points, and absence of any app action/URI.
- [ ] Run the focused Flex test and observe RED.
- [ ] Implement the minimal Flex builder using existing image, text, bubble, and validation helpers.
- [ ] Run focused Flex tests and confirm GREEN.

### Task 6: Add decorated LINE announcement and command/menu routing

**Files:**
- Modify: `lib/line/messaging.ts`
- Modify: `lib/line/commands.ts`
- Modify: `lib/line/webhook.ts`
- Test: `tests/line/commands.test.mts`
- Test: `tests/line/webhook.test.mts`
- Test: `tests/api/line-webhook-route.test.mts`

**Interfaces:**
- Add a `textV2` LINE message type with substitution objects for mentions.
- Add command type/alias/menu item `แชมป์บ๊วยทายผล`.
- Pass webhook source chat type to the command service so group mentions are only generated for group/room replies.
- Return `[awardsFlex, announcementText]` when data exists; return a safe text message when no completed awards exist.

- [ ] Add failing command/menu parsing tests.
- [ ] Add failing webhook tests for decorated announcement text, recipients, and private-chat fallback.
- [ ] Run focused command/webhook tests and observe RED.
- [ ] Implement the text-v2 announcement with celebratory Thai copy and emoji, using at most 20 mention substitutions and plain names for non-mentionable recipients.
- [ ] Run focused tests and confirm GREEN.

### Task 7: Documentation and full verification

**Files:**
- Modify: `README.md` or the relevant current bot/scoring documentation only where the command/status behavior is documented
- Test: all existing tests

- [ ] Update the relevant documentation with the new onboarding, award eligibility, and bot command rules.
- [ ] Run `npm.cmd run test` and record the exact pass/fail counts.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check`.
- [ ] Review `git status --short` and ensure no unrelated existing changes were staged or overwritten.
- [ ] Do not commit or push until the user reviews the diff and explicitly approves.
