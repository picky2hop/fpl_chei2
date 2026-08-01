# LINE Prediction Flex Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the prediction Flex valid for LINE Messaging API while preserving its approved visual layout.

**Architecture:** Keep `buildPredictionResultFlex()` and its shared `teamSide()` layout. Correct the two `justifyContent` enum values at the shared builder boundary so both the Bot reply and LIFF share receive the same valid payload.

**Tech Stack:** TypeScript, LINE Flex Message JSON, Node test runner, Next.js.

## Global Constraints

- Change only the invalid `justifyContent` enum values in `lib/line/flex.ts` and the regression test.
- Do not change fixtures, Supabase data/schema, secrets, environment variables, or LINE Console settings.
- Use `npm.cmd` on Windows.
- Do not commit or push without explicit approval.

---

### Task 1: Correct the shared prediction Flex enum values

**Files:**
- Modify: `lib/line/flex.ts:111`
- Test: `tests/line/flex.test.mts`

**Interfaces:**
- Consumes: `buildPredictionResultFlex(input: PredictionFlexInput)`.
- Produces: prediction fixture team boxes with `justifyContent` values `flex-end` for home and `flex-start` for away.

- [ ] **Step 1: Write the failing regression test**

Extend the existing prediction Flex test with a recursive collection of all `justifyContent` values and assert the hand-derived valid values:

```ts
const serialized = JSON.stringify(message);
assert.match(serialized, /"justifyContent":"flex-end"/);
assert.match(serialized, /"justifyContent":"flex-start"/);
assert.doesNotMatch(serialized, /"justifyContent":"(?:end|start)"/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd run test`

Expected: the new regression assertion fails because the current payload contains `"end"` and `"start"`.

- [ ] **Step 3: Implement the minimal correction**

Change only the conditional values in `teamSide()`:

```ts
justifyContent: side === "home" ? "flex-end" : "flex-start",
```

- [ ] **Step 4: Run the full tests and verify GREEN**

Run: `npm.cmd run test`

Expected: all tests pass, including the regression test.

### Task 2: Verify the deployable patch

**Files:**
- Review: `lib/line/flex.ts`, `tests/line/flex.test.mts`, and the design/plan documents.

- [ ] **Step 1: Run lint and build**

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Expected: both commands exit 0.

- [ ] **Step 2: Check patch integrity and scope**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; pre-existing user-owned changes remain untouched.

- [ ] **Step 3: Request commit/push approval**

Do not stage, commit, or push until the user explicitly approves this schema correction.
