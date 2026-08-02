import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../lib/db/types.ts";
import type { FplSnapshot } from "../../../lib/sync/fpl-core.ts";
import { createSupabaseSyncRepository } from "../../../lib/sync/supabase-sync-repository.ts";
import { runFplSync, type SyncResult } from "../../../lib/sync/sync-runner.ts";

type TestClient = SupabaseClient<Database>;

export type SyntheticScenario = {
  prefix: string;
  seasonId: string;
  gameweekId: string;
  userId: string;
  teamExternalIds: [number, number];
  gameweekExternalId: number;
  secondGameweekId: string;
  secondGameweekExternalId: number;
  fixtureExternalId: number;
  kickoffAt: string;
};

export type ScenarioState = {
  fixture: {
    id: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
  };
  scores: Array<{ user_id: string; points: number }>;
  awards: Array<{ user_id: string; award: string; points: number }>;
  predictions: Array<{ id: string; outcome: string; status: string }>;
  predictionEvents: Array<{ event_type: string; choice: string | null; previous_choice: string | null }>;
};

function assertDatabaseResult<T>(
  result: { data: T | null; error: { message: string } | null },
  operation: string,
): NonNullable<T> {
  if (result.error || result.data === null) throw new Error(`${operation}: ${result.error?.message ?? "empty result"}`);
  return result.data as NonNullable<T>;
}

function assertDatabaseSuccess(
  result: { error: { message: string } | null },
  operation: string,
): void {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
}

function syntheticExternalId(): number {
  return 100_000_000 + Math.floor(Math.random() * 800_000_000);
}

export async function createScenario(client: TestClient, name: string): Promise<SyntheticScenario> {
  const token = randomUUID().replaceAll("-", "");
  const prefix = `phase3a-${name}-${token}`;
  const seasonExternalId = syntheticExternalId();
  const teamExternalIds: [number, number] = [syntheticExternalId(), syntheticExternalId()];
  const gameweekExternalId = 1_000 + Math.floor(Math.random() * 30_000);
  const secondGameweekExternalId = gameweekExternalId + 1;
  const fixtureExternalId = syntheticExternalId();
  const kickoffAt = "2026-08-15T12:00:00.000Z";

  const season = assertDatabaseResult<{ id: string }>(
    await client.from("seasons").insert({
      external_season_id: seasonExternalId,
      name: `Test ${prefix}`,
      starts_on: "2026-08-01",
      ends_on: "2027-06-01",
      is_current: false,
      status: "active",
    }).select("id").single(),
    "create season",
  );

  const teams = assertDatabaseResult<Array<{ id: string; external_team_id: number }>>(
    await client.from("teams").insert([
      { external_team_id: teamExternalIds[0], name: `${prefix} Home`, short_name: "THM", code: "901" },
      { external_team_id: teamExternalIds[1], name: `${prefix} Away`, short_name: "TAW", code: "902" },
    ]).select("id,external_team_id"),
    "create teams",
  );

  const gameweek = assertDatabaseResult<{ id: string }>(
    await client.from("gameweeks").insert({
      season_id: season.id,
      external_gameweek_id: gameweekExternalId,
      number: 1,
      name: `Test GW ${prefix}`,
      is_current: false,
      status: "open",
    }).select("id").single(),
    "create gameweek",
  );

  const secondGameweek = assertDatabaseResult<{ id: string }>(
    await client.from("gameweeks").insert({
      season_id: season.id,
      external_gameweek_id: secondGameweekExternalId,
      number: 2,
      name: `Test GW 2 ${prefix}`,
      is_current: false,
      status: "closed",
      close_at: kickoffAt,
    }).select("id").single(),
    "create second gameweek",
  );

  const user = assertDatabaseResult<{ id: string }>(
    await client.from("app_users").insert({
      line_user_id: `${prefix}-user`,
      display_name: `Test ${prefix}`,
      status: "active",
      role: "player",
    }).select("id").single(),
    "create user",
  );

  assertDatabaseSuccess(
    await client.from("gameweek_participants").insert({
      gameweek_id: gameweek.id,
      user_id: user.id,
      status: "active",
    }),
    "create participant",
  );

  if (!teams.some((team) => team.external_team_id === teamExternalIds[0])
    || !teams.some((team) => team.external_team_id === teamExternalIds[1])) {
    throw new Error("create teams: synthetic team identity mismatch");
  }

  return {
    prefix,
    seasonId: season.id,
    gameweekId: gameweek.id,
    userId: user.id,
    teamExternalIds,
    gameweekExternalId,
    secondGameweekId: secondGameweek.id,
    secondGameweekExternalId,
    fixtureExternalId,
    kickoffAt,
  };
}

export function createStateSnapshot(
  scenario: SyntheticScenario,
  status: "scheduled" | "live" | "finished" | "postponed",
  options: { gameweekExternalId?: number; kickoffAt?: string; homeScore?: number | null; awayScore?: number | null } = {},
): FplSnapshot {
  const finished = status === "finished";
  const live = status === "live";
  const postponed = status === "postponed";
  const gameweekExternalId = options.gameweekExternalId ?? scenario.gameweekExternalId;
  const kickoffAt = options.kickoffAt ?? scenario.kickoffAt;
  const homeScore = options.homeScore === undefined ? (finished ? 2 : null) : options.homeScore;
  const awayScore = options.awayScore === undefined ? (finished ? 1 : null) : options.awayScore;
  return {
    teams: [
      { id: scenario.teamExternalIds[0], name: `${scenario.prefix} Home`, short_name: "THM", code: 901 },
      { id: scenario.teamExternalIds[1], name: `${scenario.prefix} Away`, short_name: "TAW", code: 902 },
    ],
    events: [{ id: gameweekExternalId, name: `Test GW ${scenario.prefix}`, is_current: true }],
    fixtures: [{
      id: scenario.fixtureExternalId,
      event: gameweekExternalId,
      kickoff_time: kickoffAt,
      team_h: scenario.teamExternalIds[0],
      team_a: scenario.teamExternalIds[1],
      team_h_score: homeScore,
      team_a_score: awayScore,
      started: live || finished,
      finished,
      finished_provisional: false,
      postponed,
    }],
  };
}

export async function applySnapshot(
  client: TestClient,
  scenario: SyntheticScenario,
  snapshot: FplSnapshot,
): Promise<SyncResult> {
  const repository = createSupabaseSyncRepository({
    rpc: (name, params) => client.rpc(
      name as "apply_fpl_sync",
      params as Database["public"]["Functions"]["apply_fpl_sync"]["Args"],
    ),
  });
  const syncedAt = new Date(snapshot.fixtures[0]?.kickoff_time ?? scenario.kickoffAt).toISOString();
  const jobId = randomUUID();

  return runFplSync("manual", {
    now: () => new Date(syncedAt),
    createRunId: () => randomUUID(),
    createJob: async ({ idempotencyKey, mode, startedAt }) => {
      const row = assertDatabaseResult<{ id: string }>(
        await client.from("job_runs").insert({
          id: jobId,
          idempotency_key: `${scenario.prefix}:${idempotencyKey}`,
          job_type: "fixture_sync",
          mode,
          scope: "active_season",
          source: "fpl_api",
          source_name: "fpl_api",
          status: "running",
          started_at: startedAt,
          details: { phase: "started", test: scenario.prefix },
        }).select("id").single(),
        "create job",
      );
      return row;
    },
    fetchSnapshot: async () => snapshot,
    applySnapshot: (input) => repository.applySnapshot(input),
    failJob: async ({ jobRunId, finishedAt, code, message, details }) => {
      assertDatabaseResult<{ id: string }>(
        await client.from("job_runs").update({
          status: "failed",
          finished_at: finishedAt,
          error_code: code,
          error_message: message,
          details,
        }).eq("id", jobRunId).eq("status", "running").select("id").single(),
        "fail job",
      );
    },
  });
}

export async function saveScenarioPrediction(
  client: TestClient,
  scenario: SyntheticScenario,
  choice: "home" | "draw" | "away",
): Promise<void> {
  return saveUserPrediction(client, scenario, scenario.userId, choice);
}

export async function saveUserPrediction(
  client: TestClient,
  scenario: SyntheticScenario,
  userId: string,
  choice: "home" | "draw" | "away",
): Promise<void> {
  const fixture = assertDatabaseResult<{ id: string }>(
    await client.from("fixtures").select("id").eq("external_fixture_id", scenario.fixtureExternalId).single(),
    "find fixture for prediction",
  );
  const { error } = await client.rpc("save_prediction", {
    p_user_id: userId,
    p_fixture_id: fixture.id,
    p_choice: choice,
  });
  if (error) throw new Error(`save prediction: ${error.message}`);
}

export async function createAdditionalParticipant(client: TestClient, scenario: SyntheticScenario): Promise<string> {
  const user = assertDatabaseResult<{ id: string }>(
    await client.from("app_users").insert({
      line_user_id: `${scenario.prefix}-second-user`,
      display_name: `Second ${scenario.prefix}`,
      status: "active",
      role: "player",
    }).select("id").single(),
    "create second user",
  );
  assertDatabaseSuccess(
    await client.from("gameweek_participants").insert({ gameweek_id: scenario.gameweekId, user_id: user.id, status: "active" }),
    "create second participant",
  );
  return user.id;
}

export async function setParticipantStatus(client: TestClient, scenario: SyntheticScenario, userId: string, status: "active" | "excluded"): Promise<void> {
  assertDatabaseSuccess(
    await client.from("gameweek_participants").update({ status }).eq("gameweek_id", scenario.gameweekId).eq("user_id", userId),
    "update participant status",
  );
}

export async function readScenarioState(client: TestClient, scenario: SyntheticScenario): Promise<ScenarioState> {
  const fixture = assertDatabaseResult<{
    id: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
  }>(
    await client.from("fixtures").select("id,status,home_score,away_score").eq("external_fixture_id", scenario.fixtureExternalId).single(),
    "read fixture",
  );
  const [scores, awards, predictions, predictionEvents] = await Promise.all([
    client.from("gameweek_scores").select("user_id,points").eq("gameweek_id", scenario.gameweekId).order("user_id"),
    client.from("gameweek_awards").select("user_id,award,points").eq("gameweek_id", scenario.gameweekId).order("award").order("user_id"),
    client.from("predictions").select("id,outcome,status").eq("fixture_id", fixture.id).order("created_at"),
    client.from("prediction_events").select("event_type,choice,previous_choice").eq("fixture_id", fixture.id).order("created_at"),
  ]);
  const scoreRows = assertDatabaseResult(scores, "read scores");
  const awardRows = assertDatabaseResult(awards, "read awards");
  const predictionRows = assertDatabaseResult(predictions, "read predictions");
  const eventRows = assertDatabaseResult(predictionEvents, "read prediction events");
  return {
    fixture,
    scores: scoreRows,
    awards: awardRows,
    predictions: predictionRows,
    predictionEvents: eventRows,
  };
}

export async function cleanupScenario(client: TestClient, scenario: SyntheticScenario): Promise<void> {
  const fixtureResult = await client.from("fixtures").select("id").eq("external_fixture_id", scenario.fixtureExternalId).maybeSingle();
  const fixtureId = fixtureResult.data?.id;
  if (fixtureId) {
    await client.from("gameweek_scores").delete().eq("gameweek_id", scenario.gameweekId);
    await client.from("gameweek_awards").delete().eq("gameweek_id", scenario.gameweekId);
    await client.from("gameweek_scores").delete().eq("gameweek_id", scenario.secondGameweekId);
    await client.from("gameweek_awards").delete().eq("gameweek_id", scenario.secondGameweekId);
    await client.from("prediction_events").delete().eq("fixture_id", fixtureId);
    await client.from("predictions").delete().eq("fixture_id", fixtureId);
    await client.from("fixture_source_records").delete().eq("fixture_id", fixtureId);
    await client.from("fixture_gameweek_history").delete().eq("fixture_id", fixtureId);
    await client.from("fixtures").delete().eq("id", fixtureId);
  }
  await client.from("gameweek_participants").delete().eq("gameweek_id", scenario.gameweekId);
  await client.from("gameweek_participants").delete().eq("gameweek_id", scenario.secondGameweekId);
  await client.from("gameweeks").delete().eq("id", scenario.gameweekId);
  await client.from("gameweeks").delete().eq("id", scenario.secondGameweekId);
  await client.from("app_users").delete().eq("id", scenario.userId);
  await client.from("app_users").delete().like("line_user_id", `${scenario.prefix}-%`);
  await client.from("teams").delete().in("external_team_id", scenario.teamExternalIds);
  await client.from("seasons").delete().eq("id", scenario.seasonId);
  await client.from("job_runs").delete().like("idempotency_key", `${scenario.prefix}:%`);
}
