# LINE Safe Diagnostics Design

## Problem

The production webhook returns HTTP 502 only when replying with the prediction Flex Message. The same prediction Flex also fails through LIFF sharing. The current Messaging API wrapper discards LINE's JSON error body, so Vercel logs cannot identify the rejected request property.

## Approved behavior

- Parse only LINE's documented error fields: HTTP status, top-level `message`, and each `details[].message` / `details[].property` pair.
- Never include the channel access token, reply token, request body, webhook signature, or environment values in the diagnostic object or server log.
- Keep the webhook response generic: `{ "error": "LINE reply failed" }` with HTTP 502.
- Preserve successful reply behavior unchanged.
- Treat malformed or non-JSON LINE error bodies as a status-only diagnostic.

## Design

`replyToLine()` will throw a dedicated `LineMessagingApiError` after a non-success response. The error exposes a small `diagnostic` object containing only allow-listed fields parsed from the LINE response.

The webhook route will accept an injectable logger for tests. Its catch block will log a fixed event name plus the safe diagnostic only when the caught error is `LineMessagingApiError`; unknown errors will log only a fixed generic event. The HTTP response remains unchanged.

## Verification

- Unit test a documented LINE 400 response and assert the safe diagnostic fields.
- Unit test malformed response handling.
- Route test that captures the logger output and proves access token, reply token, channel secret, and unrelated response fields are absent.
- Run the complete test suite, lint, production build, and `git diff --check`.

Deployment and production triggering require a separately approved commit and push.
