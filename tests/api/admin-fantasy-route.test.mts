import assert from "node:assert/strict";
import test from "node:test";
import { createAdminFantasyMappingsHandler, createAdminFantasyAwardsHandler, fantasySyncResponseStatus } from "../../lib/api/admin-fantasy-handler.ts";
import type { FantasyRepository } from "../../lib/fantasy/repository.ts";

function repository(): FantasyRepository {
  return {
    getActiveSeason: async () => ({ id: "season-1", name: "2026/27" }),
    getDashboard: async () => ({ season: { id: "season-1", name: "2026/27" }, gameweeks: [{ id: "gw-1", number: 1, name: "GW 1", is_current: true, status: "open" }], mappings: [], scores: [], players: [], globalCaptainPlayerId: null, globalViceCaptainPlayerId: null, awards: [], sync: { lastSyncedAt: null, stale: false, message: null } }),
    listActiveMappings: async () => [],
    listMappings: async () => [],
    createMapping: async (input) => ({ id: "m1", ...input, mapping_status: "active", last_validation_status: "valid", last_error_message: null, linked_at: "now", archived_at: null, created_at: "now", updated_at: "now" }),
    replaceMapping: async () => { throw new Error("not used"); },
    archiveMapping: async () => undefined,
    applySync: async () => ({ jobRunId: "job", scoresUpserted: 0, playersUpserted: 0, mappingsUpdated: 0, failedMappings: [] }),
    replaceAwards: async () => undefined,
  };
}

test("admin mapping validates FPL Entry before persistence", async () => {
  let created = 0;
  const base = repository();
  const handler = createAdminFantasyMappingsHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: { ...base, createMapping: async (input) => { created += 1; return base.createMapping(input); } },
    listUsers: async () => [{ id: "user-1", displayName: "User", status: "active" }],
    provider: { getEntrySummary: async (entryId) => ({ entryId, teamName: "Verified FC", managerName: "Manager" }) },
  });
  const response = await handler(new Request("https://example.test/api/admin/fantasy/mappings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ appUserId: "user-1", fplEntryId: 100 }),
  }));
  assert.equal(response.status, 201);
  assert.equal(created, 1);
  assert.equal((await response.json()).mapping.fpl_team_name, "Verified FC");
});

test("admin mapping rejects non-admin and invalid Entry IDs", async () => {
  const base = repository();
  const handler = createAdminFantasyMappingsHandler({
    requireAdmin: async () => { throw new Error("forbidden"); },
    repository: base,
    listUsers: async () => [],
    provider: { getEntrySummary: async () => ({ entryId: 1, teamName: "FC", managerName: "Manager" }) },
  });
  assert.equal((await handler(new Request("https://example.test/api/admin/fantasy/mappings", { method: "GET" }))).status, 403);

  const invalid = createAdminFantasyMappingsHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: base,
    listUsers: async () => [],
    provider: { getEntrySummary: async () => ({ entryId: 1, teamName: "FC", managerName: "Manager" }) },
  });
  const response = await invalid(new Request("https://example.test/api/admin/fantasy/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appUserId: "user-1", fplEntryId: 0 }) }));
  assert.equal(response.status, 400);
});

test("admin mapping GET exposes league member candidates with badges", async () => {
  const base = repository();
  const response = await createAdminFantasyMappingsHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: {
      ...base,
      listLeagues: async () => [{ id: "league-1", season_id: "season-1", fpl_league_id: 819498, official_name: "Cup", status: "active", archived_at: null }],
      listUnmappedLeagueEntries: async () => [{ fpl_entry_id: 10, fpl_team_name: "Team", fpl_manager_name: "Manager", leagues: [{ id: "league-1", official_name: "Cup" }] }],
      listLeagueEntries: async () => [{ fpl_entry_id: 10, fpl_team_name: "Team", fpl_manager_name: "Manager", leagues: [{ id: "league-1", official_name: "Cup" }] }],
    },
    listUsers: async () => [],
    provider: { getEntrySummary: async (entryId) => ({ entryId, teamName: "Team", managerName: "Manager" }) },
  })(new Request("https://example.test/api/admin/fantasy/mappings", { method: "GET" }));
  const value = await response.json() as { unmappedEntries: Array<{ fpl_entry_id: number; leagues: unknown[] }> };
  assert.equal(response.status, 200);
  assert.equal(value.unmappedEntries[0].fpl_entry_id, 10);
  assert.equal(value.unmappedEntries[0].leagues.length, 1);
});

test("admin awards replace multiple recipients after validating mappings and GW", async () => {
  let awards: unknown;
  const base = repository();
  const handler = createAdminFantasyAwardsHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: { ...base, getDashboard: async () => ({ ...await base.getDashboard({ seasonId: "season-1" }), mappings: [{ id: "m1", season_id: "season-1", app_user_id: "u1", fpl_entry_id: 1, fpl_team_name: "FC", fpl_manager_name: "M", mapping_status: "active", display_name: "U", avatar_url: null }], gameweeks: [{ id: "gw-1", number: 1, name: "GW 1", is_current: true, status: "open" }], scores: [], players: [], awards: [], globalCaptainPlayerId: null, globalViceCaptainPlayerId: null, sync: { lastSyncedAt: null, stale: false, message: null } }), replaceAwards: async (input) => { awards = input; } },
  });
  const response = await handler(new Request("https://example.test/api/admin/fantasy/awards", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ gameweekId: "gw-1", championMappingIds: ["m1"], woodenSpoonMappingIds: [] }) }));
  assert.equal(response.status, 200);
  assert.deepEqual((awards as { awards: unknown[] }).awards, [{ mappingId: "m1", award: "champion" }]);
});

test("admin sync reports a hard bootstrap failure as a non-success response", () => {
  assert.equal(fantasySyncResponseStatus({ currentGameweek: null }), 502);
  assert.equal(fantasySyncResponseStatus({ currentGameweek: 1 }), 200);
});
