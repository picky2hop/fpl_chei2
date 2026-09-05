import type { LineMessage, LineTextV2Message } from "./messaging.ts";

type AnnouncementRecipient = {
  lineUserId: string | null;
  displayName: string;
};

export type PredictionAwardsAnnouncementInput = {
  gameweek: number;
  champions: AnnouncementRecipient[];
  woodenSpoons: AnnouncementRecipient[];
  nonChampions: AnnouncementRecipient[];
  allowMentions: boolean;
};

export type FantasyAwardsAnnouncementInput = {
  leagueName: string;
  gameweek: number;
  champions: AnnouncementRecipient[];
  woodenSpoons: AnnouncementRecipient[];
  allowMentions: boolean;
};

const MAX_MENTIONS = 20;

function displayNames(recipients: AnnouncementRecipient[]) {
  return recipients.length ? recipients.map((recipient) => recipient.displayName).join(" และ ") : "ไม่มีผู้ได้รับรางวัล";
}

function predictionAnnouncementPlainText(input: PredictionAwardsAnnouncementInput) {
  const nonChampionLines = input.nonChampions.length
    ? input.nonChampions.map((recipient) => recipient.displayName)
    : ["ไม่มีผู้เล่นที่ไม่ใช่แชมป์"];
  return [
    `🎉 ผลตัดสินเกมทายผลพรีเมียร์ลีก GW ${input.gameweek}`,
    `🏆 แชมป์: ${displayNames(input.champions)}`,
    `👥 ผู้เล่นที่ไม่ใช่แชมป์ จำนวน ${input.nonChampions.length} คน:`,
    ...nonChampionLines,
    "💸 โอนเงินให้แชมป์คนละ 50 บาทด้วยนะครับ 🙏💰",
    "ยินดีด้วยครับทุกคน 👏🎊",
  ].join("\n");
}

function predictionChampionLine(
  recipients: AnnouncementRecipient[],
  substitution: LineTextV2Message["substitution"],
) {
  let mentionCount = 0;
  const text = recipients.length
    ? recipients.map((recipient, index) => {
      const key = `champion_${index + 1}`;
      if (!recipient.lineUserId || mentionCount >= MAX_MENTIONS) return recipient.displayName;
      mentionCount += 1;
      substitution[key] = {
        type: "mention",
        mentionee: { type: "user", userId: recipient.lineUserId },
      };
      return `{${key}}`;
    }).join(" และ ")
    : "ไม่มีผู้ได้รับรางวัล";
  return { text, mentionCount };
}

export function buildPredictionAwardsAnnouncements(input: PredictionAwardsAnnouncementInput): LineMessage[] {
  if (!input.allowMentions) return [{ type: "text", text: predictionAnnouncementPlainText(input) }];

  const firstSubstitution: LineTextV2Message["substitution"] = {};
  const champion = predictionChampionLine(input.champions, firstSubstitution);
  const chunks: Array<{ lines: string[]; substitution: LineTextV2Message["substitution"] }> = [];
  let current = { lines: [] as string[], substitution: firstSubstitution, mentionCount: champion.mentionCount };

  input.nonChampions.forEach((recipient, index) => {
    if (recipient.lineUserId && current.mentionCount >= MAX_MENTIONS && current.lines.length > 0) {
      chunks.push({ lines: current.lines, substitution: current.substitution });
      current = { lines: [], substitution: {}, mentionCount: 0 };
    }

    if (!recipient.lineUserId || current.mentionCount >= MAX_MENTIONS) {
      current.lines.push(recipient.displayName);
      return;
    }

    const key = `non_champion_${index + 1}`;
    current.substitution[key] = {
      type: "mention",
      mentionee: { type: "user", userId: recipient.lineUserId },
    };
    current.mentionCount += 1;
    current.lines.push(`{${key}}`);
  });

  if (current.lines.length === 0) current.lines.push("ไม่มีผู้เล่นที่ไม่ใช่แชมป์");
  chunks.push({ lines: current.lines, substitution: current.substitution });

  return chunks.map((chunk, index) => {
    const text = index === 0
      ? [
        `🎉 ผลตัดสินเกมทายผลพรีเมียร์ลีก GW ${input.gameweek}`,
        `🏆 แชมป์: ${champion.text}`,
        `👥 ผู้เล่นที่ไม่ใช่แชมป์ จำนวน ${input.nonChampions.length} คน:`,
        ...chunk.lines,
        "💸 โอนเงินให้แชมป์คนละ 50 บาทด้วยนะครับ 🙏💰",
        "ยินดีด้วยครับทุกคน 👏🎊",
      ].join("\n")
      : ["👥 ผู้เล่นที่ไม่ใช่แชมป์ (ต่อ):", ...chunk.lines].join("\n");
    return Object.keys(chunk.substitution).length
      ? { type: "textV2", text, substitution: chunk.substitution }
      : { type: "text", text };
  });
}

function buildAwardsAnnouncement(input: { heading: string; gameweek: number; champions: AnnouncementRecipient[]; woodenSpoons: AnnouncementRecipient[]; allowMentions: boolean }): LineMessage {
  const plainText = [
    `🎉 ผลตัดสิน${input.heading} GW ${input.gameweek}`,
    `🏆 แชมป์: ${displayNames(input.champions)}`,
    `🥄 บ๊วย: ${displayNames(input.woodenSpoons)}`,
    "ยินดีด้วยครับทุกคน 👏🎊",
  ].join("\n");

  if (!input.allowMentions) return { type: "text", text: plainText };

  let mentionCount = 0;
  const substitution: LineTextV2Message["substitution"] = {};
  const render = (role: "champion" | "wooden_spoon", recipients: AnnouncementRecipient[]) => {
    if (!recipients.length) return "ไม่มีผู้ได้รับรางวัล";
    return recipients.map((recipient, index) => {
      const key = `${role}_${index + 1}`;
      if (!recipient.lineUserId || mentionCount >= MAX_MENTIONS) return recipient.displayName;
      mentionCount += 1;
      substitution[key] = {
        type: "mention",
        mentionee: { type: "user", userId: recipient.lineUserId },
      };
      return `{${key}}`;
    }).join(" และ ");
  };

  const text = [
    `🎉 ผลตัดสิน${input.heading} GW ${input.gameweek}`,
    `🏆 แชมป์: ${render("champion", input.champions)}`,
    `🥄 บ๊วย: ${render("wooden_spoon", input.woodenSpoons)}`,
    "ยินดีด้วยครับทุกคน 👏🎊",
  ].join("\n");

  return Object.keys(substitution).length
    ? { type: "textV2", text, substitution }
    : { type: "text", text: plainText };
}

export function buildPredictionAwardsAnnouncement(input: PredictionAwardsAnnouncementInput): LineMessage {
  return buildPredictionAwardsAnnouncements(input)[0] ?? { type: "text", text: predictionAnnouncementPlainText(input) };
}

export function buildFantasyAwardsAnnouncement(input: FantasyAwardsAnnouncementInput): LineMessage {
  return buildAwardsAnnouncement({ ...input, heading: `แฟนตาซี ${input.leagueName}` });
}
