import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEntryHistory, normalizePlayerSnapshot } from "../../lib/fantasy/normalizers.ts";
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
