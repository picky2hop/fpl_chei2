import assert from "node:assert/strict";
import test from "node:test";
import { createPredictionsHandler } from "../../lib/api/predictions-handler.ts";
import { createPredictionService } from "../../lib/data/prediction-service.ts";
import { createTestSupabaseClient } from "./support/supabase-test-client.ts";
import {
  applySnapshot,
  cleanupScenario,
  createScenario,
  createStateSnapshot,
  createAdditionalParticipant,
  readScenarioState,
  saveScenarioPrediction,
  saveUserPrediction,
  setParticipantStatus,
} from "./support/phase-3a-fixtures.ts";

const integrationEnabled = Boolean(
  process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
);

test("scheduled → live → finished updates the test database and scoring outputs", async (t) => {
  if (!integrationEnabled) {
    t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required");
    return;
  }

  const client = createTestSupabaseClient();
  const scenario = await createScenario(client, "scheduled-live-finished");

  try {
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));
    await saveScenarioPrediction(client, scenario, "home");
    const scheduled = await readScenarioState(client, scenario);
    assert.equal(scheduled.fixture.status, "scheduled");
    assert.equal(scheduled.scores.length, 0);
    assert.equal(scheduled.awards.length, 0);

    await applySnapshot(client, scenario, createStateSnapshot(scenario, "live"));
    const live = await readScenarioState(client, scenario);
    assert.equal(live.fixture.status, "live");
    assert.equal(live.scores.length, 0);
    assert.equal(live.awards.length, 0);

    await applySnapshot(client, scenario, createStateSnapshot(scenario, "finished"));
    const finished = await readScenarioState(client, scenario);
    assert.equal(finished.fixture.status, "finished");
    assert.deepEqual(
      finished.scores.map(({ user_id, points }) => ({ user_id, points })),
      [{ user_id: scenario.userId, points: 3 }],
    );
    assert.deepEqual(
      finished.awards.map(({ user_id, award, points }) => ({ user_id, award, points })),
      [
        { user_id: scenario.userId, award: "champion", points: 3 },
        { user_id: scenario.userId, award: "wooden_spoon", points: 3 },
      ],
    );
  } finally {
    await cleanupScenario(client, scenario);
  }
});

test("prediction API updates before kickoff and database locks at kickoff", async (t) => {
  if (!integrationEnabled) {
    t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required");
    return;
  }

  const client = createTestSupabaseClient();
  const predictionService = createPredictionService(client);
  const scenario = await createScenario(client, "prediction-lock");
  const handler = createPredictionsHandler({
    requireUser: async () => ({ id: scenario.userId }),
    savePrediction: predictionService.savePrediction,
    listPredictions: async () => [],
  });

  try {
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));

    const firstResponse = await handler(new Request("https://test.local/api/predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fixtureId: (await readScenarioState(client, scenario)).fixture.id, choice: "home" }),
    }));
    assert.equal(firstResponse.status, 200);

    const updateResponse = await handler(new Request("https://test.local/api/predictions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fixtureId: (await readScenarioState(client, scenario)).fixture.id, choice: "draw" }),
    }));
    assert.equal(updateResponse.status, 200);

    const updated = await readScenarioState(client, scenario);
    assert.deepEqual(updated.predictions.map(({ outcome, status }) => ({ outcome, status })), [
      { outcome: "draw", status: "active" },
    ]);
    assert.deepEqual(updated.predictionEvents.map(({ event_type }) => event_type), ["created", "updated"]);

    const lockSnapshot = createStateSnapshot(scenario, "scheduled");
    lockSnapshot.fixtures[0].kickoff_time = new Date(Date.now() - 1_000).toISOString();
    await applySnapshot(client, scenario, lockSnapshot);

    const lockedApiResponse = await handler(new Request("https://test.local/api/predictions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fixtureId: updated.fixture.id, choice: "away" }),
    }));
    assert.equal(lockedApiResponse.status, 409);

    const { error: lockedDatabaseError } = await client.rpc("save_prediction", {
      p_user_id: scenario.userId,
      p_fixture_id: updated.fixture.id,
      p_choice: "away",
    });
    assert.equal(lockedDatabaseError?.code, "55P03");

    const afterLock = await readScenarioState(client, scenario);
    assert.deepEqual(afterLock.predictions.map(({ outcome, status }) => ({ outcome, status })), [
      { outcome: "draw", status: "active" },
    ]);
    assert.equal(afterLock.predictionEvents.length, 2);
  } finally {
    await cleanupScenario(client, scenario);
  }
});

test("postponed fixtures do not score and can accept a rescheduled prediction", async (t) => {
  if (!integrationEnabled) { t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required"); return; }
  const client = createTestSupabaseClient();
  const scenario = await createScenario(client, "postponed-rescheduled");
  try {
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));
    await saveScenarioPrediction(client, scenario, "home");
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "postponed"));
    const postponed = await readScenarioState(client, scenario);
    assert.equal(postponed.fixture.status, "postponed");
    assert.equal(postponed.scores.length, 0);
    assert.equal(postponed.awards.length, 0);
    assert.equal(postponed.predictions[0]?.status, "active");

    const rescheduled = createStateSnapshot(scenario, "scheduled", {
      kickoffAt: "2026-08-22T12:00:00.000Z",
    });
    await applySnapshot(client, scenario, rescheduled);
    await saveScenarioPrediction(client, scenario, "draw");
    const reopened = await readScenarioState(client, scenario);
    assert.equal(reopened.fixture.status, "scheduled");
    assert.equal(reopened.predictions[0]?.outcome, "draw");
  } finally { await cleanupScenario(client, scenario); }
});

test("moving a fixture across gameweeks voids predictions and reopens the target gameweek", async (t) => {
  if (!integrationEnabled) { t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required"); return; }
  const client = createTestSupabaseClient();
  const scenario = await createScenario(client, "fixture-move");
  try {
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));
    await saveScenarioPrediction(client, scenario, "home");
    const movedSnapshot = createStateSnapshot(scenario, "scheduled", {
      gameweekExternalId: scenario.secondGameweekExternalId,
      kickoffAt: "2026-08-29T12:00:00.000Z",
    });
    movedSnapshot.events.unshift({
      id: scenario.gameweekExternalId,
      name: `Test GW ${scenario.prefix}`,
      is_current: false,
    });
    await applySnapshot(client, scenario, movedSnapshot);
    const [fixtureResult, predictionResult, eventResult, historyResult, targetGameweekResult] = await Promise.all([
      client.from("fixtures").select("gameweek_id,status").eq("external_fixture_id", scenario.fixtureExternalId).single(),
      client.from("predictions").select("status").eq("user_id", scenario.userId).single(),
      client.from("prediction_events").select("event_type,previous_choice,reason").eq("user_id", scenario.userId).order("created_at", { ascending: false }).limit(1).single(),
      client.from("fixture_gameweek_history").select("old_gameweek_id,new_gameweek_id").eq("fixture_id", (await client.from("fixtures").select("id").eq("external_fixture_id", scenario.fixtureExternalId).single()).data?.id ?? "").single(),
      client.from("gameweeks").select("status").eq("id", scenario.secondGameweekId).single(),
    ]);
    assert.equal(fixtureResult.error, null);
    assert.equal(predictionResult.error, null);
    assert.equal(eventResult.error, null);
    assert.equal(historyResult.error, null);
    assert.equal(targetGameweekResult.error, null);
    assert.equal(fixtureResult.data?.gameweek_id, scenario.secondGameweekId);
    assert.equal(predictionResult.data?.status, "voided");
    assert.deepEqual(eventResult.data, { event_type: "voided", previous_choice: "home", reason: "fixture_moved" });
    assert.deepEqual(historyResult.data, { old_gameweek_id: scenario.gameweekId, new_gameweek_id: scenario.secondGameweekId });
    assert.equal(targetGameweekResult.data?.status, "reopened");
  } finally { await cleanupScenario(client, scenario); }
});

test("excluded participants are omitted from scoring and awards", async (t) => {
  if (!integrationEnabled) { t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required"); return; }
  const client = createTestSupabaseClient();
  const scenario = await createScenario(client, "excluded-participant");
  try {
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));
    await saveScenarioPrediction(client, scenario, "home");
    await setParticipantStatus(client, scenario, scenario.userId, "excluded");
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "finished"));
    const state = await readScenarioState(client, scenario);
    assert.equal(state.scores.length, 0);
    assert.equal(state.awards.length, 0);
  } finally { await cleanupScenario(client, scenario); }
});

test("tied scores produce joint champion and wooden-spoon awards", async (t) => {
  if (!integrationEnabled) { t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required"); return; }
  const client = createTestSupabaseClient();
  const scenario = await createScenario(client, "tie-awards");
  try {
    const secondUserId = await createAdditionalParticipant(client, scenario);
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));
    await saveScenarioPrediction(client, scenario, "home");
    await saveUserPrediction(client, scenario, secondUserId, "home");
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "finished"));
    const state = await readScenarioState(client, scenario);
    assert.deepEqual(state.scores.map(({ user_id, points }) => ({ user_id, points })), [
      { user_id: scenario.userId, points: 3 },
      { user_id: secondUserId, points: 3 },
    ].sort((a, b) => a.user_id.localeCompare(b.user_id)));
    assert.equal(state.awards.length, 4);
    assert.equal(state.awards.filter((award) => award.award === "champion").length, 2);
    assert.equal(state.awards.filter((award) => award.award === "wooden_spoon").length, 2);
  } finally { await cleanupScenario(client, scenario); }
});

test("retrospective score corrections recalculate scores and scoring version", async (t) => {
  if (!integrationEnabled) { t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required"); return; }
  const client = createTestSupabaseClient();
  const scenario = await createScenario(client, "retrospective-correction");
  try {
    const secondUserId = await createAdditionalParticipant(client, scenario);
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));
    await saveScenarioPrediction(client, scenario, "home");
    await saveUserPrediction(client, scenario, secondUserId, "draw");
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "finished"));
    const first = await readScenarioState(client, scenario);
    const firstGameweek = await client.from("gameweeks").select("scoring_version,status").eq("id", scenario.gameweekId).single();
    assert.equal(firstGameweek.error, null);
    assert.deepEqual(first.scores.map(({ user_id, points }) => ({ user_id, points })), [
      { user_id: scenario.userId, points: 3 },
      { user_id: secondUserId, points: 0 },
    ].sort((a, b) => a.user_id.localeCompare(b.user_id)));

    await applySnapshot(client, scenario, createStateSnapshot(scenario, "finished", { homeScore: 0, awayScore: 0 }));
    const corrected = await readScenarioState(client, scenario);
    const correctedGameweek = await client.from("gameweeks").select("scoring_version,status").eq("id", scenario.gameweekId).single();
    assert.equal(correctedGameweek.error, null);
    assert.deepEqual(corrected.scores.map(({ user_id, points }) => ({ user_id, points })), [
      { user_id: scenario.userId, points: 0 },
      { user_id: secondUserId, points: 3 },
    ].sort((a, b) => a.user_id.localeCompare(b.user_id)));
    assert.equal(correctedGameweek.data?.status, "closed");
    assert.equal(correctedGameweek.data?.scoring_version, (firstGameweek.data?.scoring_version ?? 0) + 1);
  } finally { await cleanupScenario(client, scenario); }
});

test("a sync failure rolls back fixture, source, and team writes", async (t) => {
  if (!integrationEnabled) { t.skip("SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required"); return; }
  const client = createTestSupabaseClient();
  const scenario = await createScenario(client, "transaction-rollback");
  try {
    await applySnapshot(client, scenario, createStateSnapshot(scenario, "scheduled"));
    const invalid = createStateSnapshot(scenario, "finished");
    invalid.fixtures[0].team_a = 999_999_999;
    await assert.rejects(
      () => applySnapshot(client, scenario, invalid),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "SYNC_DATABASE_ERROR",
    );
    const [fixtureResult, sourceResult, teamResult, failedJobs] = await Promise.all([
      client.from("fixtures").select("status,home_score,away_score").eq("external_fixture_id", scenario.fixtureExternalId).single(),
      client.from("fixture_source_records").select("status,home_score,away_score").eq("fixture_id", (await client.from("fixtures").select("id").eq("external_fixture_id", scenario.fixtureExternalId).single()).data?.id ?? "").single(),
      client.from("teams").select("external_team_id").like("name", `${scenario.prefix}%`),
      client.from("job_runs").select("status,error_code").like("idempotency_key", `${scenario.prefix}:%`).eq("status", "failed"),
    ]);
    assert.equal(fixtureResult.error, null);
    assert.equal(sourceResult.error, null);
    assert.equal(teamResult.error, null);
    assert.equal(fixtureResult.data?.status, "scheduled");
    assert.equal(fixtureResult.data?.home_score, null);
    assert.equal(fixtureResult.data?.away_score, null);
    assert.equal(sourceResult.data?.status, "scheduled");
    assert.equal(teamResult.data?.length, 2);
    assert.equal(failedJobs.data?.length, 1);
    assert.equal(failedJobs.data?.[0]?.error_code, "SYNC_DATABASE_ERROR");
  } finally { await cleanupScenario(client, scenario); }
});
