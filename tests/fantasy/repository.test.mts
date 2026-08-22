import assert from "node:assert/strict";
import test from "node:test";
import {
  assertActiveMappingUniqueness,
  buildPlayerSnapshotRows,
  uniqueSnapshotKeys,
} from "../../lib/fantasy/repository.ts";

const players = (count: number, formDelta = 0) => Array.from({ length: count }, (_, index) => ({
  playerId: index + 1,
  name: `Player ${index + 1}`,
  position: index % 4 === 0 ? "GK" as const : "MID" as const,
  clubId: (index % 2) + 1,
  clubName: index % 2 === 0 ? "Home" : "Away",
  status: "a",
  selectedByPercent: 10 + formDelta,
  transfersInEvent: 100,
  transfersOutEvent: 20,
  form: 6 + formDelta,
}));

test("same-GW player sync upserts identity while a different GW adds snapshots", () => {
  const first = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw1", players: players(700) });
  const sameGw = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw1", players: players(700, 1) });
  const nextGw = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw2", players: players(700) });

  assert.equal(first.length, 700);
  assert.equal(uniqueSnapshotKeys([...first, ...sameGw]).size, 700);
  assert.equal(uniqueSnapshotKeys([...first, ...nextGw]).size, 1400);
});

test("allows one active LINE user to map multiple FPL Entries", () => {
  assert.doesNotThrow(() => assertActiveMappingUniqueness([
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "active" },
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 101, mapping_status: "active" },
  ]));
});

test("active mapping identity cannot duplicate an FPL entry", () => {
  assert.doesNotThrow(() => assertActiveMappingUniqueness([
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "active" },
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "archived" },
    { season_id: "s1", app_user_id: "u2", fpl_entry_id: 101, mapping_status: "active" },
  ]));

  assert.throws(() => assertActiveMappingUniqueness([
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "active" },
    { season_id: "s1", app_user_id: "u2", fpl_entry_id: 100, mapping_status: "active" },
  ]), /active mapping already exists for FPL entry/);
});
