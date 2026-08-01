import type { LineMessage } from "./messaging";

export type LineBotCommand = "menu" | "standings" | "todayFixtures" | "myPredictions";

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
  return {
    type: "text",
    text: [
      "คำสั่งที่ใช้ได้ครับ",
      "• ขอตาราง — ตารางคะแนน GW ปัจจุบัน",
      "• บอลวันนี้ — โปรแกรมแข่งวันนี้",
      "• ผลทาย — ผลทายของคุณ",
      "• เมนู — แสดงรายการคำสั่งนี้",
    ].join("\n"),
  };
}
