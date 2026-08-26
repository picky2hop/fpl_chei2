import test from "node:test";
import assert from "node:assert/strict";
import { buildFixturePredictionShareFlex, buildPredictionShareFlex, buildStandingsShareFlex } from "../../lib/line/share-payload.ts";
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
  assert.match(serialized, /กดเพื่อเข้าไป ทายผล/);
});

test("builds the prediction share payload with profile and team assets", () => {
  const originalHomeCrest = fixture.homeTeam.crest;
  const originalAwayCrest = fixture.awayTeam.crest;
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
  assert.doesNotMatch(serialized, /"0px"/);
  assert.doesNotMatch(serialized, /"paddingAll":"none"/);
  assert.match(serialized, /https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/);
  const bubble = message.contents as Record<string, unknown>;
  const body = bubble.body as Record<string, unknown>;
  assert.doesNotMatch(JSON.stringify(body), /PLAYER PICKS/);
  assert.equal(fixture.homeTeam.crest, originalHomeCrest);
  assert.equal(fixture.awayTeam.crest, originalAwayCrest);
  assert.match(fixture.homeTeam.crest, /\.svg$/);
  assert.match(fixture.awayTeam.crest, /\.svg$/);
});

test("prediction share payload keeps every fixture in one Flex bubble", () => {
  const fixtures = Array.from({ length: 6 }, (_, index) => ({
    ...fixture,
    id: `fixture-${index + 1}`,
    homeTeam: { ...fixture.homeTeam, name: `Home ${index + 1}` },
    awayTeam: { ...fixture.awayTeam, name: `Away ${index + 1}` },
  }));
  const message = buildPredictionShareFlex({
    currentUser: entry,
    fixtures,
    gameweek: 1,
    predictions: Object.fromEntries(fixtures.map((item) => [item.id, "home"])),
  });

  assert.equal(message.contents.type, "bubble");
  const serialized = JSON.stringify(message);
  for (const index of [1, 2, 3, 4, 5, 6]) {
    assert.match(serialized, new RegExp(`Home ${index}`));
    assert.match(serialized, new RegExp(`Away ${index}`));
  }
});

test("builds a match-detail share payload from the app fixture and predictors", () => {
  const originalHomeCrest = fixture.homeTeam.crest;
  const originalAwayCrest = fixture.awayTeam.crest;
  const message = buildFixturePredictionShareFlex({
    fixture,
    gameweek: 1,
    predictors: [
      { name: "Picky", avatarUrl: "https://example.com/picky.jpg", choice: "home" },
      { name: "Chei", avatarUrl: "https://example.com/chei.jpg", choice: "draw" },
    ],
  });

  const serialized = JSON.stringify(message);
  assert.equal(message.contents.type, "bubble");
  assert.match(serialized, new RegExp(fixture.homeTeam.name));
  assert.match(serialized, new RegExp(fixture.awayTeam.name));
  assert.match(serialized, /Picky/);
  assert.match(serialized, /https:\/\/example\.com\/chei\.jpg/);
  assert.match(serialized, /50/);
  assert.match(serialized, /19:00/);
  assert.doesNotMatch(serialized, /\.svg/);
  assert.equal(fixture.homeTeam.crest, originalHomeCrest);
  assert.equal(fixture.awayTeam.crest, originalAwayCrest);
});

test("prediction share payload carries fixture kickoff dates into grouped sections", () => {
  const fixtures = [
    fixture,
    {
      ...fixture,
      id: "fixture-2",
      kickoff: "2026-08-02T12:00:00.000Z",
      homeTeam: { ...fixture.homeTeam, name: "Liverpool" },
      awayTeam: { ...fixture.awayTeam, name: "Spurs" },
    },
  ];
  const message = buildPredictionShareFlex({
    currentUser: entry,
    fixtures,
    gameweek: 1,
    predictions: { "fixture-1": "home", "fixture-2": "away" },
  });

  const serialized = JSON.stringify(message);
  assert.match(serialized, /วันเสาร์ที่ 1 สิงหาคม 2569 — 1 คู่/);
  assert.match(serialized, /วันอาทิตย์ที่ 2 สิงหาคม 2569 — 1 คู่/);
});
