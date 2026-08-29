import assert from "node:assert/strict";
import test from "node:test";
import { createPredictionService } from "../../lib/data/prediction-service.ts";

test("prediction service maps the atomic batch RPC response", async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const service = createPredictionService({
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return {
        data: [
          { fixture_id: "fixture-1", outcome: "home", status: "active" },
          { fixture_id: "fixture-2", outcome: "draw", status: "active" },
        ],
        error: null,
      };
    },
  } as never);

  const result = await service.savePredictions({
    userId: "user-1",
    predictions: [
      { fixtureId: "fixture-1", choice: "home" },
      { fixtureId: "fixture-2", choice: "draw" },
    ],
  });

  assert.deepEqual(calls, [{
    name: "save_predictions",
    params: {
      p_user_id: "user-1",
      p_predictions: [
        { fixtureId: "fixture-1", choice: "home" },
        { fixtureId: "fixture-2", choice: "draw" },
      ],
    },
  }]);
  assert.deepEqual(result, [
    { fixtureId: "fixture-1", choice: "home", status: "active" },
    { fixtureId: "fixture-2", choice: "draw", status: "active" },
  ]);
});

test("prediction service maps the first-fixture gate error without exposing database details", async () => {
  const service = createPredictionService({
    rpc: async () => ({
      data: null,
      error: { code: "P0001", message: "internal rule detail", hint: "FIRST_FIXTURE_MISSED" },
    }),
  } as never);

  await assert.rejects(
    () => service.savePrediction({ userId: "user-1", fixtureId: "fixture-2", choice: "home" }),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.equal((error as { name: string }).name, "PredictionWriteError");
      assert.equal((error as { status: number }).status, 409);
      assert.equal((error as { reason: string }).reason, "first_fixture_missed");
      return true;
    },
  );
});

test("prediction service maps the first-fixture gate error for atomic batches", async () => {
  const service = createPredictionService({
    rpc: async () => ({
      data: null,
      error: { code: "P0001", message: "internal rule detail", hint: "FIRST_FIXTURE_MISSED" },
    }),
  } as never);

  await assert.rejects(
    () => service.savePredictions({ userId: "user-1", predictions: [{ fixtureId: "fixture-2", choice: "home" }] }),
    (error: unknown) => {
      assert.equal((error as { name: string }).name, "PredictionWriteError");
      assert.equal((error as { status: number }).status, 409);
      assert.equal((error as { reason: string }).reason, "first_fixture_missed");
      return true;
    },
  );
});
