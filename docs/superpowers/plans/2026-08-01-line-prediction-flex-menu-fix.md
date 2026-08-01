# LINE Prediction Flex and Menu Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make prediction Flex messages deliver through LIFF sharing and the LINE Bot, replace the text menu with command buttons, and improve all Flex app buttons without changing app-only image URLs.

**Architecture:** Keep `buildPredictionResultFlex()` as the single pure payload builder shared by LIFF and the Bot. Correct LINE-invalid spacing at the source, normalize known Premier League SVG crest URLs to verified PNG URLs only inside the Flex builder, and build the Bot menu as a separate Flex payload whose message actions never enter LIFF sharing.

**Tech Stack:** Next.js 16, TypeScript, `@line/liff`, LINE Messaging API Flex JSON, Node test runner.

## Global Constraints

- Use `npm.cmd` on Windows.
- Do not change Supabase schema/data or real fixtures.
- Do not request, display, log, or document secret values.
- Convert SVG assets only inside Flex payload construction; retain app image URLs unchanged.
- Menu buttons use canonical commands: `ขอตาราง`, `บอลวันนี้`, `ผลทาย`, and `เมนู`.
- The app action URI remains `https://liff.line.me/2010604800-Y9eFejTF`.
- Preserve existing user-owned worktree changes.
- Do not commit or push until the user reviews and explicitly approves this batch.

---

### Task 1: Reproduce and repair the prediction Flex contract

**Files:**
- Modify: `tests/line/flex.test.mts`
- Modify: `tests/line/share-payload.test.mts`
- Modify: `lib/line/flex.ts`

**Interfaces:**
- Consumes: `buildPredictionResultFlex(input: PredictionFlexInput): FlexMessage`
- Produces: Prediction and fixture Flex payloads with supported padding and PNG/fallback images.

- [x] **Step 1: Write failing regression tests**

  Add assertions that a prediction containing selected and unselected teams serializes no `"0px"`, uses `"paddingAll":"none"` for no padding, converts the current Premier League `badges-alt/{id}.svg` URL to `badges/{id}.png`, contains no `.svg`, and leaves the source fixture crest unchanged after building.

- [x] **Step 2: Run the focused tests and observe RED**

  Run `npm.cmd run test -- tests/line/flex.test.mts tests/line/share-payload.test.mts`.

  Expected: failure because the current prediction payload contains `paddingAll: "0px"`.

- [x] **Step 3: Implement the minimum fix**

  Change only the no-padding branch in `teamSide()` from `"0px"` to the LINE keyword `"none"`. Keep known Premier League crest conversion in `lineImageUrl()` and continue rejecting unsupported arbitrary SVG URLs to the text fallback.

- [x] **Step 4: Run the focused tests and observe GREEN**

  Run `npm.cmd run test -- tests/line/flex.test.mts tests/line/share-payload.test.mts`.

### Task 2: Increase and center the shared Flex app button

**Files:**
- Modify: `tests/line/flex.test.mts`
- Modify: `lib/line/flex.ts`

**Interfaces:**
- Produces: Every bubble footer with a 56px clickable URI box and centered dark text.

- [x] **Step 1: Write the failing button test**

  Traverse a generated Flex bubble and assert the URI action box has `height: "56px"`, `justifyContent: "center"`, `alignItems: "center"`, and its child text has `align: "center"`.

- [x] **Step 2: Run the focused test and observe RED**

  Run `npm.cmd run test -- tests/line/flex.test.mts`.

  Expected: failure because the current height is 44px and the text has no explicit alignment.

- [x] **Step 3: Implement the minimum shared footer change**

  Set the footer action box height to `"56px"` and add `align: "center"` to its text component while preserving the URI, background, and dark text color.

- [x] **Step 4: Run the focused test and observe GREEN**

  Run `npm.cmd run test -- tests/line/flex.test.mts`.

### Task 3: Replace the text menu with a Bot-only Flex command menu

**Files:**
- Modify: `tests/line/commands.test.mts`
- Modify: `tests/line/webhook.test.mts`
- Modify: `lib/line/commands.ts`

**Interfaces:**
- Consumes: `buildLineMenuMessage(): LineMessage`
- Produces: One Flex bubble with four red command boxes and LINE message actions.

- [x] **Step 1: Write failing menu payload tests**

  Assert `buildLineMenuMessage()` returns `type: "flex"`; includes exactly four message actions whose label/text pairs are literal `ขอตาราง`, `บอลวันนี้`, `ผลทาย`, and `เมนู`; renders each clickable box with red `#E53935`, white `#FFFFFF` text, and includes no secret-like text. Assert the command service returns this Flex for `เมนู`.

- [x] **Step 2: Run the focused tests and observe RED**

  Run `npm.cmd run test -- tests/line/commands.test.mts tests/line/webhook.test.mts`.

  Expected: failure because the current menu is a plain text message.

- [x] **Step 3: Implement the minimum menu Flex**

  Build one dark `giga` bubble containing a title and four 48px red clickable boxes. Each box uses `{ type: "message", label: command, text: command }` and centered white bold text. Add the same 56px URI footer used by other Flex messages without exposing the menu builder to LIFF share code.

- [x] **Step 4: Run the focused tests and observe GREEN**

  Run `npm.cmd run test -- tests/line/commands.test.mts tests/line/webhook.test.mts`.

### Task 4: Verify the batch and prepare manual LINE evidence

**Files:**
- Review only: intended implementation/test/plan files.

- [x] **Step 1: Run complete automated verification**

  Run `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.

- [x] **Step 2: Review scope and secret safety**

  Run `git status --short`, inspect the task diff, and confirm no fixture/data file, existing user-owned file, secret value, or app image URL was changed.

- [ ] **Step 3: Hand off production smoke tests**

  Ask the user to test prediction share, Bot `ผลทาย`, Bot `เมนู` plus each command button, app-button alignment/height, and PNG team crests after deployment.

- [x] **Step 4: Stop before commit/push**

  Report fresh evidence and wait for explicit approval.
