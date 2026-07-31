import type { LineMessage } from "./messaging";

export type LineWebhookPayload = {
  destination?: string;
  events?: Array<{
    type?: string;
    replyToken?: string;
    source?: { type?: string; groupId?: string; userId?: string };
    message?: { type?: string; text?: string };
  }>;
};

export type LineReplyRequest = { replyToken: string; messages: LineMessage[] };
export type LineReply = (input: LineReplyRequest) => Promise<unknown>;

const acknowledgement: LineMessage = {
  type: "text",
  text: "ได้รับข้อความแล้วครับ 👋 ใช้ปุ่มแชร์จาก LIFF เพื่อแชร์ผลทายเข้า group ได้เลย",
};

export async function handleLineWebhookPayload(
  payload: LineWebhookPayload,
  reply: LineReply,
): Promise<{ processed: number; replied: number }> {
  const events = Array.isArray(payload.events) ? payload.events : [];
  let replied = 0;

  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) continue;
    await reply({ replyToken: event.replyToken, messages: [acknowledgement] });
    replied += 1;
  }

  return { processed: events.length, replied };
}
