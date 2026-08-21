import assert from "node:assert/strict";
import test from "node:test";
import { runFantasySync, type FantasySyncDependencies } from "../../lib/fantasy/sync-service.ts";
import type { FantasyEntryMapping, FantasyRepository } from "../../lib/fantasy/repository.ts";
import type { FantasyFplProvider } from "../../lib/fantasy/types.ts";

function mapping(id: string, entryId: number): FantasyEntryMapping {
  return {
    id,
    season_id: "season-1",
    app_user_id: `user-${id}`,
    fpl_entry_id: entryId,
    fpl_team_name: `Team ${id}`,
    fpl_manager_name: `Manager ${id}`,
    mapping_status: "active",
    last_validation_status: "valid",
    last_error_message: null,
    linked_at: "2026-08-17T00:00:00.000Z",
    archived_at: null,
    created_at: "2026-08-17T00:00:00.000Z",
    updated_at: "2026-08-17T00:00:00.000Z",
  };
}

function dependencies(overrides: Partial<FantasySyncDependencies> = {}): FantasySyncDependencies {
  const provider: FantasyFplProvider = {
    getEntrySummary: async (entryId) => ({ entryId, teamName: "Team", managerName: "Manager" }),
    getEntryHistory: async () => [{ event: 1, points: 72, event_transfers: 2, event_transfers_cost: 4, points_on_bench: 11 }],
    getLeague: async (leagueId) => ({ leagueId, officialName: `League ${leagueId}` }),
    getLeagueMembers: async () => [],
    getBootstrap: async () => ({
      currentGameweek: 1,
      latestFinishedGameweek: 1,
      players: [{ playerId: 1, name: "Player", position: "MID", clubId: 1, clubName: "Club", status: "a", selectedByPercent: 10, transfersInEvent: 20, transfersOutEvent: 2, form: 6 }],
      mostCaptainedPlayerId: 1,
      mostViceCaptainedPlayerId: null,
    }),
  };
  const repository: FantasyRepository = {
    getActiveSeason: async () => ({ id: "season-1", name: "2026/27" }),
    getDashboard: async () => { throw new Error("not used in sync test"); },
    listActiveMappings: async () => [mapping("m1", 100)],
    listMappings: async () => [],
    createMapping: async () => mapping("m1", 100),
    replaceMapping: async () => mapping("m1", 100),
    archiveMapping: async () => undefined,
    applySync: async () => ({ jobRunId: "job-1", scoresUpserted: 1, playersUpserted: 1, mappingsUpdated: 1, failedMappings: [] }),
    replaceAwards: async () => undefined,
  };
  return {
    now: () => new Date("2026-08-17T00:00:00.000Z"),
    seasonId: "season-1",
    gameweeks: [{ id: "gw-1", number: 1 }],
    provider,
    repository,
    createJob: async () => ({ id: "job-1" }),
    finishJob: async () => undefined,
    ...overrides,
  };
}

test("sync fetches bootstrap once and applies normalized scores and player snapshots", async () => {
  let bootstrapCalls = 0;
  let appliedInput: Parameters<NonNullable<FantasySyncDependencies["repository"]>["applySync"]>[0] | undefined;
  const deps = dependencies({
    provider: {
      ...dependencies().provider,
      getBootstrap: async () => {
        bootstrapCalls += 1;
        return dependencies().provider.getBootstrap();
      },
    },
    repository: {
      ...dependencies().repository,
      applySync: async (input) => {
        appliedInput = input;
        return { jobRunId: "job-1", scoresUpserted: 1, playersUpserted: 1, mappingsUpdated: 1, failedMappings: [] };
      },
    },
  });

  const result = await runFantasySync(deps);
  assert.equal(bootstrapCalls, 1);
  assert.equal(appliedInput?.scores[0].points, 72);
  assert.equal(appliedInput?.scores[0].event_transfers_cost, 4);
  assert.equal(appliedInput?.players.length, 1);
  assert.equal(result.stale, false);
  assert.deepEqual(result.failedMappings, []);
});

test("one invalid mapping does not prevent valid mappings from being persisted", async () => {
  const base = dependencies();
  const valid = mapping("m1", 100);
  const invalid = mapping("m2", 200);
  const applied: Array<{ mappingResults: unknown[] }> = [];
  const deps = dependencies({
    repository: {
      ...base.repository,
      listActiveMappings: async () => [valid, invalid],
      applySync: async (input) => {
        applied.push(input);
        return { jobRunId: "job-1", scoresUpserted: 1, playersUpserted: 1, mappingsUpdated: 2, failedMappings: [200] };
      },
    },
    provider: {
      ...base.provider,
      getEntryHistory: async (entryId) => {
        if (entryId === 200) throw new Error("provider detail must not escape");
        return [{ event: 1, points: 72, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0 }];
      },
    },
  });

  const result = await runFantasySync(deps);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].mappingResults.length, 2);
  assert.deepEqual(result.failedMappings, [200]);
  assert.equal(result.stale, true);
});

test("bootstrap failure preserves previous snapshots and marks the run stale", async () => {
  let applied = false;
  let finishedStatus: string | undefined;
  const base = dependencies();
  const result = await runFantasySync(dependencies({
    provider: { ...base.provider, getBootstrap: async () => { throw new Error("upstream body"); } },
    repository: { ...base.repository, applySync: async () => { applied = true; return { jobRunId: "job-1", scoresUpserted: 0, playersUpserted: 0, mappingsUpdated: 0, failedMappings: [] }; } },
    finishJob: async (input) => { finishedStatus = input.status; },
  }));

  assert.equal(applied, false);
  assert.equal(result.stale, true);
  assert.equal(finishedStatus, "failed");
  assert.equal(result.message, "ยังไม่สามารถอัปเดตข้อมูล Fantasy ล่าสุดได้");
});
