import test from "node:test";
import assert from "node:assert/strict";
import {
  getBangkokDayRange,
  selectActiveGameweek,
  mapStandingsRows,
  mapTodayFixtureRows,
  mapUserPredictionRows,
} from "../../lib/data/line-bot-core.ts";

test("selects the current gameweek and falls back when FPL has no current flag", () => {
  assert.deepEqual(
    selectActiveGameweek([
      { id: "gw-1", number: 1, isCurrent: false },
      { id: "gw-2", number: 2, isCurrent: true },
    ]),
    { id: "gw-2", number: 2, isCurrent: true },
  );
  assert.deepEqual(
    selectActiveGameweek([
      { id: "gw-1", number: 1, isCurrent: false },
      { id: "gw-2", number: 2, isCurrent: false },
    ]),
    { id: "gw-1", number: 1, isCurrent: false },
  );
});

test("calculates a Bangkok calendar day as UTC boundaries", () => {
  const range = getBangkokDayRange(new Date("2026-08-01T00:00:00.000Z"));

  assert.deepEqual(range, {
    startIso: "2026-07-31T17:00:00.000Z",
    endIso: "2026-08-01T17:00:00.000Z",
    dateLabel: "1 ส.ค. 2569",
  });
});

test("maps standings rows with rank, avatar, and deterministic points order", () => {
  const result = mapStandingsRows(28, [
    { userId: "u2", displayName: "Bee", avatarUrl: null, points: 3 },
    { userId: "u1", displayName: "Aom", avatarUrl: "https://example.test/aom.png", points: 6 },
    { userId: "u3", displayName: "Chei", avatarUrl: "", points: 6 },
  ]);

  assert.deepEqual(result, {
    gameweek: 28,
    rows: [
      { rank: 1, userId: "u1", displayName: "Aom", avatarUrl: "https://example.test/aom.png", points: 6 },
      { rank: 2, userId: "u3", displayName: "Chei", avatarUrl: "", points: 6 },
      { rank: 3, userId: "u2", displayName: "Bee", avatarUrl: "", points: 3 },
    ],
  });
});

test("maps today fixtures with home name/logo and away logo/name data", () => {
  const result = mapTodayFixtureRows([
    {
      id: "fixture-1",
      kickoffAt: "2026-08-01T12:30:00.000Z",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      homeTeam: { name: "Arsenal", logoUrl: "https://example.test/arsenal.png" },
      awayTeam: { name: "Chelsea", logoUrl: "https://example.test/chelsea.png" },
    },
  ]);

  assert.equal(result[0]?.homeTeam.name, "Arsenal");
  assert.equal(result[0]?.homeTeam.logoUrl, "https://example.test/arsenal.png");
  assert.equal(result[0]?.awayTeam.logoUrl, "https://example.test/chelsea.png");
  assert.equal(result[0]?.awayTeam.name, "Chelsea");
  assert.equal(result[0]?.kickoffLabel, "19:30");
  assert.equal(result[0]?.statusLabel, "เริ่มแข่ง");
});

test("maps a user's active predictions to the current gameweek", () => {
  const result = mapUserPredictionRows({
    gameweek: 28,
    displayName: "Picky",
    avatarUrl: null,
    rows: [{
      kickoffAt: "2026-08-01T12:00:00.000Z",
      homeTeam: { name: "Arsenal", logoUrl: "https://example.test/arsenal.png" },
      awayTeam: { name: "Chelsea", logoUrl: "https://example.test/chelsea.png" },
      outcome: "away",
    }],
  });

  assert.deepEqual(result, {
    gameweek: 28,
    displayName: "Picky",
    avatarUrl: "",
    fixtures: [{
      kickoffAt: "2026-08-01T12:00:00.000Z",
      homeTeam: { name: "Arsenal", logoUrl: "https://example.test/arsenal.png" },
      awayTeam: { name: "Chelsea", logoUrl: "https://example.test/chelsea.png" },
      choice: "away",
    }],
  });
});
