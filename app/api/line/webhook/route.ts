import { getLineServerEnv } from "../../../../lib/env.ts";
import { LineMessagingApiError, replyToLine } from "../../../../lib/line/messaging.ts";
import { verifyLineSignature } from "../../../../lib/line/signature.ts";
import {
  handleLineWebhookPayload,
  type LineBotCommandService,
  type LineWebhookPayload,
} from "../../../../lib/line/webhook.ts";

export const runtime = "nodejs";

type LineWebhookPostDependencies = {
  commandService?: LineBotCommandService;
  logger?: (...values: unknown[]) => void;
};

async function defaultCommandService(): Promise<LineBotCommandService> {
  const [{ createLineBotDataReader }, { createLineBotCommandService }] = await Promise.all([
    import("../../../../lib/data/line-bot.ts"),
    import("../../../../lib/line/webhook.ts"),
  ]);
  return createLineBotCommandService(createLineBotDataReader());
}

export function createLineWebhookPost(dependencies: LineWebhookPostDependencies = {}) {
  return async function post(request: Request): Promise<Response> {
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
      const hasTextEvent = payload.events.some((event) => event.type === "message" && event.message?.type === "text");
      const commandService = dependencies.commandService ?? (hasTextEvent
        ? await defaultCommandService()
        : { replyForText: async () => null });
      await handleLineWebhookPayload(payload, ({ replyToken, messages }) =>
        replyToLine({
          accessToken: lineEnv.channelAccessToken,
          replyToken,
          messages,
        }),
        commandService,
      );
      return Response.json({ ok: true });
    } catch (error) {
      const logger = dependencies.logger ?? console.error;
      if (error instanceof LineMessagingApiError) {
        logger("LINE_MESSAGING_API_REPLY_FAILED", error.diagnostic);
      } else {
        logger("LINE_WEBHOOK_REPLY_FAILED");
      }
      return Response.json({ error: "LINE reply failed" }, { status: 502 });
    }
  };
}

export const POST = createLineWebhookPost();
