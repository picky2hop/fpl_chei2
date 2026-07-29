import "server-only";

import type { Json } from "@/lib/db/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { recalculateGameweeks } from "@/lib/scoring/recalculate";
import { normalizeFplFixture } from "./fpl-core";
import { fetchFplSnapshot } from "./fpl-client";
import { reconcileFixtureMoves, type FixtureMove } from "./reconcile";

export type SyncMode = "scheduled" | "manual";

export type SyncResult = {
  jobRunId: string;
  teamsUpserted: number;
  gameweeksUpserted: number;
  fixturesUpserted: number;
  movedFixtureIds: string[];
  affectedGameweekIds: string[];
};

function sourcePayload(value: unknown): Json {
  return value as Json;
}

export async function syncFplData(mode: SyncMode): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  const startedAt = new Date().toISOString();
  const idempotencyKey = `fpl:${mode}:${startedAt.slice(0, 16)}`;
  const { data: job, error: jobError } = await admin.from("job_runs").insert({
    idempotency_key: idempotencyKey,
    job_type: "fixture_sync",
    mode,
    scope: "active_season",
    source: "fpl_api",
    source_name: "fpl_api",
    status: "running",
    started_at: startedAt,
  }).select("id").single();
  if (jobError) throw new Error(`Unable to start sync job: ${jobError.message}`);

  try {
    const snapshot = await fetchFplSnapshot();
    const { data: season, error: seasonError } = await admin.from("seasons").select("id").eq("status", "active").maybeSingle();
    if (seasonError || !season) throw new Error("Active season is unavailable");

    const now = new Date().toISOString();
    const { data: teams, error: teamError } = await admin.from("teams").upsert(snapshot.teams.map((team) => ({
      external_team_id: team.id,
      name: team.name,
      short_name: team.short_name,
      code: String(team.code),
    })), { onConflict: "external_team_id" }).select("id,external_team_id");
    if (teamError || !teams) throw new Error(`Unable to sync teams: ${teamError?.message ?? "unknown error"}`);

    const { data: gameweeks, error: gameweekError } = await admin.from("gameweeks").upsert(snapshot.events.map((event) => ({
      season_id: season.id,
      external_gameweek_id: event.id,
      number: event.id,
      name: event.name,
      is_current: event.is_current,
      status: event.is_current ? "open" : "upcoming",
    })), { onConflict: "season_id,external_gameweek_id" }).select("id,external_gameweek_id");
    if (gameweekError || !gameweeks) throw new Error(`Unable to sync gameweeks: ${gameweekError?.message ?? "unknown error"}`);

    const teamIds = new Map(teams.map((team) => [team.external_team_id, team.id]));
    const gameweekIds = new Map(gameweeks.map((gameweek) => [gameweek.external_gameweek_id, gameweek.id]));
    const { data: existingFixtures, error: existingError } = await admin.from("fixtures").select("id,external_fixture_id,gameweek_id,status,home_score,away_score").eq("season_id", season.id);
    if (existingError || !existingFixtures) throw new Error(`Unable to load existing fixtures: ${existingError?.message ?? "unknown error"}`);
    const existingByExternalId = new Map(existingFixtures.map((fixture) => [fixture.external_fixture_id, fixture]));
    const affectedGameweekIds = new Set<string>();
    const movedFixtureIds: string[] = [];
    const moves: FixtureMove[] = [];
    const fixtureRows = snapshot.fixtures.map((rawFixture) => {
      const fixture = normalizeFplFixture(rawFixture);
      const homeTeamId = teamIds.get(fixture.homeExternalTeamId);
      const awayTeamId = teamIds.get(fixture.awayExternalTeamId);
      const gameweekId = gameweekIds.get(fixture.externalGameweekId);
      if (!homeTeamId || !awayTeamId || !gameweekId) throw new Error(`FPL fixture ${fixture.externalFixtureId} references unknown data`);
      const previous = existingByExternalId.get(fixture.externalFixtureId);
      if (previous?.gameweek_id && previous.gameweek_id !== gameweekId) {
        movedFixtureIds.push(previous.id);
        moves.push({ fixtureId: previous.id, oldGameweekId: previous.gameweek_id, newGameweekId: gameweekId });
        affectedGameweekIds.add(previous.gameweek_id);
        affectedGameweekIds.add(gameweekId);
      }
      if (fixture.status === "finished" && (previous?.status !== "finished" || previous.home_score !== fixture.homeScore || previous.away_score !== fixture.awayScore)) {
        affectedGameweekIds.add(gameweekId);
      }
      return {
        id: previous?.id,
        external_fixture_id: fixture.externalFixtureId,
        season_id: season.id,
        gameweek_id: gameweekId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: fixture.kickoffAt,
        status: fixture.status,
        home_score: fixture.homeScore,
        away_score: fixture.awayScore,
        last_synced_at: now,
      };
    });
    const { data: syncedFixtures, error: fixtureError } = await admin.from("fixtures").upsert(fixtureRows, { onConflict: "external_fixture_id" }).select("id,external_fixture_id");
    if (fixtureError || !syncedFixtures) throw new Error(`Unable to sync fixtures: ${fixtureError?.message ?? "unknown error"}`);

    const sourceRows = snapshot.fixtures.map((fixture) => ({
      fixture_id: syncedFixtures.find((row) => row.external_fixture_id === fixture.id)?.id ?? "",
      source_name: "fpl_api",
      status: fixture.postponed ? "postponed" : fixture.finished ? "finished" : fixture.started ? "live" : "scheduled",
      kickoff_at: fixture.kickoff_time,
      home_score: fixture.team_h_score,
      away_score: fixture.team_a_score,
      raw_payload: sourcePayload(fixture),
      fetched_at: now,
      source_updated_at: now,
    })).filter((row) => row.fixture_id);
    const { error: sourceError } = await admin.from("fixture_source_records").upsert(sourceRows, { onConflict: "fixture_id" });
    if (sourceError) throw new Error(`Unable to store source records: ${sourceError.message}`);

    await reconcileFixtureMoves(moves);
    await recalculateGameweeks([...affectedGameweekIds]);

    const { error: finishError } = await admin.from("job_runs").update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      records_upserted: syncedFixtures.length + teams.length + gameweeks.length,
      affected_gameweek_ids: [...affectedGameweekIds],
    }).eq("id", job.id);
    if (finishError) throw new Error(`Unable to finish sync job: ${finishError.message}`);

    return { jobRunId: job.id, teamsUpserted: teams.length, gameweeksUpserted: gameweeks.length, fixturesUpserted: syncedFixtures.length, movedFixtureIds, affectedGameweekIds: [...affectedGameweekIds] };
  } catch (error) {
    await admin.from("job_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: error instanceof Error ? error.message : "Unknown sync error" }).eq("id", job.id);
    throw error;
  }
}
