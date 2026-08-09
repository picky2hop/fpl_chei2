import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapPredictionBook, type DashboardPredictionBook } from "@/lib/data/dashboard-core";
import { sortFixturesForFplOrder } from "@/lib/data/fixture-order";

export type DashboardData = {
  season: { id: string; name: string };
  gameweeks: Array<{ id: string; number: number; label: string; state: "current" | "past" | "future"; fixtureCount: number }>;
  fixtures: Array<{
    id: string;
    gameweekId: string;
    gameweekNumber: number;
    kickoffAt: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: { id: string; name: string; shortName: string; crest: string };
    awayTeam: { id: string; name: string; shortName: string; crest: string };
    predictionPercentages: { home: number; draw: number; away: number };
  }>;
  predictions: Array<{ fixtureId: string; choice: string; status: string }>;
  predictionBookByGameweek: DashboardPredictionBook;
  leaderboard: Array<{
    id: string;
    displayName: string;
    avatarUrl: string;
    gameweekPoints: number;
    seasonPoints: number;
  }>;
};

function percentages(choices: string[]) {
  const total = choices.length;
  const count = (choice: string) => choices.filter((value) => value === choice).length;
  return {
    home: total ? Math.round((count("home") / total) * 100) : 0,
    draw: total ? Math.round((count("draw") / total) * 100) : 0,
    away: total ? Math.round((count("away") / total) * 100) : 0,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const admin = getSupabaseAdmin();
  const { data: season, error: seasonError } = await admin.from("seasons").select("id,name").eq("status", "active").maybeSingle();
  if (seasonError || !season) throw new Error("Active season is unavailable");

  const [{ data: gameweeks, error: gameweekError }, { data: teams, error: teamError }] = await Promise.all([
    admin.from("gameweeks").select("id,number,name,status,is_current").eq("season_id", season.id).order("number"),
    admin.from("teams").select("id,name,short_name,logo_url"),
  ]);
  if (gameweekError || teamError) throw new Error("Competition data is unavailable");

  const gameweekIds = gameweeks.map((gameweek) => gameweek.id);
  const { data: fixtureRows, error: fixtureError } = await admin
    .from("fixtures")
    .select("id,external_fixture_id,gameweek_id,kickoff_at,status,home_score,away_score,home_team_id,away_team_id")
    .eq("season_id", season.id)
    .order("kickoff_at")
    .order("external_fixture_id");
  if (fixtureError) throw new Error("Fixtures are unavailable");
  const fixtures = sortFixturesForFplOrder(fixtureRows, (fixture) => fixture.kickoff_at, (fixture) => fixture.external_fixture_id);

  const fixtureIds = fixtures.map((fixture) => fixture.id);
  const [{ data: participants, error: participantError }, { data: predictions, error: predictionError }, { data: users, error: userError }, { data: scores, error: scoreError }] = await Promise.all([
    admin.from("gameweek_participants").select("gameweek_id,user_id,status").in("gameweek_id", gameweekIds).eq("status", "active"),
    fixtureIds.length ? admin.from("predictions").select("fixture_id,user_id,outcome,status").in("fixture_id", fixtureIds).eq("status", "active") : Promise.resolve({ data: [], error: null }),
    admin.from("app_users").select("id,display_name,avatar_url,status").eq("status", "active"),
    gameweekIds.length ? admin.from("gameweek_scores").select("gameweek_id,user_id,points").in("gameweek_id", gameweekIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (participantError || predictionError || userError || scoreError) throw new Error("Dashboard data is unavailable");

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const gameweekById = new Map(gameweeks.map((gameweek) => [gameweek.id, gameweek]));
  const activeParticipants = participants.filter((participant) => participant.status === "active");
  const currentGameweek = gameweeks.find((gameweek) => gameweek.is_current)?.number ?? gameweeks[0]?.number ?? 0;
  const usersById = new Map(users.map((user) => [user.id, user]));
  const seasonTotals = new Map<string, number>();
  for (const score of scores) seasonTotals.set(score.user_id, (seasonTotals.get(score.user_id) ?? 0) + score.points);
  const currentGameweekId = gameweeks.find((gameweek) => gameweek.number === currentGameweek)?.id;
  const currentScores = new Map(scores.filter((score) => score.gameweek_id === currentGameweekId).map((score) => [score.user_id, score.points]));
  const leaderboardUserIds = new Set(activeParticipants.map((participant) => participant.user_id));

  return {
    season,
    gameweeks: gameweeks.map((gameweek) => ({
      id: gameweek.id,
      number: gameweek.number,
      label: gameweek.name ?? `GW ${gameweek.number}`,
      state: gameweek.number < currentGameweek ? "past" : gameweek.number === currentGameweek ? "current" : "future",
      fixtureCount: fixtures.filter((fixture) => fixture.gameweek_id === gameweek.id).length,
    })),
    fixtures: fixtures.flatMap((fixture) => {
      const gameweek = fixture.gameweek_id ? gameweekById.get(fixture.gameweek_id) : undefined;
      const home = teamById.get(fixture.home_team_id);
      const away = teamById.get(fixture.away_team_id);
      if (!gameweek || !home || !away) return [];
      const fixtureChoices = predictions.filter((prediction) => prediction.fixture_id === fixture.id).map((prediction) => prediction.outcome);
      return [{
        id: fixture.id,
        gameweekId: gameweek.id,
        gameweekNumber: gameweek.number,
        kickoffAt: fixture.kickoff_at,
        status: fixture.status,
        homeScore: fixture.home_score,
        awayScore: fixture.away_score,
        homeTeam: { id: home.id, name: home.name, shortName: home.short_name ?? home.name.slice(0, 3).toUpperCase(), crest: home.logo_url ?? "" },
        awayTeam: { id: away.id, name: away.name, shortName: away.short_name ?? away.name.slice(0, 3).toUpperCase(), crest: away.logo_url ?? "" },
        predictionPercentages: percentages(fixtureChoices),
      }];
    }),
    predictions: predictions.filter((prediction) => prediction.user_id === userId).map((prediction) => ({ fixtureId: prediction.fixture_id, choice: prediction.outcome, status: prediction.status })),
    predictionBookByGameweek: mapPredictionBook({
      gameweeks: gameweeks.map((gameweek) => ({ id: gameweek.id, number: gameweek.number })),
      fixtures: fixtures.map((fixture) => ({ id: fixture.id, gameweekId: fixture.gameweek_id })),
      predictions: predictions.map((prediction) => ({ userId: prediction.user_id, fixtureId: prediction.fixture_id, outcome: prediction.outcome, status: prediction.status })),
    }),
    leaderboard: [...leaderboardUserIds].flatMap((id) => {
      const user = usersById.get(id);
      if (!user) return [];
      return [{ id, displayName: user.display_name, avatarUrl: user.avatar_url ?? "", gameweekPoints: currentScores.get(id) ?? 0, seasonPoints: seasonTotals.get(id) ?? 0 }];
    }).sort((a, b) => b.seasonPoints - a.seasonPoints || b.gameweekPoints - a.gameweekPoints),
  };
}
