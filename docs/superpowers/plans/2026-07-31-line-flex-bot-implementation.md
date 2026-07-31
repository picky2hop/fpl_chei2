# LINE Flex Share and Bot Reply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้แชร์ prediction-result Flex Message เข้า LINE group ผ่าน LIFF และให้ LINE Official Account ที่อยู่ในกลุ่มรับข้อความจากสมาชิกแล้ว reply กลับผ่าน Messaging API webhook

**Architecture:** Flex builders เป็น pure TypeScript functions ที่รับข้อมูล domain แบบ serializable และคืนค่า LINE message payload โดยไม่แตะ Supabase หรือ secret. LIFF เรียก `shareTargetPicker` จาก client หลังตรวจ availability. Webhook Route Handler อ่าน raw body, ตรวจ `x-line-signature`, แล้วส่ง reply ผ่าน server-only LINE client ที่รับ access token จาก environment เท่านั้น.

**Tech Stack:** Next.js 16.2.12 App Router Route Handler, React client component, `@line/liff` 2.29.1, Web Crypto/Node crypto HMAC-SHA256, Node built-in test runner, TypeScript.

## Global Constraints

- ใช้ `npm.cmd` บน Windows
- ห้ามขอ รับ หรือบันทึก `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `FPL_SYNC_TOKEN`, `SESSION_SECRET` หรือ Supabase key ผ่านแชท, Git หรือเอกสาร
- ห้ามทำ push หรือ broadcast ในรอบนี้
- ห้ามแก้ fixture จริงหรือเขียนข้อมูล production Supabase เพื่อทดสอบ
- Webhook ต้องตรวจ signature จาก raw request body ก่อน parse JSON
- Webhook ที่ไม่มี event ต้องตอบ HTTP 200 เพื่อรองรับ LINE Developers Console Verify
- ห้าม commit หรือ push จนกว่าผู้ใช้จะ review และอนุมัติ

## File Map

- Create `lib/line/flex.ts`: pure prediction-result Flex builder และ shared LINE message types
- Create `lib/line/signature.ts`: raw-body HMAC-SHA256 verifier
- Create `lib/line/messaging.ts`: server-only reply client with injectable fetch
- Create `lib/line/webhook.ts`: webhook event parsing and reply decision logic
- Create `lib/line/share.ts`: LIFF share target picker adapter with explicit success/cancel/unavailable results
- Create `app/api/line/webhook/route.ts`: Next.js POST handler and safe HTTP error mapping
- Modify `app/components/prediction-app-final.tsx`: connect approved share buttons to LIFF share target picker
- Create `tests/line/flex.test.mts`: deterministic Flex payload tests
- Create `tests/line/signature.test.mts`: signature tests
- Create `tests/line/webhook.test.mts`: webhook reply decision and messaging client tests
- Create `tests/line/share.test.mts`: LIFF share adapter tests
- Create `tests/api/line-webhook-route.test.mts`: route boundary tests with Request objects

### Task 1: Define failing tests for pure payload and signature behavior

**Files:**
- Create: `tests/line/flex.test.mts`
- Create: `tests/line/signature.test.mts`

**Interfaces:**
- Expected `buildPredictionResultFlex(input)` returns one LINE Flex message with `type: "flex"`, non-empty `altText`, a bubble `contents`, and only serializable values.
- Expected `computeLineSignature(body, channelSecret)` returns base64 HMAC-SHA256.
- Expected `verifyLineSignature(body, receivedSignature, channelSecret)` returns false for missing, changed, or malformed signatures.

- [ ] Write tests that import the not-yet-created modules and assert prediction result content, payload shape, known HMAC vector, and invalid signatures.
- [ ] Run `npm.cmd test -- tests/line/flex.test.mts tests/line/signature.test.mts` and confirm failure is due to missing behavior/modules.

### Task 2: Define failing tests for reply client and webhook behavior

**Files:**
- Create: `tests/line/webhook.test.mts`
- Create: `tests/api/line-webhook-route.test.mts`

**Interfaces:**
- Expected `replyToLine({ replyToken, messages, accessToken, fetchImpl })` POSTs to `/v2/bot/message/reply` with JSON body and bearer authorization.
- Expected `handleLineWebhookPayload(payload, reply)` replies to a text event with a short acknowledgement and ignores unsupported events without throwing.
- Expected the route returns 401 for absent/invalid signature, 200 for `{ events: [] }`, 200 after a valid reply, and a safe 500/502 response without secret values when LINE reply fails.

- [ ] Write tests using fake tokens and injected fetch; no production credentials.
- [ ] Run the focused tests and confirm they fail because the client, handler, and route do not exist.

### Task 3: Implement the minimum pure LINE modules

**Files:**
- Create: `lib/line/flex.ts`
- Create: `lib/line/signature.ts`
- Create: `lib/line/messaging.ts`
- Create: `lib/line/webhook.ts`

- [ ] Implement the smallest payload builder that supports the approved prediction-result share.
- [ ] Implement HMAC-SHA256 and timing-safe signature comparison without logging body, secret, token, or received signature.
- [ ] Implement reply client with server-only environment access at the call boundary and injected `fetch` for tests.
- [ ] Implement text-event acknowledgement and safe handling of empty/unsupported events.
- [ ] Run focused tests and confirm they pass.

### Task 4: Add the Next.js webhook Route Handler

**Files:**
- Create: `app/api/line/webhook/route.ts`

- [ ] Read the request body exactly once as text.
- [ ] Read `x-line-signature`, load server-only channel secret/access token through the existing env pattern, and verify before JSON parsing.
- [ ] Return 200 for LINE URL verification payloads with no events.
- [ ] Return a stable non-secret error response for invalid signature, malformed JSON, missing configuration, and LINE API failure.
- [ ] Run route tests and the existing test suite.

### Task 5: Connect LIFF share flow

**Files:**
- Modify: `app/components/prediction-app-final.tsx`
- Modify: `app/components/liff-gate.tsx` only if a shared initialized LIFF state is required by the existing component boundary

- [ ] Build the prediction Flex payload from the currently selected user, gameweek, fixtures, and predictions.
- [ ] Call `liff.isApiAvailable("shareTargetPicker")` before `liff.shareTargetPicker([message])`.
- [ ] Keep the existing modal open until share resolves; distinguish success, user cancellation, unsupported environment, and unexpected failure with Thai copy that never includes secrets.
- [ ] Leave the leaderboard button disabled or unchanged unless its payload is fully wired; do not claim a successful share when no API call occurred.
- [ ] Run lint, build, and focused tests.

### Task 6: Verification handoff

- [ ] Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- [ ] Verify no secret-like values were added with a targeted read-only search.
- [ ] Manually test LIFF share in LINE WebView using the user-selected test group.
- [ ] Use LINE Developers Console Verify and send a text message from the group to verify bot reply.
- [ ] Record evidence separately as LIFF share and Bot webhook/reply; record push/broadcast as not implemented in this round.
