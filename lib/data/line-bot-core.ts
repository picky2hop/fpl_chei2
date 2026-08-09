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
    kickoffLabel: string;
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
  }>;
};

export type ActiveGameweek = {
  id: string;
  number: number;
  isCurrent: boolean;
};

export function selectActiveGameweek(gameweeks: ActiveGameweek[]): ActiveGameweek | null {
  return gameweeks.find((gameweek) => gameweek.isCurrent) ?? [...gameweeks].sort((left, right) => left.number - right.number)[0] ?? null;
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
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: FlexTeam;
  awayTeam: FlexTeam;
};

type UserPredictionRowInput = {
  externalFixtureId: number;
  kickoffAt: string;
  homeTeam: FlexTeam;
  awayTeam: FlexTeam;
  outcome: string;
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

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function statusLabel(row: TodayFixtureRowInput) {
  if (row.status === "live") return "LIVE";
  if (row.status === "finished") return `${row.homeScore ?? 0} - ${row.awayScore ?? 0}`;
  if (row.status === "postponed") return "เลื่อนแข่ง";
  return "เริ่มแข่ง";
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
    kickoffLabel: formatKickoff(row.kickoffAt),
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
      return [{ kickoffAt: row.kickoffAt, homeTeam: row.homeTeam, awayTeam: row.awayTeam, choice: row.outcome }];
    }),
  };
}
