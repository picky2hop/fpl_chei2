# Flex Presentation Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update standings, menu, and prediction-result Flex messages to the approved presentation design.

**Architecture:** Keep the existing shared `lib/line/flex.ts` builder boundary. Add an optional deterministic update label with a Bangkok-time fallback, simplify the menu command list, and replace prediction pagination with one compact app-style bubble.

**Tech Stack:** TypeScript, LINE Flex Message JSON, Node test runner, Next.js.

## Global Constraints

- The standings update time means the Bangkok-local time when the Flex is built.
- The menu response contains exactly `ขอตาราง`, `บอลวันนี้`, and `ผลทาย` buttons.
- The prediction result uses one bubble and keeps the LIFF action URL `https://liff.line.me/2010604800-Y9eFejTF`.
- Team images inside Flex must remain PNG-only; no SVG assets are introduced.
- Do not change fixture data, Supabase schema/data, secrets, or LINE configuration.
- Use `npm.cmd` on Windows.
- Do not commit or push without explicit approval.

---

### Task 1: Add the standings update line

**Files:**
- Modify: `lib/line/flex.ts`
- Test: `tests/line/flex.test.mts`

**Interfaces:**
- Consumes: `StandingsFlexInput` with optional `updatedAtLabel?: string`.
- Produces: a standings body containing `อัปเดต {label}` immediately before the footer action.

- [ ] **Step 1: Write the failing test**

Pass `updatedAtLabel: "1 ส.ค. 2569 เวลา 18:46 น."` to `buildStandingsFlex()` and assert the serialized payload contains `อัปเดต 1 ส.ค. 2569 เวลา 18:46 น.`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm.cmd run test`

Expected: the standings assertion fails because `StandingsFlexInput` and the builder do not emit an update line.

- [ ] **Step 3: Implement the minimal timestamp behavior**

Add the optional label and render `text(\`อัปเดต ${input.updatedAtLabel ?? formatBangkokDateTime(new Date())}\`, ...)` after the rows in each standings bubble. Keep the default dynamic fallback so Bot and LIFF share calls need no new caller-specific clock plumbing.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm.cmd run test`

Expected: all tests pass.

### Task 2: Remove the self-repeating menu button

**Files:**
- Modify: `lib/line/commands.ts`
- Test: `tests/line/webhook.test.mts`

**Interfaces:**
- Consumes: `buildLineMenuMessage()`.
- Produces: one Flex message with exactly three message actions.

- [ ] **Step 1: Write the failing test**

Update the menu test to assert the serialized message contains `ขอตาราง`, `บอลวันนี้`, and `ผลทาย`, and does not contain a message action whose label/text is `เมนู`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm.cmd run test`

Expected: the test fails because the current command list contains four buttons, including `เมนู`.

- [ ] **Step 3: Implement the minimal command-list change**

Change the `buildLineMenuMessage()` command array to exactly `["ขอตาราง", "บอลวันนี้", "ผลทาย"]`. Keep parsing of `เมนู`, `ช่วย`, and `คำสั่ง` unchanged.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm.cmd run test`

Expected: all tests pass.

### Task 3: Make prediction results one compact app-style bubble

**Files:**
- Modify: `lib/line/flex.ts`
- Test: `tests/line/flex.test.mts`, `tests/line/share-payload.test.mts`

**Interfaces:**
- Consumes: existing `PredictionFlexInput` and `buildPredictionShareFlex()`.
- Produces: one prediction bubble with profile header, all fixtures, team highlights, choice pills, PNG-only images, and the LIFF footer action.

- [ ] **Step 1: Write the failing tests**

Use 6 fixtures in the direct Flex test and assert `message.contents.type === "bubble"`, the title contains `คำทาย GW1 ของ Picky`, the profile image/name are present, and the serialized payload contains home/away/draw choice labels and app-style colors. Assert the share payload also remains a single bubble.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm.cmd run test`

Expected: the tests fail because the current builder uses a carousel for more than five fixtures, has a separate choice row, and does not use the requested title/profile arrangement.

- [ ] **Step 3: Implement the minimal single-bubble layout**

Add a prediction title block and profile card, render all fixtures directly in one body, make each fixture one horizontal row with the choice pill at the end, use the app colors `#ff647c`, `#47d7a0`, and `#6da9ff`, and remove prediction-specific chunking. Preserve the existing `teamSide()` order, PNG conversion, footer button, and empty-state text.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm.cmd run test`

Expected: all tests pass.

### Task 4: Verify the deployable patch

**Files:**
- Review: `lib/line/flex.ts`, `lib/line/commands.ts`, tests, and the design/plan documents.

- [ ] **Step 1: Run lint and build**

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Expected: both commands exit 0.

- [ ] **Step 2: Check patch integrity and scope**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; pre-existing user-owned changes remain outside the patch.

- [ ] **Step 3: Request commit/push approval**

Do not stage, commit, or push until the user explicitly approves this presentation refresh.
