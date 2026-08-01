import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createLineWebhookPost, POST } from "../../app/api/line/webhook/route.ts";
import { computeLineSignature } from "../../lib/line/signature.ts";

const previousSecret = process.env.LINE_CHANNEL_SECRET;
const previousToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const previousFetch = globalThis.fetch;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
  else process.env.LINE_CHANNEL_SECRET = previousSecret;
  if (previousToken === undefined) delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  else process.env.LINE_CHANNEL_ACCESS_TOKEN = previousToken;
  globalThis.fetch = previousFetch;
});

function configureLineTestEnv() {
  process.env.LINE_CHANNEL_SECRET = "channel-secret";
  process.env.LINE_CHANNEL_ACCESS_TOKEN = "access-token-for-test-only";
}

test("returns 401 without processing an invalid webhook signature", async () => {
  configureLineTestEnv();
  const body = JSON.stringify({ destination: "channel", events: [] });

  const response = await POST(new Request("https://example.test/api/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": "invalid" },
    body,
  }));

  assert.equal(response.status, 401);
});

test("returns 200 for a valid LINE verification payload", async () => {
  configureLineTestEnv();
  const body = JSON.stringify({ destination: "channel", events: [] });

  const response = await POST(new Request("https://example.test/api/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": computeLineSignature(body, "channel-secret") },
    body,
  }));

  assert.equal(response.status, 200);
});

test("replies to a valid approved command without exposing configuration values", async () => {
  configureLineTestEnv();
  const body = JSON.stringify({
    destination: "channel",
    events: [{
      type: "message",
      replyToken: "reply-token",
      source: { type: "group", groupId: "group-id", userId: "line-user-id" },
      message: { type: "text", id: "message-id", text: "ขอตาราง" },
    }],
  });
  let sentBody = "";
  globalThis.fetch = async (_input, init) => {
    sentBody = String(init?.body);
    return new Response(null, { status: 200 });
  };

  const response = await createLineWebhookPost({
    commandService: {
      async replyForText() {
        return [{ type: "text", text: "ตารางคะแนนทดสอบ" }];
      },
    },
  })(new Request("https://example.test/api/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": computeLineSignature(body, "channel-secret") },
    body,
  }));

  assert.equal(response.status, 200);
  assert.match(sentBody, /reply-token/);
  assert.match(sentBody, /ตารางคะแนนทดสอบ/);
  assert.doesNotMatch(sentBody, /channel-secret|access-token-for-test-only/);
});

test("returns 200 and does not call LINE when the text is unsupported", async () => {
  configureLineTestEnv();
  const body = JSON.stringify({
    destination: "channel",
    events: [{
      type: "message",
      replyToken: "reply-token",
      source: { type: "group", groupId: "group-id" },
      message: { type: "text", text: "ข้อความทั่วไป" },
    }],
  });
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  };

  const response = await createLineWebhookPost({
    commandService: { async replyForText() { return null; } },
  })(new Request("https://example.test/api/line/webhook", {
    method: "POST",
    headers: { "x-line-signature": computeLineSignature(body, "channel-secret") },
    body,
  }));

  assert.equal(response.status, 200);
  assert.equal(fetchCalls, 0);
});
