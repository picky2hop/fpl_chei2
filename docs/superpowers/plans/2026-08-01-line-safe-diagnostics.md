# LINE Safe Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture LINE Messaging API validation details safely so the rejected prediction Flex property can be identified from production logs.

**Architecture:** Convert non-success LINE reply responses into a typed error containing only allow-listed diagnostic fields. Inject a logger into the webhook route and log that safe object while preserving the existing generic client response.

**Tech Stack:** TypeScript, Next.js App Router route handlers, Node test runner, LINE Messaging API.

## Global Constraints

- Do not log or expose LINE channel secrets, channel access tokens, reply tokens, webhook signatures, request bodies, or environment values.
- Do not change successful webhook behavior or the generic HTTP 502 response.
- Do not commit or push without explicit approval.
- Use `npm.cmd` on Windows.

---

### Task 1: Parse allow-listed LINE API diagnostics

**Files:**
- Modify: `lib/line/messaging.ts`
- Test: `tests/line/webhook.test.mts`

**Interfaces:**
- Produces: `LineMessagingApiError` with `diagnostic: { status: number; message?: string; details?: Array<{ message?: string; property?: string }> }`.
- Preserves: `replyToLine(input): Promise<Response>` on successful responses.

- [x] **Step 1: Write a failing test for a documented LINE error response**

Create a fake HTTP 400 response containing `message`, `details`, and an unrelated sensitive-looking field. Assert that `replyToLine()` rejects with a `LineMessagingApiError` whose diagnostic contains only status, message, and details.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- tests/line/webhook.test.mts`

Expected: FAIL because `LineMessagingApiError` and parsed diagnostics do not exist.

- [x] **Step 3: Implement the minimal typed error and parser**

Read the failed response body once, accept only string `message`, string `details[].message`, and string `details[].property`, and fall back to `{ status }` if parsing fails.

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- tests/line/webhook.test.mts`

Expected: PASS.

### Task 2: Log only safe diagnostics from the webhook route

**Files:**
- Modify: `app/api/line/webhook/route.ts`
- Test: `tests/api/line-webhook-route.test.mts`

**Interfaces:**
- Consumes: `LineMessagingApiError` from Task 1.
- Produces: optional `logger` dependency receiving a fixed event string and an allow-listed diagnostic object.

- [x] **Step 1: Write a failing route test**

Make the fake LINE endpoint return HTTP 400 with documented fields plus unrelated fields. Capture the injected logger arguments and assert the log contains the status/property detail but not the access token, reply token, channel secret, request body, or unrelated fields. Assert the route still returns the generic 502 JSON response.

- [x] **Step 2: Run the focused route test and verify RED**

Run: `npm.cmd test -- tests/api/line-webhook-route.test.mts`

Expected: FAIL because the route has no logger dependency and currently discards the error.

- [x] **Step 3: Implement minimal safe route logging**

Add an injectable logger defaulting to `console.error`. Log a fixed event and `error.diagnostic` for `LineMessagingApiError`; log only a fixed generic event for unknown errors.

- [x] **Step 4: Run the focused route test and verify GREEN**

Run: `npm.cmd test -- tests/api/line-webhook-route.test.mts`

Expected: PASS with the existing generic response unchanged.

### Task 3: Full verification and handoff

**Files:**
- Review all modified files above.

**Interfaces:**
- Produces: verified local diagnostic patch ready for user review.

- [x] **Step 1: Run the full automated test suite**

Run: `npm.cmd run test`

Expected: all tests pass.

- [x] **Step 2: Run lint and production build**

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Expected: both commands exit 0.

- [x] **Step 3: Check patch integrity and scope**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; only the approved diagnostic files and pre-existing user-owned changes are present.

- [ ] **Step 4: Request commit/push approval**

Do not stage, commit, or push until the user explicitly approves deployment of this diagnostic patch.
