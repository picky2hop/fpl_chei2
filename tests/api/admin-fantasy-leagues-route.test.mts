import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminFantasyLeagueArchiveHandler,
  createAdminFantasyLeaguePatchHandler,
  createAdminFantasyLeaguesHandler,
} from "../../lib/api/admin-fantasy-leagues-handler.ts";
import type { FantasyLeagueRepository, FantasyRepository } from "../../lib/fantasy/repository.ts";

function baseRepository(): FantasyRepository & FantasyLeagueRepository {
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
    listActiveLeagues: async () => [],
    listLeagues: async () => [],
    createLeague: async (input) => ({ id: "league-1", ...input, status: "active", archived_at: null }),
    updateLeagueId: async (id, input) => ({ id, season_id: "season-1", ...input, status: "active", archived_at: null }),
    archiveLeague: async () => undefined,
    listLeagueEntries: async () => [],
    listUnmappedLeagueEntries: async () => [],
    listLeagueEntryIds: async () => [],
    replaceLeagueAwards: async () => undefined,
    getLeagueDashboard: async () => { throw new Error("not used"); },
    applyLeagueSync: async () => ({ jobRunId: "job", leaguesUpserted: 0, membershipsUpserted: 0, scoresUpserted: 0, playersUpserted: 0 }),
  };
}

function provider() {
  return {
    getLeague: async (fplLeagueId: number) => ({ leagueId: fplLeagueId, officialName: "Official League" }),
    getLeagueMembers: async () => [{ entryId: 10, teamName: "Team", managerName: "Manager", rank: 1 }],
  };
}

test("admin can add a league only after official FPL validation", async () => {
  let createdInput: unknown;
  const repository = baseRepository();
  const handler = createAdminFantasyLeaguesHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: { ...repository, createLeague: async (input) => { createdInput = input; return repository.createLeague(input); } },
    provider: provider(),
  });
  const response = await handler(new Request("https://example.test/api/admin/fantasy/leagues", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fplLeagueId: 819498 }),
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(createdInput, { season_id: "season-1", fpl_league_id: 819498, official_name: "Official League" });
});

test("admin league PATCH preserves the previous configuration when FPL validation fails", async () => {
  let updated = false;
  const repository = baseRepository();
  const handler = createAdminFantasyLeaguePatchHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: { ...repository, updateLeagueId: async () => { updated = true; throw new Error("should not write"); } },
    provider: { ...provider(), getLeague: async () => { throw new Error("FPL failure"); } },
  }, "league-1");
  const response = await handler(new Request("https://example.test/api/admin/fantasy/leagues/league-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fplLeagueId: 819502 }),
  }));
  assert.equal(response.status, 409);
  assert.equal(updated, false);
});

test("admin can archive a league", async () => {
  let archivedId = "";
  const repository = baseRepository();
  const handler = createAdminFantasyLeagueArchiveHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: { ...repository, archiveLeague: async (id) => { archivedId = id; } },
  }, "league-1");
  const response = await handler();
  assert.equal(response.status, 204);
  assert.equal(archivedId, "league-1");
});

test("mapping GET returns deduplicated unmapped Entries with both league badges", async () => {
  const repository = baseRepository();
  const handler = createAdminFantasyLeaguesHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    repository: {
      ...repository,
      listLeagues: async () => [
        { id: "league-1", season_id: "season-1", fpl_league_id: 819498, official_name: "Cup", status: "active", archived_at: null },
        { id: "league-2", season_id: "season-1", fpl_league_id: 819502, official_name: "Love", status: "active", archived_at: null },
      ],
    },
    provider: provider(),
  });
  const response = await handler(new Request("https://example.test/api/admin/fantasy/leagues", { method: "GET" }));
  assert.equal(response.status, 200);
  const value = await response.json() as { leagues: unknown[] };
  assert.equal(value.leagues.length, 2);
});
