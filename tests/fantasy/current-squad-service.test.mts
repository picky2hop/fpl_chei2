import assert from "node:assert/strict";
import test from "node:test";
import { loadCurrentSquad } from "../../lib/fantasy/current-squad-service.ts";

const squad = {
  gameweekNumber: 3,
  formation: "3-4-3",
  captainPlayerId: 5,
  viceCaptainPlayerId: 9,
  starters: [],
  bench: [],
};

test("current squad service refreshes the stored snapshot for the same GW", async () => {
  let providerCalls = 0;
  let writes = 0;
  const refreshedSquad = { ...squad, formation: "4-4-2" };
  const result = await loadCurrentSquad({
    seasonId: "season-1",
    entryId: 123,
    gameweekId: "gw-3",
    gameweekNumber: 3,
    now: "2026-08-22T00:00:00.000Z",
    repository: {
      getCurrentSquad: async () => ({ ...squad, gameweekId: "gw-3", sourceSyncedAt: "2026-08-21T00:00:00.000Z" }),
      upsertCurrentSquad: async () => { writes += 1; },
    },
    provider: {
      getEntryPicks: async () => { providerCalls += 1; return refreshedSquad; },
    },
  });

  assert.equal(providerCalls, 1);
  assert.equal(writes, 1);
  assert.deepEqual(result, { entryId: 123, squad: refreshedSquad, cached: false, sourceSyncedAt: "2026-08-22T00:00:00.000Z" });
});

test("current squad service fetches and replaces the snapshot when GW changes", async () => {
  const writes: unknown[] = [];
  const nextSquad = { ...squad, gameweekNumber: 4 };
  const result = await loadCurrentSquad({
    seasonId: "season-1",
    entryId: 123,
    gameweekId: "gw-4",
    gameweekNumber: 4,
    now: "2026-08-29T00:00:00.000Z",
    repository: {
      getCurrentSquad: async () => ({ ...squad, gameweekId: "gw-3", sourceSyncedAt: "2026-08-21T00:00:00.000Z" }),
      upsertCurrentSquad: async (input) => { writes.push(input); },
    },
    provider: { getEntryPicks: async () => nextSquad },
  });

  assert.deepEqual(writes, [{
    seasonId: "season-1",
    entryId: 123,
    gameweekId: "gw-4",
    squad: nextSquad,
    syncedAt: "2026-08-29T00:00:00.000Z",
  }]);
  assert.deepEqual(result, { entryId: 123, squad: nextSquad, cached: false, sourceSyncedAt: "2026-08-29T00:00:00.000Z" });
});

test("current squad service falls back to a same-GW snapshot when FPL refresh fails", async () => {
  let writes = 0;
  const result = await loadCurrentSquad({
    seasonId: "season-1",
    entryId: 123,
    gameweekId: "gw-3",
    gameweekNumber: 3,
    now: "2026-08-22T00:00:00.000Z",
    repository: {
      getCurrentSquad: async () => ({ ...squad, gameweekId: "gw-3", sourceSyncedAt: "2026-08-21T00:00:00.000Z" }),
      upsertCurrentSquad: async () => { writes += 1; },
    },
    provider: { getEntryPicks: async () => { throw new Error("FPL unavailable"); } },
  });

  assert.equal(writes, 0);
  assert.deepEqual(result, { entryId: 123, squad, cached: true, sourceSyncedAt: "2026-08-21T00:00:00.000Z" });
});
