import test from "node:test";
import assert from "node:assert/strict";
import { handleLineWebhookPayload } from "../../lib/line/webhook.ts";
import { replyToLine } from "../../lib/line/messaging.ts";

test("replies to a text message received from a LINE group", async () => {
  const replies: unknown[] = [];
  const result = await handleLineWebhookPayload(
    {
      destination: "channel",
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "group", groupId: "group-id" },
        message: { type: "text", id: "message-id", text: "ทดสอบบอท" },
      }],
    },
    async (reply) => { replies.push(reply); },
  );

  assert.deepEqual(result, { processed: 1, replied: 1 });
  assert.deepEqual(replies, [{
    replyToken: "reply-token",
    messages: [{
      type: "text",
      text: "ได้รับข้อความแล้วครับ 👋 ใช้ปุ่มแชร์จาก LIFF เพื่อแชร์ผลทายเข้า group ได้เลย",
    }],
  }]);
});

test("ignores LINE verification payloads and non-text events", async () => {
  const replies: unknown[] = [];
  const result = await handleLineWebhookPayload(
    { destination: "channel", events: [{ type: "follow", replyToken: "unused" }] },
    async (reply) => { replies.push(reply); },
  );

  assert.deepEqual(result, { processed: 1, replied: 0 });
  assert.deepEqual(replies, []);
});

test("sends a reply through the LINE Messaging API endpoint", async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const response = await replyToLine({
    accessToken: "access-token-for-test-only",
    replyToken: "reply-token",
    messages: [{ type: "text", text: "hello" }],
    fetchImpl: async (input, init) => {
      request = { url: String(input), init };
      return new Response(null, { status: 200 });
    },
  });

  assert.equal(response.ok, true);
  assert.equal(request?.url, "https://api.line.me/v2/bot/message/reply");
  assert.equal(request?.init?.method, "POST");
  assert.equal(request?.init?.headers && new Headers(request.init.headers).get("authorization"), "Bearer access-token-for-test-only");
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    replyToken: "reply-token",
    messages: [{ type: "text", text: "hello" }],
  });
});
