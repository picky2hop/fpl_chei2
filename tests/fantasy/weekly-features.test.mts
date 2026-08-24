import assert from "node:assert/strict";
import test from "node:test";
import type { FplBootstrapSnapshot, FplEventLivePlayer } from "../../lib/fantasy/types.ts";
import { loadLatestPlayerOfWeek, loadLatestTeamOfWeek, resolveLatestPlayerOfWeek, resolvePlayerOfWeek, resolveTeamOfWeek } from "../../lib/fantasy/weekly-features.ts";

function fixtureBootstrap(gameweeks: FplBootstrapSnapshot["gameweeks"]): FplBootstrapSnapshot {
  return {
    currentGameweek: gameweeks.find((gameweek) => gameweek.isCurrent)?.number ?? gameweeks[0]?.number ?? 1,
    latestFinishedGameweek: gameweeks.find((gameweek) => gameweek.finished)?.number ?? null,
    gameweeks,
    players: [
      { playerId: 10, name: "Alpha", position: "FWD", clubId: 1, clubName: "Club A", status: "a", selectedByPercent: 10, transfersInEvent: 1, transfersOutEvent: 1, form: 5, photoKey: "10.jpg" },
      { playerId: 11, name: "Bravo", position: "MID", clubId: 1, clubName: "Club A", status: "a", selectedByPercent: 10, transfersInEvent: 1, transfersOutEvent: 1, form: 5, photoKey: "11.jpg" },
      { playerId: 12, name: "Charlie", position: "DEF", clubId: 2, clubName: "Club B", status: "a", selectedByPercent: 10, transfersInEvent: 1, transfersOutEvent: 1, form: 5, photoKey: "12.jpg" },
    ],
    mostCaptainedPlayerId: null,
    mostViceCaptainedPlayerId: null,
  };
}

function currentAndPrevious(): FplBootstrapSnapshot["gameweeks"] {
  return [
    { number: 3, isCurrent: true, finished: false, topPlayerId: 10, topPoints: 18 },
    { number: 2, isCurrent: false, finished: true, topPlayerId: 11, topPoints: 16 },
    { number: 1, isCurrent: false, finished: true, topPlayerId: 12, topPoints: 12 },
  ];
}

function fullBootstrap(): FplBootstrapSnapshot {
  const bootstrap = fixtureBootstrap(currentAndPrevious());
  return {
    ...bootstrap,
    players: Array.from({ length: 11 }, (_, index) => ({
      playerId: index + 1,
      name: `Player ${index + 1}`,
      position: index === 0 ? "GK" as const : index < 5 ? "DEF" as const : index < 9 ? "MID" as const : "FWD" as const,
      clubId: 1,
      clubName: "Club A",
      status: "a",
      selectedByPercent: 10,
      transfersInEvent: 1,
      transfersOutEvent: 1,
      form: 5,
      photoKey: `${index + 1}.jpg`,
    })),
  };
}

function dreamTeam(size: number) {
  return {
    topPlayerId: 1,
    topPoints: 18,
    players: Array.from({ length: size }, (_, index) => ({ playerId: index + 1, points: 18 - index, position: index + 1 })),
  };
}

test("returns every tied Player of the Week", () => {
  const result = resolvePlayerOfWeek({
    bootstrap: fixtureBootstrap(currentAndPrevious()),
    gameweek: 3,
    eventLive: [{ playerId: 10, points: 18 }, { playerId: 11, points: 18 }, { playerId: 12, points: 12 }],
  });

  assert.equal(result?.gameweek, 3);
  assert.equal(result?.topPoints, 18);
  assert.deepEqual(result?.players.map((player) => player.playerId), [10, 11]);
});

test("falls back to the newest valid previous GW", () => {
  const result = resolveLatestPlayerOfWeek({
    bootstrap: fixtureBootstrap(currentAndPrevious()),
    eventLiveByGameweek: new Map<number, FplEventLivePlayer[]>([
      [3, []],
      [2, [{ playerId: 11, points: 16 }]],
    ]),
  });

  assert.equal(result.state, "ready");
  if (result.state === "ready") {
    assert.equal(result.value.gameweek, 2);
    assert.deepEqual(result.value.players.map((player) => player.playerId), [11]);
  }
});

test("returns unavailable when no GW has valid Player of the Week data", () => {
  const result = resolveLatestPlayerOfWeek({
    bootstrap: fixtureBootstrap(currentAndPrevious()),
    eventLiveByGameweek: new Map(),
  });

  assert.deepEqual(result, { state: "unavailable", message: "ยังไม่มีข้อมูล Player of the Week" });
});

test("loads Player of the Week from the newest valid GW", async () => {
  const bootstrap = fixtureBootstrap(currentAndPrevious());
  const result = await loadLatestPlayerOfWeek({
    provider: {
      getBootstrap: async () => bootstrap,
      getEventLive: async (gameweek) => gameweek === 3 ? [] : [{ playerId: 11, points: 16 }],
    },
  });

  assert.equal(result.state, "ready");
  if (result.state === "ready") assert.equal(result.value.gameweek, 2);
});

test("normalizes an official Dream Team into 11 players without inventing a captain", () => {
  const result = resolveTeamOfWeek({ bootstrap: fullBootstrap(), dreamTeam: dreamTeam(11), gameweek: 3 });

  assert.equal(result?.gameweek, 3);
  assert.equal(result?.source, "FPL Official");
  assert.equal(result?.players.length, 11);
  assert.equal(result?.players.some((player) => player.isCaptain), false);
});

test("rejects an incomplete Dream Team so the caller can fallback", () => {
  assert.equal(resolveTeamOfWeek({ bootstrap: fullBootstrap(), dreamTeam: dreamTeam(10), gameweek: 3 }), null);
});

test("loads Team of the Week from the newest valid previous GW", async () => {
  const result = await loadLatestTeamOfWeek({
    provider: {
      getBootstrap: async () => fullBootstrap(),
      getDreamTeam: async (gameweek) => gameweek === 3 ? dreamTeam(10) : dreamTeam(11),
    },
  });

  assert.equal(result.state, "ready");
  if (result.state === "ready") assert.equal(result.value.gameweek, 2);
});
