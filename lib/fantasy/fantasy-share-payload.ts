import { validateFlexMessage, type FlexMessage } from "../line/flex.ts";
import { fantasyPlayersTotalPoints, fantasySquadTotalPoints, formatFantasyShareTimestamp, playerDisplayPoints } from "./player-presentation.ts";
import { squadRows } from "./squad-layout.ts";
import type { FantasyEntryCurrentSquad, FantasySquadPlayer } from "./types.ts";

const BACKGROUND = "#071525";
const CARD_BACKGROUND = "#10253A";
const ACCENT = "#D9FF58";
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
  position: "GK" | "DEF" | "MID" | "FWD";
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
      flex: 0,
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
    contents: [text("⚽", "lg", "bold", PRIMARY_TEXT)],
  };
}

function profileImageOrFallback(url: string | null | undefined, fallback: string, size = "42px") {
  const imageUrl = safeImageUrl(url);
  return {
    type: "box",
    layout: "vertical",
    width: size,
    height: size,
    flex: 0,
    cornerRadius: "xxl",
    backgroundColor: "#29435D",
    justifyContent: "center",
    alignItems: "center",
    contents: imageUrl
      ? [{ type: "image", url: imageUrl, size: "full", aspectMode: "cover", aspectRatio: "1:1", flex: 0 }]
      : [text(initials(fallback), "xs", "bold", PRIMARY_TEXT)],
  };
}

function bubble(contents: Record<string, unknown>[], sharedAt: string): Record<string, unknown> {
  return {
    type: "bubble",
    size: "giga",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "14px",
      backgroundColor: BACKGROUND,
      contents: [...contents, text(sharedAt, "xxs", "regular", MUTED_TEXT)],
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

function fixedSpacer() {
  return {
    type: "box",
    layout: "vertical",
    width: "12px",
    height: "1px",
    flex: 0,
    contents: [{ type: "filler" }],
  };
}

function leaderboardRow(row: FantasyLeaderboardShareRow) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "xs",
    paddingAll: "9px",
    cornerRadius: "md",
    backgroundColor: row.rank === 1 ? "#233A2D" : CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      { ...text(String(row.rank), "sm", "bold", row.rank === 1 ? ACCENT : MUTED_TEXT), flex: 0 },
      fixedSpacer(),
      profileImageOrFallback(row.avatarUrl, row.managerName, "34px"),
      fixedSpacer(),
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          text(row.managerName, "sm", "bold"),
          text(`ทีม : ${row.teamName}`, "xs", "bold", ACCENT),
        ],
      },
      { ...text(`${row.points} คะแนน`, "sm", "bold", row.rank === 1 ? ACCENT : PRIMARY_TEXT), flex: 0 },
    ],
  };
}

function leaderboardRows(rows: FantasyLeaderboardShareRow[]) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    contents: rows.length ? rows.map(leaderboardRow) : [text("ยังไม่มีสมาชิกในอันดับ", "sm", "regular", MUTED_TEXT)],
  };
}

function leaderboardBubble(title: string, rows: FantasyLeaderboardShareRow[], pageLabel: string | undefined, sharedAt: string) {
  return bubble([
    text("ตารางคะแนน Fantasy", "lg", "bold", ACCENT),
    text(title, "sm", "bold"),
    text(pageLabel ?? "อันดับ · ผู้จัดการ · ทีม · คะแนน", "xs", "regular", MUTED_TEXT),
    leaderboardRows(rows),
  ], sharedAt);
}

function flexMessage(altText: string, contents: Record<string, unknown>): FlexMessage {
  return { type: "flex", altText, contents };
}

export function buildFantasyLeaderboardShareFlex(input: {
  leagueName: string;
  gameweek: number;
  period: "gameweek" | "season";
  rows: FantasyLeaderboardShareRow[];
  sharedAt?: string;
}): FlexMessage {
  const periodLabel = input.period === "gameweek" ? `GW ${input.gameweek}` : `ทั้งฤดูกาล · ถึง GW ${input.gameweek}`;
  const title = `${input.leagueName} · ${periodLabel}`;
  const altText = `FPL Chei Chei · ${title}`;
  const sharedAt = input.sharedAt ?? formatFantasyShareTimestamp();
  const singleBubbleMessage = flexMessage(altText, leaderboardBubble(title, input.rows, undefined, sharedAt));

  try {
    validateFlexMessage(singleBubbleMessage);
    return singleBubbleMessage;
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code !== "FLEX_MESSAGE_INVALID" && code !== "FLEX_MESSAGE_TOO_LARGE") throw error;
  }

  const pages = chunks(input.rows, 8);
  const bubbles = pages.length
    ? pages.map((page, index) => leaderboardBubble(title, page, index === 0 ? undefined : `หน้าที่ ${index + 1}`, sharedAt))
    : [leaderboardBubble(title, [], undefined, sharedAt)];
  return flexMessage(altText, container(bubbles));
}

function playerStatsRow(row: FantasyPlayerStatsShareRow) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "xs",
    paddingAll: "8px",
    cornerRadius: "md",
    backgroundColor: CARD_BACKGROUND,
    alignItems: "center",
    contents: [
      { ...text(String(row.rank), "sm", "bold", MUTED_TEXT), flex: 0 },
      fixedSpacer(),
      imageOrFallback(row.photoUrl, row.playerName, "34px"),
      fixedSpacer(),
      {
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [text(row.playerName, "sm", "bold"), text(row.clubName, "xs", "regular", MUTED_TEXT)],
      },
      { ...text(String(row.metricValue), "sm", "bold", ACCENT), flex: 0 },
    ],
  };
}

const playerStatPositions: Array<{ key: FantasyPlayerStatsShareRow["position"]; label: string }> = [
  { key: "FWD", label: "กองหน้า" },
  { key: "MID", label: "กองกลาง" },
  { key: "DEF", label: "กองหลัง" },
  { key: "GK", label: "GK" },
];

function playerStatsBubble(input: { gameweek: number; categoryLabel: string; categoryDescription?: string; positionLabel: string; rows: FantasyPlayerStatsShareRow[]; sharedAt: string }) {
  return bubble([
    text("สถิตินักเตะ Fantasy", "lg", "bold", ACCENT),
    text(`GW ${input.gameweek} · ${input.categoryLabel}${input.categoryDescription ? ` · ${input.categoryDescription}` : ""}`, "sm", "bold"),
    text(`ตำแหน่ง: ${input.positionLabel}`, "xs", "regular", MUTED_TEXT),
    {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: input.rows.length
        ? input.rows.slice(0, 10).map(playerStatsRow)
        : [text("ยังไม่มีข้อมูลตามหมวดหมู่ที่เลือก", "sm", "regular", MUTED_TEXT)],
    },
  ], input.sharedAt);
}

export function buildFantasyPlayerStatsShareFlex(input: {
  gameweek: number;
  categoryLabel: string;
  categoryDescription?: string;
  positionLabel: string;
  rows: FantasyPlayerStatsShareRow[];
  sharedAt?: string;
}): FlexMessage {
  const altText = `FPL Chei Chei · สถิตินักเตะ GW ${input.gameweek} · ${input.categoryLabel}`;
  const sharedAt = input.sharedAt ?? formatFantasyShareTimestamp();
  if (input.positionLabel !== "ทั้งหมด") {
    return flexMessage(altText, playerStatsBubble({ ...input, rows: input.rows.slice(0, 10), sharedAt }));
  }

  const bubbles = playerStatPositions.map(({ key, label }) =>
    playerStatsBubble({
      gameweek: input.gameweek,
      categoryLabel: input.categoryLabel,
      categoryDescription: input.categoryDescription,
      positionLabel: label,
      rows: input.rows.filter((row) => row.position === key).slice(0, 10),
      sharedAt,
    }),
  );
  return flexMessage(altText, container(bubbles));
}

const squadRowLabels: Record<"GK" | "DEF" | "MID" | "FWD" | "BENCH", string> = {
  GK: "GK",
  DEF: "กองหลัง",
  MID: "กองกลาง",
  FWD: "กองหน้า",
  BENCH: "ตัวสำรอง",
};

function squadPlayer(player: FantasySquadPlayer, highlightPlayerIds: ReadonlySet<number> = new Set<number>()) {
  const points = playerDisplayPoints(player);
  const highlighted = highlightPlayerIds.has(player.playerId);
  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    spacing: "xs",
    alignItems: "center",
    contents: [
      imageOrFallback(player.photoUrl, player.playerName, "42px"),
      text(player.playerName, "xs", "bold"),
      text(player.clubShortName ?? player.clubName, "xxs", "regular", MUTED_TEXT),
      text(points.label, "xs", "bold", player.isCaptain ? ACCENT : PRIMARY_TEXT),
      ...(highlighted ? [text("Player of the Week", "xxs", "bold", ACCENT)] : []),
    ],
    ...(highlighted ? { borderColor: ACCENT, backgroundColor: "#20361F" } : {}),
  };
}

function squadRow(row: ReturnType<typeof squadRows>[number], highlightPlayerIds: ReadonlySet<number> = new Set<number>()) {
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
        contents: row.players.length ? row.players.map((player) => squadPlayer(player, highlightPlayerIds)) : [text("ไม่มีข้อมูล", "xs", "regular", MUTED_TEXT)],
      },
    ],
  };
}

export function buildFantasySquadShareFlex(input: {
  managerName: string;
  managerAvatarUrl?: string | null;
  teamName: string;
  squad: FantasyEntryCurrentSquad;
  highlightPlayerIds?: ReadonlySet<number> | readonly number[];
  sharedAt?: string;
}): FlexMessage {
  const rows = squadRows(input.squad);
  const totalPoints = fantasySquadTotalPoints(input.squad);
  const sharedAt = input.sharedAt ?? formatFantasyShareTimestamp();
  const highlightPlayerIds = input.highlightPlayerIds instanceof Set ? input.highlightPlayerIds : new Set(input.highlightPlayerIds ?? []);
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
          profileImageOrFallback(input.managerAvatarUrl, input.managerName, "42px"),
          {
            type: "box",
            layout: "vertical",
            flex: 1,
            contents: [
              text(input.managerName, "md", "bold"),
              text(`ทีม : ${input.teamName}`, "sm", "bold", ACCENT),
              text(`ทีม GW ${input.squad.gameweekNumber} · แผน ${input.squad.formation}`, "xs", "regular", MUTED_TEXT),
            ],
          },
          {
            type: "box",
            layout: "vertical",
            flex: 0,
            alignItems: "flex-end",
            contents: [
              text("คะแนนรวม", "xs", "bold", MUTED_TEXT),
              text(totalPoints === null ? "—" : String(totalPoints), "lg", "bold", ACCENT),
            ],
          },
        ],
      },
      ...rows.map((row) => squadRow(row, highlightPlayerIds)),
    ], sharedAt),
  };
}

function teamOfWeekRow(label: string, players: FantasySquadPlayer[], highlightPlayerIds: ReadonlySet<number>) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    paddingAll: "8px",
    cornerRadius: "md",
    backgroundColor: CARD_BACKGROUND,
    contents: [
      text(label, "xs", "bold", ACCENT),
      {
        type: "box",
        layout: "horizontal",
        spacing: "xs",
        contents: players.length ? players.map((player) => squadPlayer(player, highlightPlayerIds)) : [text("ไม่มีข้อมูล", "xs", "regular", MUTED_TEXT)],
      },
    ],
  };
}

export function buildFantasyTeamOfWeekShareFlex(input: {
  gameweek: number;
  players: FantasySquadPlayer[];
  highlightPlayerIds?: ReadonlySet<number> | readonly number[];
  sharedAt?: string;
}): FlexMessage {
  const highlightPlayerIds = input.highlightPlayerIds instanceof Set ? input.highlightPlayerIds : new Set(input.highlightPlayerIds ?? []);
  const sharedAt = input.sharedAt ?? formatFantasyShareTimestamp();
  const totalPoints = fantasyPlayersTotalPoints(input.players);
  const positionRows: Array<{ key: FantasySquadPlayer["position"]; label: string }> = [
    { key: "GK", label: "GK" },
    { key: "DEF", label: "กองหลัง" },
    { key: "MID", label: "กองกลาง" },
    { key: "FWD", label: "กองหน้า" },
  ];
  return flexMessage(`FPL Official · Team of the Week GW ${input.gameweek}`, bubble([
    text("Team of the Week", "lg", "bold", ACCENT),
    text(`FPL Official · GW ${input.gameweek}`, "sm", "bold"),
    {
      type: "box",
      layout: "horizontal",
      justifyContent: "flex-end",
      contents: [text(`คะแนนรวม ${totalPoints === null ? "—" : totalPoints}`, "md", "bold", ACCENT)],
    },
    ...positionRows.map((row) => teamOfWeekRow(row.label, input.players.filter((player) => player.position === row.key), highlightPlayerIds)),
  ], sharedAt));
}

export function buildFantasyLeaderboardTopBottomShareFlex(input: {
  leagueName: string;
  gameweek: number;
  period: "gameweek" | "season";
  topRows: FantasyLeaderboardShareRow[];
  bottomRows: FantasyLeaderboardShareRow[];
  sharedAt?: string;
}): FlexMessage {
  const periodLabel = input.period === "gameweek" ? `GW ${input.gameweek}` : `ทั้งฤดูกาล · ถึง GW ${input.gameweek}`;
  const title = `${input.leagueName} · ${periodLabel}`;
  const sharedAt = input.sharedAt ?? formatFantasyShareTimestamp();
  return flexMessage(`FPL Chei Chei · ${title} · Top/Bottom`, container([
    leaderboardBubble(`${title} · Top 5`, input.topRows, undefined, sharedAt),
    leaderboardBubble(`${title} · Bottom 5`, input.bottomRows, undefined, sharedAt),
  ]));
}
