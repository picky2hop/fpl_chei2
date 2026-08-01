import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionShareFlex, buildStandingsShareFlex } from "../../lib/line/share-payload.ts";
import { teams, type Fixture, type LeaderboardEntry } from "../../lib/mock-data.ts";

const entry: LeaderboardEntry = {
  id: "u1",
  displayName: "ผู้เล่นหนึ่ง",
  shortName: "ผห",
  avatarUrl: "https://example.com/avatar.jpg",
  rank: 1,
  gameweekPoints: 8,
  seasonPoints: 42,
  trend: "up",
  form: [3, 2, 1],
};

const fixture: Fixture = {
  id: "fixture-1",
  gameweek: 1,
  kickoff: "2026-08-01T12:00:00.000Z",
  dateLabel: "1 ส.ค. 18:00",
  status: "upcoming",
  homeTeam: teams.arsenal,
  awayTeam: teams.chelsea,
  predictionPercentages: { home: 50, draw: 20, away: 30 },
  predictors: { home: [], draw: [], away: [] },
};

test("builds the standings share payload from the selected app mode", () => {
  const message = buildStandingsShareFlex({ entries: [entry], gameweek: 1, period: "season" });
  const serialized = JSON.stringify(message);

  assert.match(serialized, /42 คะแนน/);
  assert.match(serialized, /https:\/\/example\.com\/avatar\.jpg/);
  assert.match(serialized, /เปิดแอป FPL Chei Chei/);
});

test("builds the prediction share payload with profile and team assets", () => {
  const message = buildPredictionShareFlex({
    currentUser: entry,
    fixtures: [fixture],
    gameweek: 1,
    predictions: { "fixture-1": "home" },
  });
  const serialized = JSON.stringify(message);

  assert.match(serialized, /https:\/\/example\.com\/avatar\.jpg/);
  assert.match(serialized, /resources\.premierleague\.com\/premierleague25\/badges\/3\.png/);
  assert.match(serialized, /resources\.premierleague\.com\/premierleague25\/badges\/8\.png/);
  assert.doesNotMatch(serialized, /\.svg/);
  assert.match(serialized, /https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/);
});
