import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardLeaderboardRows, buildLeaderboardByGameweek, selectPredictionDefaultGameweek } from "../../lib/data/dashboard-view.ts";
import { getLeaderboardEntriesWithPrediction, getSeasonLeaderboardEntries } from "../../lib/predictions.ts";

const users = [
  { id: "user-a", displayName: "ผู้เล่น A", avatarUrl: "" },
  { id: "user-b", displayName: "ผู้เล่น B", avatarUrl: "" },
];

test("keeps leaderboard rows scoped to the selected gameweek", () => {
  const result = buildLeaderboardByGameweek(
    [{ id: "gw-1", number: 1 }, { id: "gw-2", number: 2 }],
    {
      1: [{ ...users[0], gameweekPoints: 10, seasonPoints: 10 }],
      2: [{ ...users[1], gameweekPoints: 4, seasonPoints: 14 }],
    },
  );

  assert.deepEqual(result[1]?.map((entry) => entry.id), ["user-a"]);
  assert.deepEqual(result[2]?.map((entry) => entry.id), ["user-b"]);
  assert.equal(result[2]?.[0]?.gameweekPoints, 4);
});

test("builds server leaderboard rows from active participants of that gameweek", () => {
  const result = buildDashboardLeaderboardRows(
    [{ id: "gw-1", number: 1 }, { id: "gw-2", number: 2 }],
    [
      { gameweek_id: "gw-1", user_id: "user-a", status: "active" },
      { gameweek_id: "gw-2", user_id: "user-b", status: "active" },
    ],
    [
      { gameweek_id: "gw-1", user_id: "user-a", points: 10 },
      { gameweek_id: "gw-2", user_id: "user-b", points: 4 },
    ],
    [
      { id: "user-a", display_name: "ผู้เล่น A", avatar_url: null },
      { id: "user-b", display_name: "ผู้เล่น B", avatar_url: null },
    ],
  );

  assert.deepEqual(result[2]?.map((entry) => entry.id), ["user-b"]);
  assert.equal(result[2]?.[0]?.seasonPoints, 4);
});

test("does not show a player with no prediction in the selected gameweek", () => {
  const entries = [
    { ...users[0], rank: 1, gameweekPoints: 10, seasonPoints: 10, trend: "same" as const, form: [] },
    { ...users[1], rank: 2, gameweekPoints: 4, seasonPoints: 14, trend: "same" as const, form: [] },
  ];

  const visible = getLeaderboardEntriesWithPrediction(entries, ["fixture-2"], { 2: { "user-b": { "fixture-2": "home" } } }, 2);

  assert.deepEqual(visible.map((entry) => entry.id), ["user-b"]);
});

test("season leaderboard keeps earlier scorers and users with any prediction through the selected gameweek", () => {
  const entriesByGameweek = {
    1: [
      { ...users[0], rank: 1, gameweekPoints: 10, seasonPoints: 10, trend: "same" as const, form: [] },
      { ...users[1], rank: 2, gameweekPoints: 0, seasonPoints: 0, trend: "same" as const, form: [] },
    ],
    2: [
      { ...users[1], rank: 1, gameweekPoints: 4, seasonPoints: 4, trend: "same" as const, form: [] },
    ],
  };

  const visible = getSeasonLeaderboardEntries(
    entriesByGameweek,
    { 1: { "user-b": { "fixture-1": "home" } } },
    2,
  );

  assert.deepEqual(visible.map((entry) => [entry.id, entry.seasonPoints, entry.rank]), [
    ["user-a", 10, 1],
    ["user-b", 4, 2],
  ]);
});

test("defaults the prediction tab to the next gameweek after the current gameweek is closed", () => {
  assert.equal(selectPredictionDefaultGameweek(1, [
    { number: 1, status: "closed" },
    { number: 2, status: "upcoming" },
  ], [
    { gameweekNumber: 1, status: "finished" },
    { gameweekNumber: 1, status: "postponed" },
  ]), 2);
});

test("keeps the current gameweek when a scheduled or live fixture remains", () => {
  const gameweeks = [
    { number: 1, status: "closed" },
    { number: 2, status: "upcoming" },
  ];

  assert.equal(selectPredictionDefaultGameweek(1, gameweeks, [{ gameweekNumber: 1, status: "scheduled" }]), 1);
  assert.equal(selectPredictionDefaultGameweek(1, gameweeks, [{ gameweekNumber: 1, status: "live" }]), 1);
});

test("keeps the current gameweek when it is not closed or there is no next gameweek", () => {
  assert.equal(selectPredictionDefaultGameweek(1, [
    { number: 1, status: "open" },
    { number: 2, status: "upcoming" },
  ], [{ gameweekNumber: 1, status: "finished" }]), 1);

  assert.equal(selectPredictionDefaultGameweek(2, [
    { number: 1, status: "closed" },
    { number: 2, status: "closed" },
  ], [{ gameweekNumber: 2, status: "finished" }]), 2);
});
