import assert from "node:assert/strict";
import test from "node:test";
import {
  assertActiveMappingUniqueness,
  buildPlayerSnapshotRows,
  createFantasyRepository,
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

test("upserts one current squad snapshot per Entry and replaces the previous GW", async () => {
  const calls: Array<{ rows: unknown; options: unknown }> = [];
  const client = {
    from(table: string) {
      assert.equal(table, "fantasy_entry_current_squads");
      return {
        upsert(rows: unknown, options: unknown) {
          calls.push({ rows, options });
          return Promise.resolve({ error: null });
        },
      };
    },
  } as never;
  const repository = createFantasyRepository(client);
  const squad = {
    gameweekNumber: 3,
    formation: "3-4-3",
    captainPlayerId: 5,
    viceCaptainPlayerId: 9,
    starters: [],
    bench: [],
  };

  await repository.upsertCurrentSquad!({
    seasonId: "s1",
    entryId: 123,
    gameweekId: "gw-3",
    squad,
    syncedAt: "2026-08-22T00:00:00.000Z",
  });

  assert.deepEqual(calls, [{
    rows: [{
      season_id: "s1",
      fpl_entry_id: 123,
      gameweek_id: "gw-3",
      gameweek_number: 3,
      squad,
      source_synced_at: "2026-08-22T00:00:00.000Z",
    }],
    options: { onConflict: "season_id,fpl_entry_id" },
  }]);
});

test("current league Entry context uses the current membership snapshot", async () => {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        order() {
          return Promise.resolve({
            data: table === "gameweeks"
              ? [{ id: "gw-3", number: 3, is_current: true, status: "open" }]
              : undefined,
            error: null,
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: { fpl_entry_id: 123 }, error: null });
        },
      };
      return chain;
    },
  } as never;
  const repository = createFantasyRepository(client);

  assert.deepEqual(await repository.getCurrentLeagueEntry!({ seasonId: "s1", leagueId: "league-1", entryId: 123 }), {
    gameweekId: "gw-3",
    gameweekNumber: 3,
  });
  assert.deepEqual(calls, ["gameweeks", "fantasy_league_membership_snapshots"]);
});
