# Prediction Flex Detail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shared prediction-result Flex match the app's Player Detail layout.

**Architecture:** Keep `buildPredictionResultFlex()` as the shared Bot/LIFF boundary. Adjust only its layout helpers and add regression tests for the approved visual contract.

**Tech Stack:** TypeScript, LINE Flex Message JSON, Node test runner, Next.js.

## Global Constraints

- Remove the prediction top title card while retaining the profile card.
- Center team groups and `VS`; keep the choice pill at the right edge.
- Use `#d9ff5815` and `#d9ff58` for the selected-side app-style filter.
- Keep PNG-only team assets and `https://liff.line.me/2010604800-Y9eFejTF`.
- Do not change fixtures, Supabase data/schema, secrets, or LINE configuration.
- Use `npm.cmd` on Windows.
- Do not commit or push without explicit approval.

---

### Task 1: Add failing layout regression tests

**Files:**
- Modify: `tests/line/flex.test.mts`
- Modify: `tests/line/share-payload.test.mts`

- [ ] Add assertions that prediction output does not contain `PLAYER PICKS` or the removed title card.
- [ ] Add assertions for centered team alignment, translucent selected highlight, no outer fixture background, and the choice pill's right-edge layout.
- [ ] Run `npm.cmd run test` and confirm the new assertions fail against the current payload.

### Task 2: Implement the approved Flex layout

**Files:**
- Modify: `lib/line/flex.ts`

- [ ] Remove the prediction title block from the bubble contents.
- [ ] Make `teamSide()` center its contents and use the app-style translucent selected background without changing team order.
- [ ] Keep fixture rows on the Flex background, center `VS`, and retain the choice pill as the final right-aligned child.
- [ ] Run `npm.cmd run test` and confirm all tests pass.

### Task 3: Verify the patch

**Files:**
- Review: `lib/line/flex.ts`, prediction tests, and this spec/plan.

- [ ] Run `npm.cmd run test`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check` and confirm unrelated user changes remain unstaged.
- [ ] Request commit/push approval only after the user reviews the result.
