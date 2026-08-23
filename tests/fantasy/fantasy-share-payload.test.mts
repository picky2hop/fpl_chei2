import assert from "node:assert/strict";
import test from "node:test";
import { validateFlexMessage } from "../../lib/line/flex.ts";
import { buildFantasyLeaderboardShareFlex, buildFantasyPlayerStatsShareFlex, buildFantasySquadShareFlex } from "../../lib/fantasy/fantasy-share-payload.ts";

function player(input: Partial<{
  pickPosition: number;
  playerId: number;
  playerName: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  clubName: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  points: number | null;
}> = {}) {
  return {
    pickPosition: 1,
    playerId: 1,
    playerName: "Player",
    position: "GK" as const,
    clubName: "Club",
    multiplier: 1,
    isCaptain: false,
    isViceCaptain: false,
    points: 2,
    ...input,
  };
}

function fixtureSquad() {
  return {
    gameweekNumber: 3,
    formation: "3-4-3",
    captainPlayerId: 2,
    viceCaptainPlayerId: 3,
    starters: [
      player({ pickPosition: 1, playerId: 1, playerName: "Raya", position: "GK", points: 4 }),
      player({ pickPosition: 2, playerId: 2, playerName: "Semenyo", position: "FWD", isCaptain: true, points: 6 }),
      player({ pickPosition: 3, playerId: 3, playerName: "Midfielder", position: "MID", isViceCaptain: true, points: 5 }),
      player({ pickPosition: 4, playerId: 4, playerName: "Defender", position: "DEF", points: 3 }),
    ],
    bench: [player({ pickPosition: 12, playerId: 12, playerName: "Bench Player", position: "MID", points: 1 })],
  };
}

function imageComponents(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(imageComponents);
  if (!value || typeof value !== "object") return [];
  const component = value as Record<string, unknown>;
  return [
    ...(component.type === "image" ? [component] : []),
    ...Object.values(component).flatMap(imageComponents),
  ];
}

test("builds a fantasy GW leaderboard without exposing entry ids", () => {
  const message = buildFantasyLeaderboardShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    rows: [{ rank: 1, managerName: "Picky", teamName: "Chei FC", points: 26, avatarUrl: null }],
  });
  const serialized = JSON.stringify(message);

  assert.match(serialized, /เชยเชย Cup/);
  assert.match(serialized, /GW 3/);
  assert.match(serialized, /Chei FC/);
  assert.doesNotMatch(serialized, /entryId|FPL\s+\d/i);
});

test("fantasy leaderboard share removes the branding header and keeps the team label lemon", () => {
  const message = buildFantasyLeaderboardShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    rows: [{ rank: 1, managerName: "Picky", teamName: "Chei FC", points: 26, avatarUrl: "https://example.com/avatar.png" }],
  });
  const contents = message.contents as Record<string, unknown>;
  const body = (contents.body ?? {}) as Record<string, unknown>;
  const row = ((body.contents as Array<Record<string, unknown>>)[3] ?? {}) as Record<string, unknown>;

  assert.equal(contents.size, "giga");
  assert.equal("header" in contents, false);
  assert.doesNotMatch(JSON.stringify(contents), /FPL CHEI CHEI/);
  assert.match(JSON.stringify(contents), /ทีม : Chei FC/);
  assert.doesNotMatch(JSON.stringify(contents), /ชื่อทีม :/);
  assert.match(JSON.stringify(row), /#D9FF58/i);
});

test("fantasy leaderboard rows keep rank, profile and points fixed while the name fills the middle", () => {
  const message = buildFantasyLeaderboardShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    rows: [{ rank: 1, managerName: "Picky", teamName: "Chei FC", points: 26, avatarUrl: "https://example.com/avatar.png" }],
  });
  const contents = message.contents as Record<string, unknown>;
  const body = contents.body as Record<string, unknown>;
  const row = (body.contents as Array<Record<string, unknown>>)[3];
  const rowContents = row.contents as Array<Record<string, unknown>>;

  assert.equal(rowContents[0].flex, 0);
  assert.equal(rowContents[1].flex, 0);
  assert.equal(rowContents[2].flex, 1);
  assert.equal(rowContents[3].flex, 0);
});

test("labels season and preserves rank, manager, team and points", () => {
  const message = buildFantasyLeaderboardShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "season",
    rows: [{ rank: 1, managerName: "Picky", teamName: "Chei FC", points: 120, avatarUrl: null }],
  });
  const serialized = JSON.stringify(message);

  assert.match(serialized, /ทั้งฤดูกาล/);
  assert.match(serialized, /Picky/);
  assert.match(serialized, /Chei FC/);
  assert.match(serialized, /120/);
});

test("builds filtered player-stat share with category and position", () => {
  const message = buildFantasyPlayerStatsShareFlex({
    gameweek: 3,
    categoryLabel: "ฟอร์มสูงสุด",
    positionLabel: "กองกลาง",
    rows: [{ rank: 1, playerName: "Semenyo", clubName: "Bournemouth", metricValue: 8, photoUrl: "https://example.com/semenyo.png" }],
  });
  const serialized = JSON.stringify(message);

  assert.match(serialized, /ฟอร์มสูงสุด/);
  assert.match(serialized, /กองกลาง/);
  assert.match(serialized, /Semenyo/);
  assert.match(serialized, /Bournemouth/);
});

test("fantasy player-stat share removes the branding header and uses a full-width bubble", () => {
  const message = buildFantasyPlayerStatsShareFlex({
    gameweek: 3,
    categoryLabel: "ฟอร์มสูงสุด",
    positionLabel: "กองกลาง",
    rows: [{ rank: 1, playerName: "Semenyo", clubName: "Bournemouth", metricValue: 8, photoUrl: "https://example.com/semenyo.png" }],
  });
  const contents = message.contents as Record<string, unknown>;

  assert.equal(contents.size, "giga");
  assert.equal("header" in contents, false);
  assert.doesNotMatch(JSON.stringify(contents), /FPL CHEI CHEI/);
});

test("fantasy player-stat rows keep rank, photo and metric fixed while the name fills the middle", () => {
  const message = buildFantasyPlayerStatsShareFlex({
    gameweek: 3,
    categoryLabel: "ฟอร์มสูงสุด",
    positionLabel: "กองกลาง",
    rows: [{ rank: 1, playerName: "Semenyo", clubName: "Bournemouth", metricValue: 8, photoUrl: "https://example.com/semenyo.png" }],
  });
  const contents = message.contents as Record<string, unknown>;
  const body = contents.body as Record<string, unknown>;
  const row = (body.contents as Array<Record<string, unknown>>)[3];
  const rowContents = row.contents as Array<Record<string, unknown>>;

  assert.equal(rowContents[0].flex, 0);
  assert.equal(rowContents[1].flex, 0);
  assert.equal(rowContents[2].flex, 1);
  assert.equal(rowContents[3].flex, 0);
});

test("splits a long player-stat share into Flex-safe bubbles", () => {
  const message = buildFantasyPlayerStatsShareFlex({
    gameweek: 3,
    categoryLabel: "ฟอร์มสูงสุด",
    positionLabel: "ทั้งหมด",
    rows: Array.from({ length: 10 }, (_, index) => ({
      rank: index + 1,
      playerName: `Player ${index + 1}`,
      clubName: "Club",
      metricValue: 10 - index,
      photoUrl: "https://example.com/player.png",
    })),
  });

  validateFlexMessage(message);
  assert.equal((message.contents as { type: string }).type, "carousel");
});

test("builds five squad rows and doubles captain display points", () => {
  const message = buildFantasySquadShareFlex({
    managerName: "Picky",
    managerAvatarUrl: null,
    teamName: "Chei FC",
    squad: fixtureSquad(),
  });
  const serialized = JSON.stringify(message);

  for (const label of ["GK", "กองหลัง", "กองกลาง", "กองหน้า", "ตัวสำรอง"]) {
    assert.match(serialized, new RegExp(label));
  }
  assert.match(serialized, /6 × 2 = 12/);
  assert.match(serialized, /Picky/);
  assert.doesNotMatch(serialized, /entryId|FPL Entry/i);
});

test("fantasy squad share shows the current team total in the profile row", () => {
  const message = buildFantasySquadShareFlex({
    managerName: "Picky",
    managerAvatarUrl: "https://example.com/avatar.png",
    teamName: "Chei FC",
    squad: fixtureSquad(),
  });
  const contents = message.contents as Record<string, unknown>;
  const body = (contents.body ?? {}) as Record<string, unknown>;
  const profileRow = ((body.contents as Array<Record<string, unknown>>)[0] ?? {}) as Record<string, unknown>;

  assert.equal(contents.size, "giga");
  assert.equal("header" in contents, false);
  assert.match(JSON.stringify(profileRow), /คะแนนรวม.*24/);
  assert.match(JSON.stringify(profileRow), /cornerRadius.*xxl/);
});

test("uses LINE-supported sizing properties in the squad share", () => {
  const message = buildFantasySquadShareFlex({
    managerName: "Picky",
    managerAvatarUrl: null,
    teamName: "Chei FC",
    squad: fixtureSquad(),
  });

  validateFlexMessage(message);
  assert.doesNotMatch(JSON.stringify(message), /minWidth/);
});

test("does not put Box-only cornerRadius on leaderboard images", () => {
  const message = buildFantasyLeaderboardShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    rows: [{ rank: 1, managerName: "Picky", teamName: "Chei FC", points: 26, avatarUrl: "https://example.com/avatar.png" }],
  });

  validateFlexMessage(message);
  assert.ok(imageComponents(message).length > 0);
  assert.equal(imageComponents(message).some((image) => "cornerRadius" in image), false);
});
