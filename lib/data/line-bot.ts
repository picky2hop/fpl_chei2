import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { PredictionChoice, FlexTeam } from "@/lib/line/flex";
import { formatBangkokDateRangeLabel, formatBangkokFullDate, getBangkokTwoDayRange, mapPredictionAwards, selectActiveGameweek, selectCompleteParticipantIds, selectLatestAwardedGameweek, type PredictionAwardsData } from "./line-bot-core";

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
  return {
    gameweek: input.gameweek,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl ?? "",
    fixtures: input.rows.flatMap((row) => {
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

async function activeSeasonContext() {
  const admin = getSupabaseAdmin();
  const { data: season, error: seasonError } = await admin
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .maybeSingle();
  if (seasonError || !season) throw new Error("Active season is unavailable");

  return { admin, season };
}

async function activeContext() {
  const { admin, season } = await activeSeasonContext();

  const { data: gameweeks, error: gameweekError } = await admin
    .from("gameweeks")
    .select("id,number,is_current")
    .eq("season_id", season.id)
    .order("number");
  if (gameweekError) throw new Error("Gameweeks are unavailable");
  const gameweek = selectActiveGameweek((gameweeks ?? []).map((row) => ({ id: row.id, number: row.number, isCurrent: row.is_current })));
  if (!gameweek) throw new Error("Current gameweek is unavailable");
  return { admin, season, gameweek };
}

function teamById(teams: Array<{ id: string; name: string; logo_url: string | null }>) {
  return new Map(teams.map((team) => [team.id, { name: team.name, logoUrl: team.logo_url ?? "" }]));
}

export type LineBotDataReader = {
  getCurrentStandings(): Promise<StandingsData>;
  getTodayFixtures(now: Date): Promise<TodayFixturesData>;
  getUserPredictions(lineUserId: string): Promise<UserPredictionData | null>;
  getPredictionAwards(): Promise<PredictionAwardsData | null>;
};

export function createLineBotDataReader(): LineBotDataReader {
  return {
    async getCurrentStandings() {
      const { admin, gameweek } = await activeContext();
      const [{ data: participants, error: participantError }, { data: scores, error: scoreError }, { data: users, error: userError }, { data: fixtures, error: fixtureError }] = await Promise.all([
        admin.from("gameweek_participants").select("user_id").eq("gameweek_id", gameweek.id).eq("status", "active"),
        admin.from("gameweek_scores").select("user_id,points").eq("gameweek_id", gameweek.id),
        admin.from("app_users").select("id,display_name,avatar_url,status").eq("status", "active"),
        admin.from("fixtures").select("id").eq("gameweek_id", gameweek.id),
      ]);
      if (participantError || scoreError || userError || fixtureError) throw new Error("Standings are unavailable");

      const fixtureIds = (fixtures ?? []).map((fixture) => fixture.id);
      const { data: predictions, error: predictionError } = fixtureIds.length
        ? await admin.from("predictions").select("user_id,fixture_id").in("fixture_id", fixtureIds).eq("status", "active")
        : { data: [], error: null };
      if (predictionError) throw new Error("Standings are unavailable");

      const participantIds = selectCompleteParticipantIds(
        (participants ?? []).map((row) => row.user_id),
        fixtureIds,
        (predictions ?? []).map((row) => ({ userId: row.user_id, fixtureId: row.fixture_id })),
      );
      const participantIdSet = new Set(participantIds);
      const points = new Map((scores ?? []).map((row) => [row.user_id, row.points]));
      const rows = (users ?? [])
        .filter((user) => participantIdSet.has(user.id))
        .map((user) => ({ userId: user.id, displayName: user.display_name, avatarUrl: user.avatar_url, points: points.get(user.id) ?? 0 }));
      return mapStandingsRows(gameweek.number, rows);
    },

    async getTodayFixtures(now) {
      const { admin, season } = await activeContext();
      const range = getBangkokTwoDayRange(now);
      const [{ data: fixtures, error: fixtureError }, { data: teams, error: teamError }] = await Promise.all([
        admin.from("fixtures").select("id,kickoff_at,status,home_score,away_score,home_team_id,away_team_id").eq("season_id", season.id).gte("kickoff_at", range.startIso).lt("kickoff_at", range.endIso).order("kickoff_at"),
        admin.from("teams").select("id,name,logo_url"),
      ]);
      if (fixtureError || teamError) throw new Error("Today fixtures are unavailable");

      const teamsById = teamById(teams ?? []);
      const rows = (fixtures ?? []).flatMap((fixture) => {
        const homeTeam = teamsById.get(fixture.home_team_id);
        const awayTeam = teamsById.get(fixture.away_team_id);
        if (!homeTeam || !awayTeam) return [];
        return [{ id: fixture.id, kickoffAt: fixture.kickoff_at, dayLabel: formatBangkokFullDate(new Date(fixture.kickoff_at)), status: fixture.status, homeScore: fixture.home_score, awayScore: fixture.away_score, homeTeam, awayTeam }];
      });
      return { dateLabel: formatBangkokDateRangeLabel(now), fixtures: mapTodayFixtureRows(rows) };
    },

    async getUserPredictions(lineUserId) {
      const { admin, season, gameweek } = await activeContext();
      const { data: user, error: userError } = await admin.from("app_users").select("id,display_name,avatar_url,status").eq("line_user_id", lineUserId).eq("status", "active").maybeSingle();
      if (userError) throw new Error("User prediction lookup is unavailable");
      if (!user) return null;

      const [{ data: fixtures, error: fixtureError }, { data: predictions, error: predictionError }, { data: teams, error: teamError }] = await Promise.all([
        admin.from("fixtures").select("id,external_fixture_id,kickoff_at,status,home_score,away_score,home_team_id,away_team_id").eq("season_id", season.id).eq("gameweek_id", gameweek.id).order("kickoff_at").order("external_fixture_id"),
        admin.from("predictions").select("fixture_id,outcome,status").eq("user_id", user.id).eq("status", "active"),
        admin.from("teams").select("id,name,logo_url"),
      ]);
      if (fixtureError || predictionError || teamError) throw new Error("User predictions are unavailable");

      const teamsById = teamById(teams ?? []);
      const predictionsByFixture = new Map((predictions ?? []).map((prediction) => [prediction.fixture_id, prediction.outcome]));
      const rows = (fixtures ?? []).flatMap((fixture) => {
        const homeTeam = teamsById.get(fixture.home_team_id);
        const awayTeam = teamsById.get(fixture.away_team_id);
        const outcome = predictionsByFixture.get(fixture.id);
        if (!homeTeam || !awayTeam || !outcome) return [];
        return [{ externalFixtureId: fixture.external_fixture_id, kickoffAt: fixture.kickoff_at, homeTeam, awayTeam, outcome, status: fixture.status, homeScore: fixture.home_score, awayScore: fixture.away_score }];
      });
      return mapUserPredictionRows({ gameweek: gameweek.number, displayName: user.display_name, avatarUrl: user.avatar_url, rows });
    },

    async getPredictionAwards() {
      const { admin, season } = await activeSeasonContext();
      const { data: gameweeks, error: gameweekError } = await admin
        .from("gameweeks")
        .select("id,number,status")
        .eq("season_id", season.id)
        .eq("status", "closed")
        .order("number", { ascending: false });
      if (gameweekError) throw new Error("Prediction awards are unavailable");

      const closedGameweekIds = (gameweeks ?? []).map((gameweek) => gameweek.id);
      if (closedGameweekIds.length === 0) return null;

      const { data: awards, error: awardError } = await admin
        .from("gameweek_awards")
        .select("gameweek_id,user_id,award,points")
        .in("gameweek_id", closedGameweekIds);
      if (awardError) throw new Error("Prediction awards are unavailable");

      const selectedGameweek = selectLatestAwardedGameweek(
        (gameweeks ?? []).map((gameweek) => ({ id: gameweek.id, number: gameweek.number, status: gameweek.status as "closed" })),
        (awards ?? []).map((award) => ({ gameweekId: award.gameweek_id })),
      );
      if (!selectedGameweek) return null;

      const selectedAwards = (awards ?? []).filter((award) => award.gameweek_id === selectedGameweek.id);
      const userIds = [...new Set(selectedAwards.map((award) => award.user_id))];
      const { data: users, error: userError } = userIds.length
        ? await admin.from("app_users").select("id,line_user_id,display_name,avatar_url").in("id", userIds)
        : { data: [], error: null };
      if (userError) throw new Error("Prediction awards are unavailable");

      const usersById = new Map((users ?? []).map((user) => [user.id, user]));
      return mapPredictionAwards(selectedAwards.flatMap((award) => {
        const user = usersById.get(award.user_id);
        if (!user) return [];
        return [{
          gameweekId: award.gameweek_id,
          gameweek: selectedGameweek.number,
          award: award.award as "champion" | "wooden_spoon",
          userId: user.id,
          lineUserId: user.line_user_id,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          points: award.points,
        }];
      }));
    },
  };
}
