import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPrediction,
  getPredictionPercentages,
  isPredictionComplete,
} from "../lib/predictions.ts";

describe("prediction helpers", () => {
  it("updates one fixture without mutating the existing map", () => {
    const original = { fixture_a: "home" as const };
    const next = applyPrediction(original, "fixture_b", "away");
    assert.deepEqual(next, { fixture_a: "home", fixture_b: "away" });
    assert.deepEqual(original, { fixture_a: "home" });
  });

  it("only reports complete when every fixture has a choice", () => {
    assert.equal(isPredictionComplete(["a", "b"], { a: "draw" }), false);
    assert.equal(isPredictionComplete(["a", "b"], { a: "draw", b: "home" }), true);
  });

  it("calculates percentages and handles an empty audience", () => {
    assert.deepEqual(getPredictionPercentages(["home", "home", "draw", "away"]), {
      home: 50,
      draw: 25,
      away: 25,
    });
    assert.deepEqual(getPredictionPercentages([]), { home: 0, draw: 0, away: 0 });
  });
});
