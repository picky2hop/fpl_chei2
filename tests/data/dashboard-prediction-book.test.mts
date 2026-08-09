import test from "node:test";
import assert from "node:assert/strict";
import { mapPredictionBook } from "../../lib/data/dashboard-core.ts";
import { sortFixturesForFplOrder } from "../../lib/data/fixture-order.ts";

test("orders fixtures like FPL when kickoff times are identical", () => {
  const fixtures = sortFixturesForFplOrder([
    { id: "fixture-2", kickoff_at: "2026-08-01T12:00:00.000Z", external_fixture_id: 2002 },
    { id: "fixture-1", kickoff_at: "2026-08-01T12:00:00.000Z", external_fixture_id: 2001 },
    { id: "fixture-3", kickoff_at: "2026-08-01T13:00:00.000Z", external_fixture_id: 2003 },
  ], (fixture) => fixture.kickoff_at, (fixture) => fixture.external_fixture_id);

  assert.deepEqual(fixtures.map((fixture) => fixture.id), ["fixture-1", "fixture-2", "fixture-3"]);
});

test("maps active predictions into the selected gameweek and player detail book", () => {
  const result = mapPredictionBook({
    gameweeks: [{ id: "gw-1", number: 1 }, { id: "gw-2", number: 2 }],
    fixtures: [{ id: "fixture-1", gameweekId: "gw-2" }],
    predictions: [{ userId: "user-2", fixtureId: "fixture-1", outcome: "away", status: "active" }],
  });

  assert.deepEqual(result, {
    2: { "user-2": { "fixture-1": "away" } },
  });
});

test("does not include voided or malformed prediction choices", () => {
  const result = mapPredictionBook({
    gameweeks: [{ id: "gw-1", number: 1 }],
    fixtures: [{ id: "fixture-1", gameweekId: "gw-1" }],
    predictions: [
      { userId: "user-1", fixtureId: "fixture-1", outcome: "home", status: "voided" },
      { userId: "user-2", fixtureId: "fixture-1", outcome: "invalid", status: "active" },
    ],
  });

  assert.deepEqual(result, {});
});
