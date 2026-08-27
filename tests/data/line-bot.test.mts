import test from "node:test";
import assert from "node:assert/strict";
import {
  getBangkokDayRange,
  getBangkokTwoDayRange,
  formatBangkokShortDate,
  formatBangkokFullDate,
  formatBangkokDateRangeLabel,
  selectActiveGameweek,
  mapStandingsRows,
  mapTodayFixtureRows,
  mapUserPredictionRows,
  selectCompleteParticipantIds,
  selectLatestAwardedGameweek,
  derivePredictionAwardSelections,
  mapPredictionAwards,
  mapFantasyAwards,
  selectUserPredictionGameweek,
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

test("keeps the latest closed gameweek with awards until the next gameweek is also closed", () => {
  const gameweeks = [
    { id: "gw-5", number: 5, status: "closed" as const },
    { id: "gw-6", number: 6, status: "open" as const },
  ];
  const awards = [{ gameweekId: "gw-5" }];

  assert.deepEqual(selectLatestAwardedGameweek(gameweeks, awards), gameweeks[0]);
  assert.deepEqual(
    selectLatestAwardedGameweek(
      [...gameweeks, { id: "gw-7", number: 7, status: "closed" as const }],
      [...awards, { gameweekId: "gw-7" }],
    ),
    { id: "gw-7", number: 7, status: "closed" },
  );
});

test("derives awards only from eligible users when stale zero-score rows exist", () => {
  assert.deepEqual(
    derivePredictionAwardSelections({
      gameweekId: "gw-1",
      gameweek: 1,
      scores: [
        { userId: "u1", points: 18 },
        { userId: "u2", points: 12 },
        { userId: "u3", points: 12 },
        { userId: "u4", points: 3 },
        { userId: "u5", points: 0 },
      ],
      eligibleUserIds: new Set(["u1", "u2", "u3", "u4"]),
    }),
    [
      { gameweekId: "gw-1", gameweek: 1, award: "champion", userId: "u1", points: 18 },
      { gameweekId: "gw-1", gameweek: 1, award: "wooden_spoon", userId: "u4", points: 3 },
    ],
  );
});

test("maps tied prediction award recipients with profile and LINE identity", () => {
  assert.deepEqual(mapPredictionAwards([
    { gameweekId: "gw-5", gameweek: 5, award: "champion", userId: "u1", lineUserId: "line-1", displayName: "Ar Tao", avatarUrl: "https://example.test/ar.png", points: 18 },
    { gameweekId: "gw-5", gameweek: 5, award: "wooden_spoon", userId: "u2", lineUserId: null, displayName: "สำรอง", avatarUrl: null, points: 3 },
  ]), {
    gameweek: 5,
    champions: [{ userId: "u1", lineUserId: "line-1", displayName: "Ar Tao", avatarUrl: "https://example.test/ar.png", points: 18 }],
    woodenSpoons: [{ userId: "u2", lineUserId: null, displayName: "สำรอง", avatarUrl: "", points: 3 }],
  });
});

test("maps Fantasy award recipients with league, team, profile, and points", () => {
  assert.deepEqual(mapFantasyAwards([
    { leagueFplId: 819498, leagueName: "เชยเชย Cup", gameweek: 1, award: "champion", entryId: 1, lineUserId: "line-1", displayName: "Champion", avatarUrl: "https://example.test/champion.png", teamName: "Champion FC", managerName: "Manager", points: 70 },
    { leagueFplId: 819498, leagueName: "เชยเชย Cup", gameweek: 1, award: "wooden_spoon", entryId: 2, lineUserId: null, displayName: "Spoon", avatarUrl: null, teamName: "Spoon FC", managerName: "Spoon Manager", points: 35 },
  ]), {
    leagueFplId: 819498,
    leagueName: "เชยเชย Cup",
    gameweek: 1,
    champions: [{ entryId: 1, lineUserId: "line-1", displayName: "Champion", avatarUrl: "https://example.test/champion.png", teamName: "Champion FC", managerName: "Manager", points: 70 }],
    woodenSpoons: [{ entryId: 2, lineUserId: null, displayName: "Spoon", avatarUrl: "", teamName: "Spoon FC", managerName: "Spoon Manager", points: 35 }],
  });
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

test("formats the two-day fixture header and full day headings in Bangkok time", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  assert.equal(formatBangkokShortDate(now), "ส. 1 ส.ค. 69");
  assert.equal(formatBangkokFullDate(now), "วันเสาร์ที่ 1 สิงหาคม 2569");
  assert.equal(formatBangkokDateRangeLabel(now), "ส. 1 ส.ค. 69 · อา. 2 ส.ค. 69");
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
  assert.equal(result[0]?.scoreLabel, "3 - 0");
  assert.equal(result[0]?.statusLabel, "Live");
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

test("selects the next gameweek when the user has completed every prediction", () => {
  assert.equal(selectUserPredictionGameweek({
    currentGameweek: 1,
    gameweeks: [{ number: 1, status: "closed" }, { number: 2, status: "upcoming" }],
    fixtures: [
      { id: "gw1-f1", gameweekNumber: 1, status: "finished" },
      { id: "gw2-f1", gameweekNumber: 2, status: "scheduled" },
      { id: "gw2-f2", gameweekNumber: 2, status: "scheduled" },
    ],
    predictionsByGameweek: { 2: ["gw2-f1", "gw2-f2"] },
  }), 2);
});

test("keeps the previous gameweek when the user has incomplete next-gameweek predictions", () => {
  assert.equal(selectUserPredictionGameweek({
    currentGameweek: 1,
    gameweeks: [{ number: 1, status: "closed" }, { number: 2, status: "upcoming" }],
    fixtures: [
      { id: "gw1-f1", gameweekNumber: 1, status: "finished" },
      { id: "gw2-f1", gameweekNumber: 2, status: "scheduled" },
      { id: "gw2-f2", gameweekNumber: 2, status: "scheduled" },
    ],
    predictionsByGameweek: { 2: ["gw2-f1"] },
  }), 1);
});

test("keeps the previous gameweek when the user has no predictions in the next gameweek", () => {
  assert.equal(selectUserPredictionGameweek({
    currentGameweek: 1,
    gameweeks: [{ number: 1, status: "closed" }, { number: 2, status: "upcoming" }],
    fixtures: [{ id: "gw1-f1", gameweekNumber: 1, status: "finished" }, { id: "gw2-f1", gameweekNumber: 2, status: "scheduled" }],
    predictionsByGameweek: {},
  }), 1);
});

test("does not fall back when the selected gameweek has no earlier gameweek", () => {
  assert.equal(selectUserPredictionGameweek({
    currentGameweek: 1,
    gameweeks: [{ number: 1, status: "open" }],
    fixtures: [{ id: "gw1-f1", gameweekNumber: 1, status: "scheduled" }],
    predictionsByGameweek: {},
  }), 1);
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
