import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPrediction,
  canEditPrediction,
  getCompleteLeaderboardEntries,
  getEditablePredictionIds,
  getEditablePredictions,
  getFixturePredictors,
  getFixturePredictionDetails,
  getPredictionPercentages,
  getPredictionTeamHighlights,
  getUserPredictionDetails,
  isPredictionComplete,
  normalizePredictionPercentage,
} from "../lib/predictions.ts";

describe("prediction helpers", () => {
  it("only allows prediction edits before kickoff for scheduled fixtures", () => {
    const kickoffAt = "2026-08-22T12:00:00.000Z";

    assert.equal(canEditPrediction({ status: "scheduled", kickoffAt }, new Date("2026-08-22T11:59:59.000Z")), true);
    assert.equal(canEditPrediction({ status: "scheduled", kickoffAt }, new Date("2026-08-22T12:00:00.000Z")), false);
    assert.equal(canEditPrediction({ status: "live", kickoffAt }, new Date("2026-08-22T11:00:00.000Z")), false);
    assert.equal(canEditPrediction({ status: "finished", kickoffAt }, new Date("2026-08-22T11:00:00.000Z")), false);
  });

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

  it("saves only still-editable fixtures when another fixture is already locked", () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const fixtures = [
      { id: "started", status: "live" as const, kickoffAt: "2026-08-22T11:00:00.000Z" },
      { id: "future", status: "scheduled" as const, kickoffAt: "2026-08-22T13:00:00.000Z" },
    ];

    assert.deepEqual(getEditablePredictionIds(fixtures, now), ["future"]);
    assert.deepEqual(getEditablePredictions(fixtures, { started: "home", future: "away" }, now), { future: "away" });
  });

  it("keeps only players who predicted every fixture in the selected gameweek", () => {
    const entries = [
      { id: "u1", displayName: "Complete" },
      { id: "u2", displayName: "Partial" },
      { id: "u3", displayName: "Missing" },
    ];
    const fixtureIds = ["fixture_a", "fixture_b"];

    assert.deepEqual(
      getCompleteLeaderboardEntries(entries, fixtureIds, {
        5: {
          u1: { fixture_a: "home", fixture_b: "away" },
          u2: { fixture_a: "draw" },
          u3: {},
        },
      }, 5),
      [entries[0]],
    );
    assert.deepEqual(getCompleteLeaderboardEntries(entries, [], {}, 5), []);
  });

  it("normalizes percentage bar widths to the valid visual range", () => {
    assert.equal(normalizePredictionPercentage(-10), 0);
    assert.equal(normalizePredictionPercentage(75), 75);
    assert.equal(normalizePredictionPercentage(140), 100);
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

  it("builds the selected fixture predictor list from the shared prediction book", () => {
    assert.deepEqual(
      getFixturePredictors(
        [
          { id: "u1", displayName: "Picky", avatarUrl: "picky.png" },
          { id: "u2", displayName: "Chei", avatarUrl: "chei.png" },
          { id: "u3", displayName: "No Pick", avatarUrl: "none.png" },
        ],
        {
          1: {
            u1: { fixture_a: "home" },
            u2: { fixture_a: "draw" },
            u3: { fixture_b: "away" },
          },
        },
        1,
        "fixture_a",
      ),
      [
        { name: "Picky", avatarUrl: "picky.png", choice: "home" },
        { name: "Chei", avatarUrl: "chei.png", choice: "draw" },
      ],
    );
  });

  it("highlights the team side selected by a player", () => {
    assert.deepEqual(getPredictionTeamHighlights("home"), { home: true, away: false });
    assert.deepEqual(getPredictionTeamHighlights("draw"), { home: false, away: false });
    assert.deepEqual(getPredictionTeamHighlights("away"), { home: false, away: true });
  });
});
