import test from "node:test";
import assert from "node:assert/strict";
import { createLineBotCommandService, handleLineWebhookPayload, type LineBotCommandService } from "../../lib/line/webhook.ts";
import { replyToLine } from "../../lib/line/messaging.ts";

function fakeCommandService(
  result: Awaited<ReturnType<LineBotCommandService["replyForText"]>>,
  calls: Array<{ text: string; lineUserId?: string }>,
): LineBotCommandService {
  return {
    async replyForText(input) {
      calls.push(input);
      return result;
    },
  };
}

test("replies to an approved command and passes the sender LINE user ID", async () => {
  const replies: unknown[] = [];
  const calls: Array<{ text: string; lineUserId?: string }> = [];
  const result = await handleLineWebhookPayload(
    {
      destination: "channel",
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "group", groupId: "group-id", userId: "line-user-id" },
        message: { type: "text", text: "ผลทาย" },
      }],
    },
    async (reply) => { replies.push(reply); },
    fakeCommandService([{ type: "flex", altText: "prediction", contents: { type: "bubble" } }], calls),
  );

  assert.deepEqual(result, { processed: 1, replied: 1 });
  assert.deepEqual(calls, [{ text: "ผลทาย", lineUserId: "line-user-id" }]);
  assert.deepEqual(replies, [{
    replyToken: "reply-token",
    messages: [{ type: "flex", altText: "prediction", contents: { type: "bubble" } }],
  }]);
});

test("does not reply to unsupported text", async () => {
  const replies: unknown[] = [];
  const calls: Array<{ text: string; lineUserId?: string }> = [];
  const result = await handleLineWebhookPayload(
    {
      destination: "channel",
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "group", groupId: "group-id" },
        message: { type: "text", text: "ข้อความทั่วไป" },
      }],
    },
    async (reply) => { replies.push(reply); },
    fakeCommandService(null, calls),
  );

  assert.deepEqual(result, { processed: 1, replied: 0 });
  assert.deepEqual(calls, [{ text: "ข้อความทั่วไป", lineUserId: undefined }]);
  assert.deepEqual(replies, []);
});

test("returns a safe reply when an approved data command cannot load data", async () => {
  const service = createLineBotCommandService({
    async getCurrentStandings() { throw new Error("database details must stay private"); },
    async getTodayFixtures() { throw new Error("database details must stay private"); },
    async getUserPredictions() { throw new Error("database details must stay private"); },
  });

  const messages = await service.replyForText({ text: "บอลวันนี้" });
  assert.equal(messages?.[0]?.type, "text");
  assert.match(messages?.[0]?.type === "text" ? messages[0].text : "", /ลองใหม่|ยังโหลดข้อมูล/);
  assert.doesNotMatch(JSON.stringify(messages), /database details|secret|token/i);
});

test("returns the interactive Flex command menu for the menu command", async () => {
  const service = createLineBotCommandService({
    async getCurrentStandings() { throw new Error("must not load standings for menu"); },
    async getTodayFixtures() { throw new Error("must not load fixtures for menu"); },
    async getUserPredictions() { throw new Error("must not load predictions for menu"); },
  });

  const messages = await service.replyForText({ text: "เมนู" });
  assert.equal(messages?.length, 1);
  assert.equal(messages?.[0]?.type, "flex");
  assert.match(JSON.stringify(messages), /"type":"message","label":"ขอตาราง","text":"ขอตาราง"/);
});

test("ignores LINE verification payloads and non-text events", async () => {
  const replies: unknown[] = [];
  const calls: Array<{ text: string; lineUserId?: string }> = [];
  const result = await handleLineWebhookPayload(
    { destination: "channel", events: [{ type: "follow", replyToken: "unused" }] },
    async (reply) => { replies.push(reply); },
    fakeCommandService(null, calls),
  );

  assert.deepEqual(result, { processed: 1, replied: 0 });
  assert.deepEqual(calls, []);
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
