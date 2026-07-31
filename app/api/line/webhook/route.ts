import { getLineServerEnv } from "../../../../lib/env.ts";
import { replyToLine } from "../../../../lib/line/messaging.ts";
import { verifyLineSignature } from "../../../../lib/line/signature.ts";
import { handleLineWebhookPayload, type LineWebhookPayload } from "../../../../lib/line/webhook.ts";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? undefined;

  let lineEnv;
  try {
    lineEnv = getLineServerEnv();
  } catch {
    return Response.json({ error: "LINE webhook is not configured" }, { status: 500 });
  }

  if (!verifyLineSignature(body, signature, lineEnv.channelSecret)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: LineWebhookPayload;
  try {
    payload = JSON.parse(body) as LineWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (!Array.isArray(payload.events)) {
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    await handleLineWebhookPayload(payload, ({ replyToken, messages }) =>
      replyToLine({
        accessToken: lineEnv.channelAccessToken,
        replyToken,
        messages,
      }),
    );
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "LINE reply failed" }, { status: 502 });
  }
}
