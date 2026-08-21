import assert from "node:assert/strict";
import test from "node:test";
import { createAdminFantasyLeagueAwardsHandler } from "../../lib/api/admin-fantasy-handler.ts";
import type { FantasyLeagueRepository, FantasyRepository } from "../../lib/fantasy/repository.ts";

function repository(): FantasyRepository & FantasyLeagueRepository {
  return {
    getActiveSeason: async () => ({ id: "season-1", name: "2026/27" }),
    getDashboard: async () => ({ season: { id: "season-1", name: "2026/27" }, gameweeks: [{ id: "gw-1", number: 1, name: "GW 1", is_current: true, status: "open" }], mappings: [], scores: [], players: [], globalCaptainPlayerId: null, globalViceCaptainPlayerId: null, awards: [], sync: { lastSyncedAt: null, stale: false, message: null } }),
    listActiveMappings: async () => [], listMappings: async () => [],
    createMapping: async (input) => ({ id: "m1", ...input, mapping_status: "active", last_validation_status: "valid", last_error_message: null, linked_at: "now", archived_at: null, created_at: "now", updated_at: "now" }),
    replaceMapping: async () => { throw new Error("not used"); }, archiveMapping: async () => undefined,
    applySync: async () => ({ jobRunId: "job", scoresUpserted: 0, playersUpserted: 0, mappingsUpdated: 0, failedMappings: [] }), replaceAwards: async () => undefined,
    listActiveLeagues: async () => [], listLeagues: async () => [{ id: "league-1", season_id: "season-1", fpl_league_id: 819498, official_name: "Cup", status: "active", archived_at: null }],
    createLeague: async () => { throw new Error("not used"); }, updateLeagueId: async () => { throw new Error("not used"); }, archiveLeague: async () => undefined,
    listLeagueEntries: async () => [],
    listUnmappedLeagueEntries: async () => [], getLeagueDashboard: async () => { throw new Error("not used"); }, applyLeagueSync: async () => ({ jobRunId: "job", leaguesUpserted: 0, membershipsUpserted: 0, scoresUpserted: 0, playersUpserted: 0 }),
    listLeagueEntryIds: async () => [10, 20], replaceLeagueAwards: async () => undefined,
  };
}

test("admin awards accept mapped or unmapped FPL Entry IDs in the selected league", async () => {
  let received: unknown;
  const base = repository();
  const handler = createAdminFantasyLeagueAwardsHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: { ...base, replaceLeagueAwards: async (input) => { received = input; } },
  });
  const response = await handler(new Request("https://example.test/api/admin/fantasy/awards", {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ leagueId: "league-1", gameweekId: "gw-1", championEntryIds: [10], woodenSpoonEntryIds: [20] }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((received as { awards: unknown[] }).awards, [{ fplEntryId: 10, award: "champion" }, { fplEntryId: 20, award: "wooden_spoon" }]);
});

test("admin awards reject an Entry outside the selected league snapshot", async () => {
  const base = repository();
  const handler = createAdminFantasyLeagueAwardsHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: { ...base, listLeagueEntryIds: async () => [10] },
  });
  const response = await handler(new Request("https://example.test/api/admin/fantasy/awards", {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ leagueId: "league-1", gameweekId: "gw-1", championEntryIds: [20], woodenSpoonEntryIds: [] }),
  }));
  assert.equal(response.status, 400);
});
