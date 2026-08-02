# LINE Prediction Share Recovery and Date Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make prediction-result sharing fail clearly instead of silently, add regression protection for LINE Flex payloads, and group prediction fixtures by Thai calendar date.

**Architecture:** Keep the existing single-bubble app-style Flex design. Add a pure pre-share validator for the known LINE schema hazards and payload-size limit, call it before `shareTargetPicker`, and record the incident and prevention rules in a repository document. Carry each fixture kickoff through the LIFF and bot data mappers, then render date headings with the actual fixture count before the fixtures belonging to each Bangkok date.

**Tech Stack:** TypeScript, Node test runner, Next.js/LIFF, LINE Flex Message JSON, Supabase-backed server reader.

## Global Constraints

- Use `npm.cmd` for all project scripts on Windows.
- Do not add or expose any secret, token, key, or credential.
- Do not change real fixture data or reset/delete repository data.
- Do not commit or push without explicit user approval.
- Use Bangkok time (`Asia/Bangkok`) when grouping fixture dates.
- Use PNG image URLs in Flex payloads; SVG input URLs must be converted or omitted.

---

### Task 1: Lock down the regression and date-grouping contract

**Files:**
- Modify: `tests/line/flex.test.mts`
- Modify: `tests/line/share-payload.test.mts`
- Modify: `tests/line/share.test.mts`
- Modify: `tests/data/line-bot.test.mts`

- [x] Write failing tests for two date headings, fixture counts per date, kickoff propagation through the bot mapper, and clear rejection of an invalid/oversized Flex message before the picker is called.
- [x] Run the focused tests with `npm.cmd run test -- tests/line/flex.test.mts tests/line/share-payload.test.mts tests/line/share.test.mts tests/data/line-bot.test.mts` and confirm the new assertions fail for the current implementation.

### Task 2: Implement validated sharing and date-grouped prediction Flex

**Files:**
- Modify: `lib/line/flex.ts`
- Modify: `lib/line/share-payload.ts`
- Modify: `lib/line/share.ts`
- Modify: `lib/data/line-bot-core.ts`
- Modify: `lib/data/line-bot.ts`

- [x] Add a pure validator that rejects text-only Box properties, SVG/non-HTTPS image URLs, invalid container shapes, and any bubble over LINE's 30 KB JSON limit without logging secrets.
- [x] Run the validator in `shareFlexMessage` before calling `shareTargetPicker`, returning a user-visible `INVALID_FLEX_MESSAGE` error instead of claiming that a silent share succeeded.
- [x] Format kickoff timestamps in `Asia/Bangkok` as Thai weekday/date labels and group rows under those labels in the existing single prediction bubble.
- [x] Pass kickoff timestamps from the app fixture share path and the LINE bot prediction reader.
- [x] Run focused tests and make them pass.

### Task 3: Record the incident and verify the complete change

**Files:**
- Create: `docs/incident-reports/2026-08-02-line-prediction-share-failure.md`

- [x] Document the symptom, confirmed historical root cause, current prevention checks, diagnostic limitations, and manual LINE WebView/group test steps without secrets or group IDs.
- [x] Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- [x] Review the diff to ensure only current-task files changed and report the verification evidence.
