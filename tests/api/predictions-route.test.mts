import test from "node:test";
import assert from "node:assert/strict";
import { createPredictionsHandler } from "../../lib/api/predictions-handler.ts";

test("prediction API saves a choice for the authenticated user", async () => {
  const calls: unknown[] = [];
  const handler = createPredictionsHandler({
    requireUser: async () => ({ id: "user-1" }),
    savePrediction: async (input) => {
      calls.push(input);
      return { fixtureId: input.fixtureId, choice: input.choice, status: "active" };
    },
    listPredictions: async () => [],
  });

  const response = await handler(new Request("https://example.test/api/predictions", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fixtureId: "fixture-1", choice: "home" }),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    prediction: { fixtureId: "fixture-1", choice: "home", status: "active" },
  });
  assert.deepEqual(calls, [{ userId: "user-1", fixtureId: "fixture-1", choice: "home" }]);
});

test("prediction API rejects invalid choices before touching persistence", async () => {
  let saves = 0;
  const handler = createPredictionsHandler({
    requireUser: async () => ({ id: "user-1" }),
    savePrediction: async () => {
      saves += 1;
      return { fixtureId: "fixture-1", choice: "home", status: "active" };
    },
    listPredictions: async () => [],
  });

  const response = await handler(new Request("https://example.test/api/predictions", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fixtureId: "fixture-1", choice: "goals" }),
  }));

  assert.equal(response.status, 400);
  assert.equal(saves, 0);
});

test("prediction API lists the requested gameweek for the authenticated user", async () => {
  const handler = createPredictionsHandler({
    requireUser: async () => ({ id: "user-1" }),
    savePrediction: async () => ({ fixtureId: "fixture-1", choice: "home", status: "active" }),
    listPredictions: async (input) => [{ fixtureId: input.gameweekId, choice: "draw", status: "active" }],
  });

  const response = await handler(new Request("https://example.test/api/predictions?gameweekId=gw-28"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    gameweekId: "gw-28",
    predictions: [{ fixtureId: "gw-28", choice: "draw", status: "active" }],
  });
});

test("prediction API saves a gameweek batch through one atomic persistence call", async () => {
  const calls: unknown[] = [];
  const handler = createPredictionsHandler({
    requireUser: async () => ({ id: "user-1" }),
    savePrediction: async () => {
      throw new Error("single-fixture persistence must not be used for batches");
    },
    savePredictions: async (input) => {
      calls.push(input);
      return input.predictions.map((prediction) => ({ ...prediction, status: "active" }));
    },
    listPredictions: async () => [],
  });

  const response = await handler(new Request("https://example.test/api/predictions", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ predictions: [
      { fixtureId: "fixture-1", choice: "home" },
      { fixtureId: "fixture-2", choice: "draw" },
    ] }),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    userId: "user-1",
    predictions: [
      { fixtureId: "fixture-1", choice: "home" },
      { fixtureId: "fixture-2", choice: "draw" },
    ],
  }]);
  assert.deepEqual(await response.json(), {
    predictions: [
      { fixtureId: "fixture-1", choice: "home", status: "active" },
      { fixtureId: "fixture-2", choice: "draw", status: "active" },
    ],
  });
});
