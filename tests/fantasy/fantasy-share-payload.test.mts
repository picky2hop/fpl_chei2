import assert from "node:assert/strict";
import test from "node:test";
import { validateFlexMessage } from "../../lib/line/flex.ts";
import { buildFantasyLeaderboardShareFlex, buildFantasyLeaderboardTopBottomShareFlex, buildFantasyPlayerStatsShareFlex, buildFantasySquadShareFlex, buildFantasyTeamOfWeekShareFlex } from "../../lib/fantasy/fantasy-share-payload.ts";

function player(input: Partial<{
  pickPosition: number;
  playerId: number;
  playerName: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  clubName: string;
  clubShortName: string;
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

function firstShareRow(message: unknown): Record<string, unknown> {
  const contents = (message as { contents: Record<string, unknown> }).contents;
  const body = contents.body as Record<string, unknown>;
  const bodyContents = body.contents as Array<Record<string, unknown>>;
  const candidate = bodyContents[3];
  const candidateContents = candidate.contents as Array<Record<string, unknown>>;
  return candidateContents[0]?.type === "box" && candidateContents[0]?.layout === "horizontal" ? candidateContents[0] : candidate;
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

test("adds the approved share timestamp to leaderboard Flex", () => {
  const message = buildFantasyLeaderboardShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    rows: [],
    sharedAt: "แชร์เมื่อ 24/08/2569 21:45 น.",
  });

  assert.match(JSON.stringify(message), /แชร์เมื่อ 24\/08\/2569 21:45 น\./);
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
  const rowContents = firstShareRow(message).contents as Array<Record<string, unknown>>;

  assert.equal(rowContents[0].flex, 0);
  assert.equal(rowContents[1].width, "12px");
  assert.equal(rowContents[1].flex, 0);
  assert.equal(rowContents[2].flex, 0);
  assert.equal(rowContents[3].width, "12px");
  assert.equal(rowContents[3].flex, 0);
  assert.equal(rowContents[4].flex, 1);
  assert.equal(rowContents[5].flex, 0);
});

test("keeps a fitting fantasy leaderboard in one bubble with a nested rows container", () => {
  const message = buildFantasyLeaderboardShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    rows: [
      { rank: 1, managerName: "Picky", teamName: "Chei FC", points: 26, avatarUrl: null },
      { rank: 2, managerName: "Nim", teamName: "Nim FC", points: 24, avatarUrl: null },
    ],
  });
  const contents = message.contents as Record<string, unknown>;
  const body = contents.body as Record<string, unknown>;
  const rowsContainer = (body.contents as Array<Record<string, unknown>>)[3];

  assert.equal(contents.type, "bubble");
  assert.equal(rowsContainer.type, "box");
  assert.equal(rowsContainer.layout, "vertical");
  assert.match(JSON.stringify(message), /Picky/);
  assert.match(JSON.stringify(message), /Nim/);
});

test("falls back to a valid carousel when all leaderboard rows do not fit one bubble", () => {
  const rows = Array.from({ length: 13 }, (_, index) => ({
    rank: index + 1,
    managerName: `Manager ${index + 1}`,
    teamName: `Team ${index + 1}`,
    points: 30 - index,
    avatarUrl: null,
  }));
  const message = buildFantasyLeaderboardShareFlex({ leagueName: "เชยเชย Cup", gameweek: 3, period: "gameweek", rows });
  const contents = message.contents as Record<string, unknown>;
  const bubbles = Array.isArray(contents.contents) ? contents.contents as Array<Record<string, unknown>> : [];

  validateFlexMessage(message);
  assert.equal(contents.type, "carousel");
  assert.ok(bubbles.every((item) => ((item.body as Record<string, unknown>).contents as Array<Record<string, unknown>>)[3]?.layout === "vertical"));
  for (const row of rows) assert.match(JSON.stringify(message), new RegExp(row.managerName));
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
    rows: [{ rank: 1, position: "MID", playerName: "Semenyo", clubName: "Bournemouth", metricValue: 8, photoUrl: "https://example.com/semenyo.png" }],
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
    rows: [{ rank: 1, position: "MID", playerName: "Semenyo", clubName: "Bournemouth", metricValue: 8, photoUrl: "https://example.com/semenyo.png" }],
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
    rows: [{ rank: 1, position: "MID", playerName: "Semenyo", clubName: "Bournemouth", metricValue: 8, photoUrl: "https://example.com/semenyo.png" }],
  });
  const rowContents = firstShareRow(message).contents as Array<Record<string, unknown>>;

  assert.equal(rowContents[0].flex, 0);
  assert.equal(rowContents[1].width, "12px");
  assert.equal(rowContents[1].flex, 0);
  assert.equal(rowContents[2].flex, 0);
  assert.equal(rowContents[3].width, "12px");
  assert.equal(rowContents[3].flex, 0);
  assert.equal(rowContents[4].flex, 1);
  assert.equal(rowContents[5].flex, 0);
});

test("uses a football fallback when a player photo is unavailable", () => {
  const message = buildFantasyPlayerStatsShareFlex({
    gameweek: 3,
    categoryLabel: "ฟอร์มสูงสุด",
    positionLabel: "กองกลาง",
    rows: [{ rank: 1, position: "MID", playerName: "Unknown Player", clubName: "Unknown FC", metricValue: 8 }],
  });

  assert.match(JSON.stringify(message), /⚽/);
});

test("shares all player positions as four ordered bubbles", () => {
  const message = buildFantasyPlayerStatsShareFlex({
    gameweek: 3,
    categoryLabel: "ฟอร์มสูงสุด",
    positionLabel: "ทั้งหมด",
    rows: [
      { rank: 1, position: "GK", playerName: "Goalkeeper", clubName: "Club", metricValue: 4 },
      { rank: 1, position: "FWD", playerName: "Forward", clubName: "Club", metricValue: 10 },
      { rank: 1, position: "DEF", playerName: "Defender", clubName: "Club", metricValue: 6 },
      { rank: 1, position: "MID", playerName: "Midfielder", clubName: "Club", metricValue: 8 },
    ],
    sharedAt: "แชร์เมื่อ 24/08/2569 21:45 น.",
  });

  validateFlexMessage(message);
  const contents = message.contents as Record<string, unknown>;
  const bubbles = Array.isArray(contents.contents) ? contents.contents as Array<Record<string, unknown>> : [];
  const labels = bubbles.map((item) => {
    const body = item.body as Record<string, unknown>;
    const positionText = ((body.contents as Array<Record<string, unknown>>)[2] ?? {}).text;
    return positionText;
  });

  assert.equal(contents.type, "carousel");
  assert.deepEqual(labels, ["ตำแหน่ง: กองหน้า", "ตำแหน่ง: กองกลาง", "ตำแหน่ง: กองหลัง", "ตำแหน่ง: GK"]);
  assert.equal(JSON.stringify(message).split("แชร์เมื่อ 24/08/2569 21:45 น.").length - 1, 4);
});

test("shares one selected player position as one bubble", () => {
  const message = buildFantasyPlayerStatsShareFlex({
    gameweek: 3,
    categoryLabel: "ฟอร์มสูงสุด",
    positionLabel: "กองกลาง",
    rows: Array.from({ length: 9 }, (_, index) => ({
      rank: index + 1,
      position: "MID" as const,
      playerName: `Midfielder ${index + 1}`,
      clubName: "Club",
      metricValue: 10 - index,
    })),
  });

  validateFlexMessage(message);
  assert.equal((message.contents as { type: string }).type, "bubble");
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

test("shows club short name, squad total, and Team of the Week total", () => {
  const squad = fixtureSquad();
  squad.starters[1].clubShortName = "ARS";
  const squadMessage = buildFantasySquadShareFlex({
    managerName: "Picky",
    managerAvatarUrl: null,
    teamName: "Chei FC",
    squad,
    sharedAt: "แชร์เมื่อ 24/08/2569 21:45 น.",
  });
  const teamMessage = buildFantasyTeamOfWeekShareFlex({
    gameweek: 3,
    players: [player({ playerId: 20, playerName: "Semenyo", position: "FWD", clubShortName: "BOU", points: 9 })],
    sharedAt: "แชร์เมื่อ 24/08/2569 21:45 น.",
  });

  assert.match(JSON.stringify(squadMessage), /Semenyo.*ARS.*6/);
  assert.match(JSON.stringify(squadMessage), /คะแนนรวม.*24/);
  assert.match(JSON.stringify(teamMessage), /Semenyo.*BOU.*9/);
  assert.match(JSON.stringify(teamMessage), /คะแนนรวม.*9/);
  assert.match(JSON.stringify(teamMessage), /แชร์เมื่อ 24\/08\/2569 21:45 น\./);
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

test("builds Top/Bottom share as exactly two bubbles", () => {
  const message = buildFantasyLeaderboardTopBottomShareFlex({
    leagueName: "เชยเชย Cup",
    gameweek: 3,
    period: "gameweek",
    topRows: [{ rank: 1, managerName: "Top", teamName: "Top FC", points: 30, avatarUrl: null }],
    bottomRows: [{ rank: 20, managerName: "Bottom", teamName: "Bottom FC", points: 1, avatarUrl: null }],
  });
  validateFlexMessage(message);
  const contents = message.contents as { type: string; contents: unknown[] };
  assert.equal(contents.type, "carousel");
  assert.equal(contents.contents.length, 2);
});

test("marks Player of the Week in squad and Team of the Week shares", () => {
  const squadMessage = buildFantasySquadShareFlex({
    managerName: "Picky",
    managerAvatarUrl: null,
    teamName: "Chei FC",
    squad: fixtureSquad(),
    highlightPlayerIds: new Set([2]),
  });
  const teamMessage = buildFantasyTeamOfWeekShareFlex({ gameweek: 3, players: fixtureSquad().starters, highlightPlayerIds: new Set([2]) });
  assert.match(JSON.stringify(squadMessage), /Player of the Week/);
  assert.match(JSON.stringify(teamMessage), /Player of the Week/);
});
