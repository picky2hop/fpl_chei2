# LINE Flex Aspect Mode Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore both LINE bot prediction replies and LIFF prediction sharing by replacing the unsupported Flex Image aspect mode and preventing the same schema regression.

**Architecture:** Keep the existing shared prediction Flex builder and direct transparent team-logo Image components. Change the team-logo Image to LINE's supported `fit` mode, and extend the existing pre-share validator so unsupported image aspect modes are rejected before LIFF opens the picker.

**Tech Stack:** TypeScript, Node test runner, LINE Flex Message JSON, LIFF `shareTargetPicker`, Next.js 16.2.12.

## Global Constraints

- Use `npm.cmd` for all project scripts on Windows.
- Preserve date grouping, dynamic fixture counts, transparent PNG logos, and existing fallback behavior.
- Do not add or expose secrets, tokens, keys, user IDs, or private group IDs.
- Do not include unrelated dirty files in the commit.
- Commit and push only the approved repair files, spec, plan, and incident documentation.

---

### Task 1: Reproduce the invalid Flex Image mode

**Files:**
- Modify: `tests/line/flex.test.mts`
- Modify: `tests/line/share.test.mts`

**Interfaces:**
- Consumes: `buildPredictionResultFlex(input)` and `shareFlexMessage(api, message)`.
- Produces: regression assertions requiring `fit` and rejecting `contain`.

- [x] **Step 1: Change the builder regression test to require LINE's supported mode**

Assert that both generated team-logo Image components have `aspectMode === "fit"` and that the serialized prediction payload does not contain `"aspectMode":"contain"`.

- [x] **Step 2: Add a validator regression test**

Construct a Flex message containing an HTTPS PNG Image with `aspectMode: "contain"`; call `shareFlexMessage`; assert `FLEX_MESSAGE_INVALID` and assert that `shareTargetPicker` was never called.

- [x] **Step 3: Run the test suite and verify RED**

Run: `npm.cmd run test`

Expected: the builder test reports `contain !== fit`, and the validator test reports a missing rejection.

### Task 2: Implement the minimal schema repair

**Files:**
- Modify: `lib/line/flex.ts`

**Interfaces:**
- Consumes: existing `teamLogoOrFallback` and `validateFlexMessage` functions.
- Produces: prediction Image components using `fit`; validator accepts only `fit` and `cover` when `aspectMode` is present.

- [x] **Step 1: Replace the unsupported generated value**

Change only the valid team-logo Image from `aspectMode: "contain"` to `aspectMode: "fit"`; keep the direct Image, `size`, `aspectRatio`, and `flex` properties unchanged.

- [x] **Step 2: Extend the image validator**

When an Image has an `aspectMode`, throw `FLEX_MESSAGE_INVALID` unless the value is exactly `fit` or `cover`.

- [x] **Step 3: Run tests and verify GREEN**

Run: `npm.cmd run test`

Expected: all tests pass, including the new builder and validator regressions.

### Task 3: Record and verify the repair

**Files:**
- Modify: `docs/incident-reports/2026-08-02-line-prediction-share-failure.md`
- Include: `docs/superpowers/specs/2026-08-02-line-flex-aspect-mode-repair-design.md`
- Include: `docs/superpowers/plans/2026-08-02-line-flex-aspect-mode-repair.md`

**Interfaces:**
- Consumes: confirmed Git comparison against `7fce840` and LINE's supported Flex Image enum.
- Produces: a durable root-cause record and deployment test checklist.

- [x] **Step 1: Update the incident record**

Record `aspectMode: "contain"` as the confirmed current regression, `fit`/`cover` as the allowed values, and the validator regression test as the prevention measure.

- [x] **Step 2: Run complete verification**

Run:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: zero test failures, lint exit code 0, build exit code 0, and diff check exit code 0.

- [ ] **Step 3: Commit and push only scoped files**

Stage the two production/test files and the three approved documentation files explicitly. Commit with `fix: use valid LINE image aspect mode`, push `main`, and confirm `HEAD` equals `origin/main`.
