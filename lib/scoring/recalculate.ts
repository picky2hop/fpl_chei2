import "server-only";

import { canCloseGameweek, type FixtureStatus } from "@/lib/domain/fixtures";
import { calculateGameweekScoring } from "@/lib/domain/scoring";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function recalculateGameweek(gameweekId: string): Promise<{ calculated: boolean; scoreCount: number; awardCount: number }> {
  const admin = getSupabaseAdmin();
  const { data: fixtureIds, error: fixtureIdError } = await admin.from("fixtures").select("id").eq("gameweek_id", gameweekId);
  if (fixtureIdError) throw new Error("Unable to load scoring fixtures");
  const [{ data: fixtures, error: fixtureError }, { data: participants, error: participantError }, { data: predictions, error: predictionError }, { data: gameweek, error: gameweekError }] = await Promise.all([
    admin.from("fixtures").select("id,status,home_score,away_score").eq("gameweek_id", gameweekId),
    admin.from("gameweek_participants").select("user_id,status").eq("gameweek_id", gameweekId),
    fixtureIds.length ? admin.from("predictions").select("user_id,fixture_id,outcome,status").in("fixture_id", fixtureIds.map((fixture) => fixture.id)) : Promise.resolve({ data: [], error: null }),
    admin.from("gameweeks").select("scoring_version,status").eq("id", gameweekId).single(),
  ]);
  if (fixtureError || participantError || predictionError || gameweekError || !gameweek) throw new Error("Unable to load scoring inputs");

  if (!canCloseGameweek(fixtures.map((fixture) => ({ status: fixture.status as FixtureStatus })))) {
    return { calculated: false, scoreCount: 0, awardCount: 0 };
  }

  const result = calculateGameweekScoring({
    fixtures: fixtures.map((fixture) => ({ id: fixture.id, status: fixture.status as FixtureStatus, homeScore: fixture.home_score, awayScore: fixture.away_score })),
    participants: participants.map((participant) => ({ userId: participant.user_id, status: participant.status as "active" | "excluded" })),
    predictions: predictions.map((prediction) => ({ userId: prediction.user_id, fixtureId: prediction.fixture_id, choice: prediction.outcome as "home" | "draw" | "away", status: prediction.status as "active" | "voided" })),
  });
  const scoringVersion = gameweek.scoring_version + 1;
  const { error } = await admin.rpc("replace_gameweek_scoring", {
    p_gameweek_id: gameweekId,
    p_scoring_version: scoringVersion,
    p_scores: result.scores,
    p_awards: result.awards,
  });
  if (error) throw new Error(`Unable to replace scoring: ${error.message}`);

  const { error: statusError } = await admin.from("gameweeks").update({ status: "closed", close_at: new Date().toISOString() }).eq("id", gameweekId);
  if (statusError) throw new Error(`Unable to close gameweek: ${statusError.message}`);
  return { calculated: true, scoreCount: result.scores.length, awardCount: result.awards.length };
}

export async function recalculateGameweeks(gameweekIds: readonly string[]): Promise<number> {
  let calculated = 0;
  for (const gameweekId of new Set(gameweekIds)) {
    if ((await recalculateGameweek(gameweekId)).calculated) calculated += 1;
  }
  return calculated;
}
