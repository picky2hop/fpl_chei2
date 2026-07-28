import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPrediction,
  getFixturePredictionDetails,
  getPredictionPercentages,
  getUserPredictionDetails,
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

  it("builds a player's prediction details for the selected gameweek", () => {
    assert.deepEqual(
      getUserPredictionDetails(
        [
          { id: "fixture_a", homeTeam: "อาร์เซนอล", awayTeam: "เชลซี" },
          { id: "fixture_b", homeTeam: "ลิเวอร์พูล", awayTeam: "แมนฯ ซิตี้" },
        ],
        { fixture_a: "home" },
      ),
      [
        {
          fixtureId: "fixture_a",
          homeTeam: "อาร์เซนอล",
          awayTeam: "เชลซี",
          choice: "home",
        },
      ],
    );
  });

  it("groups fixture details by outcome without losing profile data", () => {
    assert.deepEqual(
      getFixturePredictionDetails([
        { name: "มุก", avatarUrl: "mook.png", choice: "home" },
        { name: "นัท", avatarUrl: "nut.png", choice: "draw" },
        { name: "แบงค์", avatarUrl: "bank.png", choice: "away" },
      ]),
      {
        home: [{ name: "มุก", avatarUrl: "mook.png", choice: "home" }],
        draw: [{ name: "นัท", avatarUrl: "nut.png", choice: "draw" }],
        away: [{ name: "แบงค์", avatarUrl: "bank.png", choice: "away" }],
      },
    );
  });
});
