import { buildLineMenuMessage, parseLineCommand } from "./commands.ts";
import { buildPredictionResultFlex, buildStandingsFlex, buildTodayFixturesFlex } from "./flex.ts";
import type { LineMessage } from "./messaging.ts";

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

export type LineBotDataReader = {
  getCurrentStandings: () => Promise<{
    gameweek: number;
    rows: Array<{ rank: number; displayName: string; avatarUrl: string; points: number }>;
  }>;
  getTodayFixtures: (now: Date) => Promise<{
    dateLabel: string;
    fixtures: Array<{
      kickoffLabel: string;
      statusLabel: string;
      homeTeam: { name: string; logoUrl?: string };
      awayTeam: { name: string; logoUrl?: string };
    }>;
  }>;
  getUserPredictions: (lineUserId: string) => Promise<{
    gameweek: number;
    displayName: string;
    avatarUrl: string;
    fixtures: Array<{
      homeTeam: { name: string; logoUrl?: string };
      awayTeam: { name: string; logoUrl?: string };
      choice: "home" | "draw" | "away";
    }>;
  } | null>;
};

export type LineBotCommandService = {
  replyForText(input: { text: string; lineUserId?: string }): Promise<LineMessage[] | null>;
};

const unknownUserMessage: LineMessage = {
  type: "text",
  text: "กรุณาเปิดแอป FPL Chei Chei ก่อน เพื่อเชื่อมบัญชี LINE",
};

const dataUnavailableMessage: LineMessage = {
  type: "text",
  text: "ขออภัย ระบบยังโหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้งครับ",
};

export function createLineBotCommandService(data: LineBotDataReader): LineBotCommandService {
  return {
    async replyForText(input) {
      const command = parseLineCommand(input.text);
      if (!command) return null;

      if (command === "menu") return [buildLineMenuMessage()];
      if (command === "standings") {
        let standings;
        try {
          standings = await data.getCurrentStandings();
        } catch {
          return [dataUnavailableMessage];
        }
        return [buildStandingsFlex({ period: "gameweek", gameweek: standings.gameweek, rows: standings.rows })];
      }
      if (command === "todayFixtures") {
        let fixtures;
        try {
          fixtures = await data.getTodayFixtures(new Date());
        } catch {
          return [dataUnavailableMessage];
        }
        return [buildTodayFixturesFlex(fixtures)];
      }
      if (!input.lineUserId) return [unknownUserMessage];

      let predictions;
      try {
        predictions = await data.getUserPredictions(input.lineUserId);
      } catch {
        return [dataUnavailableMessage];
      }
      if (!predictions) return [unknownUserMessage];
      return [buildPredictionResultFlex(predictions)];
    },
  };
}

export async function handleLineWebhookPayload(
  payload: LineWebhookPayload,
  reply: LineReply,
  commandService: LineBotCommandService,
): Promise<{ processed: number; replied: number }> {
  const events = Array.isArray(payload.events) ? payload.events : [];
  let replied = 0;

  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken || !event.message.text) continue;
    const messages = await commandService.replyForText({ text: event.message.text, lineUserId: event.source?.userId });
    if (!messages?.length) continue;
    await reply({ replyToken: event.replyToken, messages });
    replied += 1;
  }

  return { processed: events.length, replied };
}
