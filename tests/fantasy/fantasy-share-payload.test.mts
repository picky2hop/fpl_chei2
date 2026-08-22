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
