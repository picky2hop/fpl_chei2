import type { LineMessage, LineTextV2Message } from "./messaging.ts";

type AnnouncementRecipient = {
  lineUserId: string | null;
  displayName: string;
};

export type PredictionAwardsAnnouncementInput = {
  gameweek: number;
  champions: AnnouncementRecipient[];
  woodenSpoons: AnnouncementRecipient[];
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
  return buildAwardsAnnouncement({ ...input, heading: "เกมทายผลพรีเมียร์ลีก" });
}

export function buildFantasyAwardsAnnouncement(input: FantasyAwardsAnnouncementInput): LineMessage {
  return buildAwardsAnnouncement({ ...input, heading: `แฟนตาซี ${input.leagueName}` });
}
