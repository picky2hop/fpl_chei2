# LINE Flex and live prediction regression fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair live prediction detail, LINE Flex rendering/sharing, and missing approved Bot commands without changing the database schema or mutating production data.

**Architecture:** Keep Supabase reads server-only. Extend the existing dashboard DTO with a normalized prediction book, then pass it through the client dashboard into the existing detail components. Keep Flex construction pure and normalize outbound image URLs before serialization.

**Tech Stack:** Next.js 16, React, TypeScript, `@line/liff`, LINE Flex Message JSON, Supabase JS, Node test runner.

## Global Constraints

- Use `npm.cmd` on Windows.
- Use read-only Supabase queries only; no migrations, writes, fixture edits, or secrets.
- Use exact command aliases and ignore unsupported ordinary text.
- Home display order is name + logo; away display order is logo + name.
- Approved LIFF action URI is `https://liff.line.me/2010604800-Y9eFejTF`.
- Do not commit or push until fresh verification and user review.

### Task 1: Live prediction book

**Files:**
- Modify: `lib/data/dashboard.ts`
- Modify: `app/dashboard/live-dashboard.tsx`
- Modify: `app/components/prediction-app-final.tsx`
- Test: `tests/data/dashboard-prediction-book.test.mts`

- [x] Write a pure mapping test that fails because the dashboard has no per-user prediction book.
- [x] Run the focused test and observe the expected RED failure.
- [x] Add `predictionBookByGameweek` to the server DTO from the existing read-only prediction rows and map it through the client.
- [x] Use live data in player and fixture detail; retain mock data only for demo fallback.
- [x] Run the focused test and full tests.

### Task 2: Flex asset and layout contract

**Files:**
- Modify: `lib/line/flex.ts`
- Modify: `lib/line/share-payload.ts` if needed
- Test: `tests/line/flex.test.mts`
- Test: `tests/line/share-payload.test.mts`

- [x] Add failing assertions for PNG normalization, circular avatars, giga sizing, Thai heading, dark action text, and the approved LIFF URI.
- [x] Run focused Flex tests and observe RED.
- [x] Implement the smallest pure asset/layout changes.
- [x] Run focused Flex tests and full tests.

### Task 3: Bot commands and safe data errors

**Files:**
- Modify: `lib/line/commands.ts`
- Modify: `lib/line/webhook.ts`
- Test: `tests/line/commands.test.mts`
- Test: `tests/line/webhook.test.mts`

- [x] Add a failing alias test for `ทายผล` and a failing service test for safe read failure replies.
- [x] Run focused command/webhook tests and observe RED.
- [x] Add the alias and safe text fallback while preserving unknown-text silence.
- [x] Run focused tests and the full suite.

### Task 4: Verification and handoff

**Files:**
- Modify: `docs/phase-3a-line-flex-bot-test-evidence.md`

- [x] Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- [x] Confirm only intended files are changed and no secret values are present.
- [x] Report production smoke-test steps separately from automated evidence.
- [x] Stop for user review before commit/push.
