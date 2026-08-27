import type { DashboardPredictionBook } from "./dashboard-core";
import type { PredictionMap } from "../predictions";
import type { Fixture, Gameweek, LeaderboardEntry, Team, UserProfile } from "../mock-data";

export type DashboardLeaderboardRow = {
  id: string;
  displayName: string;
  avatarUrl: string;
  gameweekPoints: number;
  seasonPoints: number;
};

export type DashboardPayload = {
  gameweeks: Array<{ id: string; number: number; label: string; state: "current" | "past" | "future"; fixtureCount: number }>;
  fixtures: Array<{
    id: string; gameweekId: string; gameweekNumber: number; kickoffAt: string; status: string; homeScore: number | null; awayScore: number | null;
    homeTeam: { id: string; name: string; shortName: string; crest: string };
    awayTeam: { id: string; name: string; shortName: string; crest: string };
    predictionPercentages: { home: number; draw: number; away: number };
  }>;
  predictions: Array<{ fixtureId: string; choice: string; status: string }>;
  predictionBookByGameweek: DashboardPredictionBook;
  leaderboardByGameweek: Record<number, DashboardLeaderboardRow[]>;
  predictionDefaultGameweek?: number;
};

export function selectPredictionDefaultGameweek(
  currentGameweek: number,
  gameweeks: Array<{ number: number; status: string }>,
  fixtures: Array<{ gameweekNumber: number; status: string }>,
): number {
  const current = gameweeks.find((gameweek) => gameweek.number === currentGameweek);
  if (!current || current.status !== "closed") return currentGameweek;

  const hasOpenFixture = fixtures.some((fixture) => fixture.gameweekNumber === currentGameweek && (fixture.status === "scheduled" || fixture.status === "live"));
  if (hasOpenFixture) return currentGameweek;

  return [...gameweeks]
    .filter((gameweek) => gameweek.number > currentGameweek)
    .sort((a, b) => a.number - b.number)[0]?.number ?? currentGameweek;
}

export function buildDashboardLeaderboardRows(
  gameweeks: Array<{ id: string; number: number }>,
  participants: Array<{ gameweek_id: string; user_id: string; status: string }>,
  scores: Array<{ gameweek_id: string; user_id: string; points: number }>,
  users: Array<{ id: string; display_name: string; avatar_url: string | null }>,
): Record<number, DashboardLeaderboardRow[]> {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const participantsByGameweek = new Map<string, Set<string>>();
  for (const participant of participants) {
    if (participant.status !== "active") continue;
    const userIds = participantsByGameweek.get(participant.gameweek_id) ?? new Set<string>();
    userIds.add(participant.user_id);
    participantsByGameweek.set(participant.gameweek_id, userIds);
  }
  const scoresByGameweek = new Map<string, Map<string, number>>();
  for (const score of scores) {
    const userScores = scoresByGameweek.get(score.gameweek_id) ?? new Map<string, number>();
    userScores.set(score.user_id, score.points);
    scoresByGameweek.set(score.gameweek_id, userScores);
  }
  const seasonTotalsThroughGameweek = new Map<string, number>();
  return Object.fromEntries([...gameweeks].sort((a, b) => a.number - b.number).map((gameweek) => {
    for (const score of scores.filter((item) => item.gameweek_id === gameweek.id)) {
      seasonTotalsThroughGameweek.set(score.user_id, (seasonTotalsThroughGameweek.get(score.user_id) ?? 0) + score.points);
    }
    const userScores = scoresByGameweek.get(gameweek.id) ?? new Map<string, number>();
    const userIds = participantsByGameweek.get(gameweek.id) ?? new Set<string>();
    const rows = [...userIds].flatMap((id) => {
      const user = usersById.get(id);
      if (!user) return [];
      return [{ id, displayName: user.display_name, avatarUrl: user.avatar_url ?? "", gameweekPoints: userScores.get(id) ?? 0, seasonPoints: seasonTotalsThroughGameweek.get(id) ?? 0 }];
    }).sort((a, b) => b.seasonPoints - a.seasonPoints || b.gameweekPoints - a.gameweekPoints || a.displayName.localeCompare(b.displayName));
    return [gameweek.number, rows];
  }));
}

export function buildLeaderboardByGameweek(
  gameweeks: Array<{ id: string; number: number }>,
  rowsByGameweek: Record<number, DashboardLeaderboardRow[]>,
): Record<number, LeaderboardEntry[]> {
  return Object.fromEntries(gameweeks.map((gameweek) => {
    const entries = [...(rowsByGameweek[gameweek.number] ?? [])]
      .sort((a, b) => b.seasonPoints - a.seasonPoints || b.gameweekPoints - a.gameweekPoints || a.displayName.localeCompare(b.displayName));
    return [gameweek.number, entries.map((entry, index) => ({
      ...entry,
      shortName: entry.displayName.slice(0, 2),
      rank: index + 1,
      trend: "same" as const,
      form: [],
    }))];
  }));
}

function team(value: DashboardPayload["fixtures"][number]["homeTeam"]): Team {
  return { id: value.id, name: value.name, shortName: value.shortName, accent: "#38bdf8", crest: value.crest || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='16' fill='%2310253a'/%3E%3C/svg%3E" };
}

function toFixture(value: DashboardPayload["fixtures"][number]): Fixture {
  const dateLabel = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value.kickoffAt));
  return { id: value.id, gameweek: value.gameweekNumber, kickoff: value.kickoffAt, dateLabel, status: value.status as Fixture["status"], homeTeam: team(value.homeTeam), awayTeam: team(value.awayTeam), homeScore: value.homeScore ?? undefined, awayScore: value.awayScore ?? undefined, predictionPercentages: value.predictionPercentages, predictors: { home: [], draw: [], away: [] } };
}

export function buildLiveProps(payload: DashboardPayload, profile: UserProfile) {
  const fixtures = payload.fixtures.map(toFixture);
  const fixturesByGameweek = Object.fromEntries(payload.gameweeks.map((gameweek) => [gameweek.number, fixtures.filter((fixture) => fixture.gameweek === gameweek.number)]));
  const gameweeks: Gameweek[] = payload.gameweeks.map((gameweek) => ({ id: gameweek.number, label: gameweek.label, state: gameweek.state, fixtureCount: gameweek.fixtureCount }));
  const leaderboardByGameweek = buildLeaderboardByGameweek(payload.gameweeks, payload.leaderboardByGameweek);
  const gameweekNumberById = new Map(payload.gameweeks.map((gameweek) => [gameweek.id, gameweek.number]));
  const fixtureGameweek = new Map(fixtures.map((fixture) => [fixture.id, fixture.gameweek]));
  const initialPredictionsByGameweek: Record<number, PredictionMap> = {};
  for (const prediction of payload.predictions) {
    const gameweek = fixtureGameweek.get(prediction.fixtureId);
    if (gameweek && (prediction.choice === "home" || prediction.choice === "draw" || prediction.choice === "away")) {
      initialPredictionsByGameweek[gameweek] ??= {};
      initialPredictionsByGameweek[gameweek][prediction.fixtureId] = prediction.choice;
    }
  }
  const current = payload.gameweeks.find((gameweek) => gameweek.state === "current")?.number ?? gameweeks[0]?.id ?? 0;
  return {
    current,
    predictionDefaultGameweek: payload.predictionDefaultGameweek ?? current,
    gameweeks,
    fixturesByGameweek,
    leaderboardByGameweek,
    initialPredictionsByGameweek,
    profile,
    gameweekNumberById,
  };
}
