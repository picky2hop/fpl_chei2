import test from "node:test";
import assert from "node:assert/strict";
import {
  getBangkokDayRange,
  getBangkokTwoDayRange,
  selectActiveGameweek,
  mapStandingsRows,
  mapTodayFixtureRows,
  mapUserPredictionRows,
  selectCompleteParticipantIds,
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

test("calculates a two-day Bangkok fixture window", () => {
  assert.deepEqual(getBangkokTwoDayRange(new Date("2026-08-01T00:00:00.000Z")), {
    startIso: "2026-07-31T17:00:00.000Z",
    endIso: "2026-08-02T17:00:00.000Z",
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

test("maps latest score for live and finished fixtures", () => {
  const result = mapTodayFixtureRows([{
    id: "fixture-1",
    kickoffAt: "2026-08-01T12:30:00.000Z",
    dayLabel: "วันนี้",
    status: "live",
    homeScore: 3,
    awayScore: 0,
    homeTeam: { name: "Arsenal", logoUrl: "" },
    awayTeam: { name: "Chelsea", logoUrl: "" },
  }]);

  assert.equal(result[0]?.dayLabel, "วันนี้");
  assert.equal(result[0]?.statusLabel, "3 - 0 · LIVE");
});

test("keeps only participants with a prediction for every current gameweek fixture", () => {
  assert.deepEqual(
    selectCompleteParticipantIds(
      ["u1", "u2", "u3"],
      ["f1", "f2"],
      [
        { userId: "u1", fixtureId: "f1" },
        { userId: "u1", fixtureId: "f2" },
        { userId: "u2", fixtureId: "f1" },
        { userId: "u3", fixtureId: "f1" },
        { userId: "u3", fixtureId: "f2" },
      ],
    ),
    ["u1", "u3"],
  );
});

test("maps a user's active predictions to the current gameweek", () => {
  const result = mapUserPredictionRows({
    gameweek: 28,
    displayName: "Picky",
    avatarUrl: null,
    rows: [{
      externalFixtureId: 2001,
      kickoffAt: "2026-08-01T12:00:00.000Z",
      homeTeam: { name: "Arsenal", logoUrl: "https://example.test/arsenal.png" },
      awayTeam: { name: "Chelsea", logoUrl: "https://example.test/chelsea.png" },
      outcome: "away",
      status: "live",
      homeScore: 1,
      awayScore: 0,
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
      status: "live",
      homeScore: 1,
      awayScore: 0,
    }],
  });
});

test("orders a user's predictions by FPL fixture id when kickoff times are identical", () => {
  const result = mapUserPredictionRows({
    gameweek: 28,
    displayName: "Picky",
    avatarUrl: null,
    rows: [
      {
        externalFixtureId: 2002,
        kickoffAt: "2026-08-01T12:00:00.000Z",
        homeTeam: { name: "Second fixture", logoUrl: "" },
        awayTeam: { name: "Away second", logoUrl: "" },
        outcome: "home",
      },
      {
        externalFixtureId: 2001,
        kickoffAt: "2026-08-01T12:00:00.000Z",
        homeTeam: { name: "First fixture", logoUrl: "" },
        awayTeam: { name: "Away first", logoUrl: "" },
        outcome: "away",
      },
    ],
  });

  assert.deepEqual(result.fixtures.map((fixture) => fixture.homeTeam.name), ["First fixture", "Second fixture"]);
});
