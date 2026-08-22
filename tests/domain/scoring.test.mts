import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateGameweekScoring,
  calculateSeasonTotals,
  scorePrediction,
  type ScoringInput,
} from "../../lib/domain/scoring.ts";

const baseInput: ScoringInput = {
  fixtures: [
    { id: "fx-home", status: "finished", homeScore: 2, awayScore: 1 },
    { id: "fx-draw", status: "finished", homeScore: 1, awayScore: 1 },
    { id: "fx-postponed", status: "postponed", homeScore: null, awayScore: null },
  ],
  predictions: [
    { userId: "u1", fixtureId: "fx-home", choice: "home", status: "active" },
    { userId: "u1", fixtureId: "fx-draw", choice: "away", status: "active" },
    { userId: "u2", fixtureId: "fx-home", choice: "home", status: "active" },
    { userId: "u2", fixtureId: "fx-draw", choice: "draw", status: "active" },
    { userId: "u2", fixtureId: "fx-postponed", choice: "home", status: "voided" },
  ],
  participants: [
    { userId: "u1", status: "active" },
    { userId: "u2", status: "active" },
    { userId: "excluded", status: "excluded" },
  ],
};

describe("scoring domain rules", () => {
  it("awards three points only for a matching outcome", () => {
    assert.equal(scorePrediction("home", "home"), 3);
    assert.equal(scorePrediction("home", "draw"), 0);
    assert.equal(scorePrediction(null, "home"), 0);
  });

  it("scores finished fixtures, omits postponed fixtures, and excludes users", () => {
    const result = calculateGameweekScoring(baseInput);

    assert.deepEqual(result.scores, [
      { userId: "u1", points: 3, correctPredictions: 1, predictedFixtures: 2, countedFixtures: 2 },
      { userId: "u2", points: 6, correctPredictions: 2, predictedFixtures: 2, countedFixtures: 2 },
    ]);
    assert.deepEqual(result.awards, [
      { userId: "u2", award: "champion", points: 6 },
      { userId: "u1", award: "wooden_spoon", points: 3 },
    ]);
  });

  it("gives every tied player each applicable award", () => {
    const result = calculateGameweekScoring({
      fixtures: [{ id: "fx-1", status: "finished", homeScore: 2, awayScore: 1 }],
      predictions: [
        { userId: "u1", fixtureId: "fx-1", choice: "home", status: "active" },
        { userId: "u2", fixtureId: "fx-1", choice: "home", status: "active" },
      ],
      participants: [
        { userId: "u1", status: "active" },
        { userId: "u2", status: "active" },
      ],
    });

    assert.deepEqual(result.awards, [
      { userId: "u1", award: "champion", points: 3 },
      { userId: "u2", award: "champion", points: 3 },
      { userId: "u1", award: "wooden_spoon", points: 3 },
      { userId: "u2", award: "wooden_spoon", points: 3 },
    ]);
  });

  it("does not create awards before any fixture has finished", () => {
    const result = calculateGameweekScoring({
      fixtures: [{ id: "fx-1", status: "scheduled", homeScore: null, awayScore: null }],
      predictions: [],
      participants: [{ userId: "u1", status: "active" }],
    });

    assert.deepEqual(result.scores, [{
      userId: "u1",
      points: 0,
      correctPredictions: 0,
      predictedFixtures: 0,
      countedFixtures: 0,
    }]);
    assert.deepEqual(result.awards, []);
  });

  it("scores finished fixtures even while later fixtures in the gameweek remain scheduled", () => {
    const result = calculateGameweekScoring({
      fixtures: [
        { id: "fx-finished", status: "finished", homeScore: 1, awayScore: 0 },
        { id: "fx-later", status: "scheduled", homeScore: null, awayScore: null },
      ],
      predictions: [{ userId: "u1", fixtureId: "fx-finished", choice: "home", status: "active" }],
      participants: [{ userId: "u1", status: "active" }],
    });

    assert.deepEqual(result.scores, [{
      userId: "u1",
      points: 3,
      correctPredictions: 1,
      predictedFixtures: 1,
      countedFixtures: 1,
    }]);
  });

  it("rebuilds season totals from included gameweeks instead of deltas", () => {
    assert.deepEqual(calculateSeasonTotals([
      { userId: "u1", gameweekId: "gw-1", points: 3 },
      { userId: "u1", gameweekId: "gw-2", points: 6 },
      { userId: "u2", gameweekId: "gw-1", points: 9 },
    ], new Set(["gw-2"])), [
      { userId: "u1", points: 3, includedGameweeks: 1 },
      { userId: "u2", points: 9, includedGameweeks: 1 },
    ]);
  });

  it("rebuilds a corrected finished result without retaining the previous points", () => {
    const input: ScoringInput = {
      fixtures: [{ id: "fx-1", status: "finished", homeScore: 2, awayScore: 1 }],
      predictions: [
        { userId: "u1", fixtureId: "fx-1", choice: "home", status: "active" },
        { userId: "u2", fixtureId: "fx-1", choice: "draw", status: "active" },
      ],
      participants: [
        { userId: "u1", status: "active" },
        { userId: "u2", status: "active" },
      ],
    };
    assert.deepEqual(calculateGameweekScoring(input).scores.map(({ userId, points }) => ({ userId, points })), [
      { userId: "u1", points: 3 },
      { userId: "u2", points: 0 },
    ]);

    const corrected = calculateGameweekScoring({
      ...input,
      fixtures: [{ id: "fx-1", status: "finished", homeScore: 1, awayScore: 1 }],
    });

    assert.deepEqual(corrected.scores.map(({ userId, points }) => ({ userId, points })), [
      { userId: "u1", points: 0 },
      { userId: "u2", points: 3 },
    ]);
    assert.equal(corrected.scores.length, 2);
  });
});
