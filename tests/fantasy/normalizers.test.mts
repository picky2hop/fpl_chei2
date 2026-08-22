import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEntryCurrentSquad, normalizeEntryHistory, normalizePlayerSnapshot } from "../../lib/fantasy/normalizers.ts";
import type { FplBootstrapSnapshot } from "../../lib/fantasy/types.ts";

function player(index: number) {
  return {
    playerId: index,
    name: `Player ${index}`,
    position: index % 4 === 0 ? "GK" as const : index % 4 === 1 ? "DEF" as const : index % 4 === 2 ? "MID" as const : "FWD" as const,
    clubId: index % 2 ? 1 : 2,
    clubName: index % 2 ? "Home" : "Away",
    status: index === 700 ? "u" : "a",
    selectedByPercent: index / 10,
    transfersInEvent: index * 2,
    transfersOutEvent: index,
    form: index / 100,
  };
}

function bootstrapWithPlayers(count: number): FplBootstrapSnapshot {
  return {
    currentGameweek: 1,
    latestFinishedGameweek: null,
    players: Array.from({ length: count }, (_, index) => player(index + 1)),
    mostCaptainedPlayerId: 1,
    mostViceCaptainedPlayerId: 2,
  };
}

test("normalizes every player into a GW snapshot row", () => {
  const rows = normalizePlayerSnapshot({
    seasonId: "season-1",
    gameweekId: "gw-1",
    snapshot: bootstrapWithPlayers(700),
    syncedAt: "2026-08-17T00:00:00.000Z",
  });

  assert.equal(rows.length, 700);
  assert.equal(rows[0].fpl_player_id, 1);
  assert.equal(rows[699].status, "u");
  assert.equal(rows[1].transfers_in_event, 4);
  assert.equal(rows[0].is_global_captain, true);
  assert.equal(rows[1].is_global_vice_captain, true);
});

test("normalizes entry history points without applying transfer cost", () => {
  const rows = normalizeEntryHistory({
    seasonId: "season-1",
    mappingId: "mapping-1",
    gameweekIdByNumber: new Map([[5, "gw-5"]]),
    history: [{ event: 5, points: 72, event_transfers: 2, event_transfers_cost: 4, points_on_bench: 11 }],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });

  assert.deepEqual(rows, [{
    season_id: "season-1",
    mapping_id: "mapping-1",
    gameweek_id: "gw-5",
    points: 72,
    event_transfers: 2,
    event_transfers_cost: 4,
    points_on_bench: 11,
    source_synced_at: "2026-08-17T00:00:00.000Z",
  }]);
});

test("normalizes current Entry picks into starters, bench, and captain metadata", () => {
  const squad = normalizeEntryCurrentSquad({
    gameweekNumber: 3,
    picks: [
      { pickPosition: 1, playerId: 1, playerName: "Keeper", position: "GK", clubName: "Club A", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 6 },
      { pickPosition: 2, playerId: 2, playerName: "Defender 1", position: "DEF", clubName: "Club A", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 2 },
      { pickPosition: 3, playerId: 3, playerName: "Defender 2", position: "DEF", clubName: "Club B", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 8 },
      { pickPosition: 4, playerId: 4, playerName: "Defender 3", position: "DEF", clubName: "Club C", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 1 },
      { pickPosition: 5, playerId: 5, playerName: "Midfielder 1", position: "MID", clubName: "Club A", multiplier: 2, isCaptain: true, isViceCaptain: false, points: 12 },
      { pickPosition: 6, playerId: 6, playerName: "Midfielder 2", position: "MID", clubName: "Club B", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 4 },
      { pickPosition: 7, playerId: 7, playerName: "Midfielder 3", position: "MID", clubName: "Club C", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 5 },
      { pickPosition: 8, playerId: 8, playerName: "Midfielder 4", position: "MID", clubName: "Club D", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 3 },
      { pickPosition: 9, playerId: 9, playerName: "Forward 1", position: "FWD", clubName: "Club A", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 9 },
      { pickPosition: 10, playerId: 10, playerName: "Forward 2", position: "FWD", clubName: "Club B", multiplier: 1, isCaptain: false, isViceCaptain: true, points: 7 },
      { pickPosition: 11, playerId: 11, playerName: "Forward 3", position: "FWD", clubName: "Club C", multiplier: 1, isCaptain: false, isViceCaptain: false, points: 2 },
      { pickPosition: 12, playerId: 12, playerName: "Bench Keeper", position: "GK", clubName: "Club D", multiplier: 0, isCaptain: false, isViceCaptain: false, points: 1 },
      { pickPosition: 13, playerId: 13, playerName: "Bench Defender", position: "DEF", clubName: "Club D", multiplier: 0, isCaptain: false, isViceCaptain: false, points: 0 },
      { pickPosition: 14, playerId: 14, playerName: "Bench Midfielder", position: "MID", clubName: "Club E", multiplier: 0, isCaptain: false, isViceCaptain: false, points: 2 },
      { pickPosition: 15, playerId: 15, playerName: "Bench Forward", position: "FWD", clubName: "Club E", multiplier: 0, isCaptain: false, isViceCaptain: false, points: 1 },
    ],
  });

  assert.equal(squad.gameweekNumber, 3);
  assert.equal(squad.formation, "3-4-3");
  assert.equal(squad.captainPlayerId, 5);
  assert.equal(squad.viceCaptainPlayerId, 10);
  assert.deepEqual(squad.starters.map((player) => player.playerId), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(squad.bench.map((player) => player.playerId), [12, 13, 14, 15]);
  assert.equal(squad.starters[4].multiplier, 2);
});

test("does not create a score row when FPL returns an unknown gameweek", () => {
  const rows = normalizeEntryHistory({
    seasonId: "season-1",
    mappingId: "mapping-1",
    gameweekIdByNumber: new Map([[5, "gw-5"]]),
    history: [{ event: 6, points: 10, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0 }],
    syncedAt: "2026-08-17T00:00:00.000Z",
  });

  assert.deepEqual(rows, []);
});
