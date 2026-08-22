import type { FlexMessage } from "../line/flex.ts";
import { playerDisplayPoints } from "./player-presentation.ts";
import { squadRows } from "./squad-layout.ts";
import type { FantasyEntryCurrentSquad, FantasySquadPlayer } from "./types.ts";

const BACKGROUND = "#071525";
const CARD_BACKGROUND = "#10253A";
const ACCENT = "#D9FF58";
const GREEN = "#7CFF8A";
const PRIMARY_TEXT = "#FFFFFF";
const MUTED_TEXT = "#8CA6BD";

type FantasyLeaderboardShareRow = {
  rank: number;
  managerName: string;
  teamName: string;
  points: number;
  avatarUrl: string | null;
};

type FantasyPlayerStatsShareRow = {
  rank: number;
  playerName: string;
  clubName: string;
  metricValue: number;
  photoUrl?: string;
};

function text(value: string, size = "sm", weight = "regular", color = PRIMARY_TEXT) {
  return { type: "text", text: value, size, weight, color, wrap: true };
}

function safeImageUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed?.startsWith("https://") || /\.svg(?:$|\?)/i.test(trimmed)) return undefined;
  return trimmed;
}

function initials(value: string): string {
  return value.trim().split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
}

function imageOrFallback(url: string | null | undefined, fallback: string, size = "36px") {
  const imageUrl = safeImageUrl(url);
  if (imageUrl) {
    return {
      type: "image",
      url: imageUrl,
      size,
      aspectMode: "cover",
      aspectRatio: "1:1",
    };
  }
  return {
    type: "box",
    layout: "vertical",
    width: size,
    height: size,
    cornerRadius: "xxl",
    backgroundColor: "#29435D",
    justifyContent: "center",
    alignItems: "center",
    contents: [text(initials(fallback), "xs", "bold", PRIMARY_TEXT)],
  };
}

function bubble(contents: Record<string, unknown>[]): Record<string, unknown> {
  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      backgroundColor: BACKGROUND,
      contents: [text("FPL CHEI CHEI", "xs", "bold", MUTED_TEXT)],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "14px",
      backgroundColor: BACKGROUND,
      contents,
    },
  };
}

function container(bubbles: Record<string, unknown>[]): Record<string, unknown> {
  return bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function leaderboardRow(row: FantasyLeaderboardShareRow) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingAll: "9px",
    cornerRadius: "md",
    backgroundColor: row.rank === 1 ? "#233A2D" : CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      text(String(row.rank), "sm", "bold", row.rank === 1 ? ACCENT : MUTED_TEXT),
      imageOrFallback(row.avatarUrl, row.managerName, "34px"),
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          text(row.managerName, "sm", "bold"),
          text(`ชื่อทีม : ${row.teamName}`, "xs", "bold", GREEN),
        ],
      },
      text(`${row.points} คะแนน`, "sm", "bold", row.rank === 1 ? ACCENT : PRIMARY_TEXT),
    ],
  };
}

export function buildFantasyLeaderboardShareFlex(input: {
  leagueName: string;
  gameweek: number;
  period: "gameweek" | "season";
  rows: FantasyLeaderboardShareRow[];
}): FlexMessage {
  const periodLabel = input.period === "gameweek" ? `GW ${input.gameweek}` : `ทั้งฤดูกาล · ถึง GW ${input.gameweek}`;
  const title = `${input.leagueName} · ${periodLabel}`;
  const pages = chunks(input.rows, 8);
  const bubbles = pages.map((page, index) => bubble([
    text("ตารางคะแนน Fantasy", "lg", "bold", ACCENT),
    text(title, "sm", "bold"),
    text(index === 0 ? "อันดับ · ผู้จัดการ · ทีม · คะแนน" : `หน้าที่ ${index + 1}`, "xs", "regular", MUTED_TEXT),
    ...(page.length ? page.map(leaderboardRow) : [text("ยังไม่มีสมาชิกในอันดับ", "sm", "regular", MUTED_TEXT)]),
  ]));

  return {
    type: "flex",
    altText: `FPL Chei Chei · ${title}`,
    contents: container(bubbles.length ? bubbles : [bubble([text("ยังไม่มีสมาชิกในอันดับ", "sm", "regular", MUTED_TEXT)])]),
  };
}

function playerStatsRow(row: FantasyPlayerStatsShareRow) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingAll: "8px",
    cornerRadius: "md",
    backgroundColor: CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      text(String(row.rank), "sm", "bold", MUTED_TEXT),
      imageOrFallback(row.photoUrl, row.playerName, "34px"),
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [text(row.playerName, "sm", "bold"), text(row.clubName, "xs", "regular", MUTED_TEXT)],
      },
      text(String(row.metricValue), "sm", "bold", ACCENT),
    ],
  };
}

export function buildFantasyPlayerStatsShareFlex(input: {
  gameweek: number;
  categoryLabel: string;
  positionLabel: string;
  rows: FantasyPlayerStatsShareRow[];
}): FlexMessage {
  const pages = chunks(input.rows.slice(0, 10), 8);
  const safePages = pages.length ? pages : [[]];
  const bubbles = safePages.map((page) =>
    bubble([
      text("สถิตินักเตะ Fantasy", "lg", "bold", ACCENT),
      text(`GW ${input.gameweek} · ${input.categoryLabel}`, "sm", "bold"),
      text(`ตำแหน่ง: ${input.positionLabel}`, "xs", "regular", MUTED_TEXT),
      ...(page.length
        ? page.map(playerStatsRow)
        : [text("ยังไม่มีข้อมูลตามหมวดหมู่ที่เลือก", "sm", "regular", MUTED_TEXT)]),
    ]),
  );

  return {
    type: "flex",
    altText: `FPL Chei Chei · สถิตินักเตะ GW ${input.gameweek} · ${input.categoryLabel}`,
    contents: container(bubbles),
  };
}

const squadRowLabels: Record<"GK" | "DEF" | "MID" | "FWD" | "BENCH", string> = {
  GK: "GK",
  DEF: "กองหลัง",
  MID: "กองกลาง",
  FWD: "กองหน้า",
  BENCH: "ตัวสำรอง",
};

function squadPlayer(player: FantasySquadPlayer) {
  const points = playerDisplayPoints(player);
  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    spacing: "xs",
    alignItems: "center",
    contents: [
      imageOrFallback(player.photoUrl, player.playerName, "42px"),
      text(player.playerName, "xs", "bold"),
      text(points.label, "xs", "bold", player.isCaptain ? ACCENT : PRIMARY_TEXT),
    ],
  };
}

function squadRow(row: ReturnType<typeof squadRows>[number]) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    paddingAll: "8px",
    cornerRadius: "md",
    backgroundColor: row.key === "BENCH" ? "#27364A" : CARD_BACKGROUND,
    contents: [
      text(squadRowLabels[row.key], "xs", "bold", row.key === "BENCH" ? MUTED_TEXT : ACCENT),
      {
        type: "box",
        layout: "horizontal",
        spacing: "xs",
        contents: row.players.length ? row.players.map(squadPlayer) : [text("ไม่มีข้อมูล", "xs", "regular", MUTED_TEXT)],
      },
    ],
  };
}

export function buildFantasySquadShareFlex(input: {
  managerName: string;
  managerAvatarUrl?: string | null;
  teamName: string;
  squad: FantasyEntryCurrentSquad;
}): FlexMessage {
  const rows = squadRows(input.squad);
  return {
    type: "flex",
    altText: `FPL Chei Chei · ทีม ${input.teamName} · GW ${input.squad.gameweekNumber}`,
    contents: bubble([
      {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        alignItems: "center",
        contents: [
          imageOrFallback(input.managerAvatarUrl, input.managerName, "42px"),
          {
            type: "box",
            layout: "vertical",
            flex: 1,
            contents: [
              text(input.managerName, "md", "bold"),
              text(`ชื่อทีม : ${input.teamName}`, "sm", "bold", GREEN),
              text(`ทีม GW ${input.squad.gameweekNumber} · แผน ${input.squad.formation}`, "xs", "regular", MUTED_TEXT),
            ],
          },
        ],
      },
      ...rows.map(squadRow),
    ]),
  };
}
