import type { PredictionChoice, FlexTeam } from "../line/flex.ts";
import { sortFixturesForFplOrder } from "./fixture-order.ts";

const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

export type StandingsData = {
  gameweek: number;
  rows: Array<{
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl: string;
    points: number;
  }>;
};

export type TodayFixturesData = {
  dateLabel: string;
  fixtures: Array<{
    dayLabel: string;
    kickoffLabel: string;
    scoreLabel?: string;
    statusLabel: string;
    homeTeam: FlexTeam;
    awayTeam: FlexTeam;
  }>;
};

export type UserPredictionData = {
  gameweek: number;
  displayName: string;
  avatarUrl: string;
  fixtures: Array<{
    homeTeam: FlexTeam;
    awayTeam: FlexTeam;
    choice: PredictionChoice;
    kickoffAt: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  }>;
};

export type ActiveGameweek = {
  id: string;
  number: number;
  isCurrent: boolean;
};

export type AwardGameweek = {
  id: string;
  number: number;
  status: "open" | "upcoming" | "closed" | "reopened";
};

export type PredictionAwardRow = {
  gameweekId: string;
  gameweek: number;
  award: "champion" | "wooden_spoon";
  userId: string;
  lineUserId: string | null;
  displayName: string;
  avatarUrl: string | null;
  points: number;
};

export type PredictionAwardRecipient = {
  userId: string;
  lineUserId: string | null;
  displayName: string;
  avatarUrl: string;
  points: number;
};

export type PredictionAwardsData = {
  gameweek: number;
  champions: PredictionAwardRecipient[];
  woodenSpoons: PredictionAwardRecipient[];
};

export type FantasyAwardRow = {
  leagueFplId: number;
  leagueName: string;
  gameweek: number;
  award: "champion" | "wooden_spoon";
  entryId: number;
  lineUserId: string | null;
  displayName: string;
  avatarUrl: string | null;
  teamName: string;
  managerName: string;
  points: number;
};

export type FantasyAwardRecipient = {
  entryId: number;
  lineUserId: string | null;
  displayName: string;
  avatarUrl: string;
  teamName: string;
  managerName: string;
  points: number;
};

export type FantasyAwardsData = {
  leagueFplId: number;
  leagueName: string;
  gameweek: number;
  champions: FantasyAwardRecipient[];
  woodenSpoons: FantasyAwardRecipient[];
};

export function selectActiveGameweek(gameweeks: ActiveGameweek[]): ActiveGameweek | null {
  return gameweeks.find((gameweek) => gameweek.isCurrent) ?? [...gameweeks].sort((left, right) => left.number - right.number)[0] ?? null;
}

export function selectLatestAwardedGameweek(
  gameweeks: readonly AwardGameweek[],
  awards: readonly { gameweekId: string }[],
): AwardGameweek | null {
  const awardedGameweekIds = new Set(awards.map((award) => award.gameweekId));
  return [...gameweeks]
    .filter((gameweek) => gameweek.status === "closed" && awardedGameweekIds.has(gameweek.id))
    .sort((left, right) => right.number - left.number)[0] ?? null;
}

export type PredictionAwardScore = {
  userId: string;
  points: number;
};

export type PredictionAwardSelection = {
  gameweekId: string;
  gameweek: number;
  award: "champion" | "wooden_spoon";
  userId: string;
  points: number;
};

export function derivePredictionAwardSelections(input: {
  gameweekId: string;
  gameweek: number;
  scores: readonly PredictionAwardScore[];
  eligibleUserIds: ReadonlySet<string>;
}): PredictionAwardSelection[] {
  const eligibleScores = input.scores.filter((score) => input.eligibleUserIds.has(score.userId));
  if (eligibleScores.length === 0) return [];

  const maxPoints = Math.max(...eligibleScores.map((score) => score.points));
  const minPoints = Math.min(...eligibleScores.map((score) => score.points));
  const toSelection = (score: PredictionAwardScore, award: "champion" | "wooden_spoon"): PredictionAwardSelection => ({
    gameweekId: input.gameweekId,
    gameweek: input.gameweek,
    award,
    userId: score.userId,
    points: score.points,
  });

  return [
    ...eligibleScores.filter((score) => score.points === maxPoints).map((score) => toSelection(score, "champion")),
    ...eligibleScores.filter((score) => score.points === minPoints).map((score) => toSelection(score, "wooden_spoon")),
  ];
}

export function mapPredictionAwards(rows: readonly PredictionAwardRow[]): PredictionAwardsData | null {
  const first = rows[0];
  if (!first) return null;
  const mapRecipient = (row: PredictionAwardRow) => ({
    userId: row.userId,
    lineUserId: row.lineUserId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? "",
    points: row.points,
  });
  return {
    gameweek: first.gameweek,
    champions: rows.filter((row) => row.award === "champion").map(mapRecipient),
    woodenSpoons: rows.filter((row) => row.award === "wooden_spoon").map(mapRecipient),
  };
}

export function mapFantasyAwards(rows: readonly FantasyAwardRow[]): FantasyAwardsData | null {
  const first = rows[0];
  if (!first) return null;
  const mapRecipient = (row: FantasyAwardRow): FantasyAwardRecipient => ({
    entryId: row.entryId,
    lineUserId: row.lineUserId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? "",
    teamName: row.teamName,
    managerName: row.managerName,
    points: row.points,
  });
  return {
    leagueFplId: first.leagueFplId,
    leagueName: first.leagueName,
    gameweek: first.gameweek,
    champions: rows.filter((row) => row.award === "champion").map(mapRecipient),
    woodenSpoons: rows.filter((row) => row.award === "wooden_spoon").map(mapRecipient),
  };
}

type StandingsRowInput = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number | null;
};

type TodayFixtureRowInput = {
  id: string;
  kickoffAt: string;
  dayLabel?: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTeam: FlexTeam;
  awayTeam: FlexTeam;
};

type UserPredictionRowInput = {
  externalFixtureId: number;
  kickoffAt: string;
  homeTeam: FlexTeam;
  awayTeam: FlexTeam;
  outcome: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

function datePartsInBangkok(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function getBangkokDayRange(now: Date) {
  const parts = datePartsInBangkok(now);
  const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - BANGKOK_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    dateLabel: new Intl.DateTimeFormat("th-TH", {
      timeZone: BANGKOK_TIME_ZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(now),
  };
}

export function getBangkokTwoDayRange(now: Date) {
  const range = getBangkokDayRange(now);
  return { startIso: range.startIso, endIso: new Date(new Date(range.endIso).getTime() + 24 * 60 * 60 * 1000).toISOString() };
}

const thaiWeekdayShort = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const thaiWeekdayFull = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const thaiMonthShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiMonthFull = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function bangkokWeekday(value: Date) {
  const parts = datePartsInBangkok(value);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function formatBangkokShortDate(value: Date): string {
  const parts = datePartsInBangkok(value);
  return `${thaiWeekdayShort[bangkokWeekday(value)]} ${parts.day} ${thaiMonthShort[parts.month - 1]} ${String(parts.year + 543).slice(-2)}`;
}

export function formatBangkokFullDate(value: Date): string {
  const parts = datePartsInBangkok(value);
  return `วัน${thaiWeekdayFull[bangkokWeekday(value)]}ที่ ${parts.day} ${thaiMonthFull[parts.month - 1]} ${parts.year + 543}`;
}

export function formatBangkokDateRangeLabel(now: Date): string {
  return [formatBangkokShortDate(now), formatBangkokShortDate(new Date(now.getTime() + 24 * 60 * 60 * 1000))].join(" · ");
}

export function getBangkokDayLabel(value: Date, now: Date): string {
  const valueParts = datePartsInBangkok(value);
  const nowParts = datePartsInBangkok(now);
  const valueDay = Date.UTC(valueParts.year, valueParts.month - 1, valueParts.day);
  const nowDay = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  return valueDay === nowDay ? "วันนี้" : "พรุ่งนี้";
}

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function statusLabel(row: TodayFixtureRowInput) {
  const hasScore = typeof row.homeScore === "number" && typeof row.awayScore === "number";
  if (row.status === "live") return "Live";
  if (row.status === "finished") return "จบแล้ว";
  if (row.status === "postponed") return "เลื่อนแข่ง";
  if (hasScore) return "อัปเดตสกอร์";
  return "เริ่มแข่ง";
}

function scoreLabel(row: TodayFixtureRowInput) {
  if (typeof row.homeScore !== "number" || typeof row.awayScore !== "number") return undefined;
  return `${row.homeScore} - ${row.awayScore}`;
}

export function selectCompleteParticipantIds(
  participantIds: string[],
  fixtureIds: string[],
  predictions: Array<{ userId: string; fixtureId: string }>,
): string[] {
  if (fixtureIds.length === 0) return [];
  const required = new Set(fixtureIds);
  const byUser = new Map<string, Set<string>>();
  for (const prediction of predictions) {
    if (!required.has(prediction.fixtureId)) continue;
    const fixtureSet = byUser.get(prediction.userId) ?? new Set<string>();
    fixtureSet.add(prediction.fixtureId);
    byUser.set(prediction.userId, fixtureSet);
  }
  return participantIds.filter((userId) => byUser.get(userId)?.size === required.size);
}

export function mapStandingsRows(gameweek: number, rows: StandingsRowInput[]): StandingsData {
  const sorted = [...rows].sort((left, right) =>
    (right.points ?? 0) - (left.points ?? 0) || left.displayName.localeCompare(right.displayName, "th"));
  return {
    gameweek,
    rows: sorted.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? "",
      points: row.points ?? 0,
    })),
  };
}

export function mapTodayFixtureRows(rows: TodayFixtureRowInput[]): TodayFixturesData["fixtures"] {
  return rows.map((row) => ({
    dayLabel: row.dayLabel ?? "วันนี้",
    kickoffLabel: formatKickoff(row.kickoffAt),
    scoreLabel: scoreLabel(row),
    statusLabel: statusLabel(row),
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
  }));
}

export function mapUserPredictionRows(input: {
  gameweek: number;
  displayName: string;
  avatarUrl: string | null;
  rows: UserPredictionRowInput[];
}): UserPredictionData {
  const sortedRows = sortFixturesForFplOrder(input.rows, (row) => row.kickoffAt, (row) => row.externalFixtureId);
  return {
    gameweek: input.gameweek,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? "",
    fixtures: sortedRows.flatMap((row) => {
      if (row.outcome !== "home" && row.outcome !== "draw" && row.outcome !== "away") return [];
      return [{
        kickoffAt: row.kickoffAt,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        choice: row.outcome,
        status: row.status ?? "scheduled",
        homeScore: row.homeScore ?? null,
        awayScore: row.awayScore ?? null,
      }];
    }),
  };
}
