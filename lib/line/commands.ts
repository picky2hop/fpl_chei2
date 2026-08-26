import type { LineMessage } from "./messaging";
import { buildCommandMenuFlex } from "./flex.ts";

export type LineBotCommand = "menu" | "standings" | "todayFixtures" | "myPredictions" | "myFantasyTeam" | "predictionAwards" | "fantasyAwardsChei" | "fantasyAwardsKhao" | "fantasyTopBottomChei";

const aliases: Record<string, LineBotCommand> = {
  "ขอตาราง": "standings",
  "ตารางคะแนน": "standings",
  "คะแนน": "standings",
  "อันดับ": "standings",
  "บอลวันนี้": "todayFixtures",
  "โปรแกรมบอล": "todayFixtures",
  "คู่วันนี้": "todayFixtures",
  "ผลทาย": "myPredictions",
  "คำทาย": "myPredictions",
  "ทายผล": "myPredictions",
  "ทีมของฉัน": "myFantasyTeam",
  "แชมป์บ๊วยทายผล": "predictionAwards",
  "แชมป์บ๊วยเชย": "fantasyAwardsChei",
  "แชมป์บ๊วยเขาค้อ": "fantasyAwardsKhao",
  "top 5 + บ๊วย 5": "fantasyTopBottomChei",
  "เมนู": "menu",
  "ช่วย": "menu",
  "คำสั่ง": "menu",
};

function normalizeCommand(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
}

export function parseLineCommand(text: string): LineBotCommand | null {
  return aliases[normalizeCommand(text)] ?? null;
}

export function buildLineMenuMessage(): LineMessage {
  return buildCommandMenuFlex([
    {
      title: "เกมทายผลพรีเมียร์ลีก",
      rows: [
        [{ label: "ขอตารางทายผล", text: "ขอตาราง" }, { label: "ผลทายของฉัน", text: "ผลทาย" }],
        ["บอลวันนี้", "แชมป์บ๊วยทายผล"],
      ],
    },
    {
      title: "เกมแฟนตาซี",
      rows: [
        ["แชมป์บ๊วยเชย", "แชมป์บ๊วยเขาค้อ"],
        ["ทีมของฉัน", "Top 5 + บ๊วย 5"],
      ],
    },
  ]);
}
