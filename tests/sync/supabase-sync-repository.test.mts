import assert from "node:assert/strict";
import test from "node:test";
import type { FplSnapshot } from "../../lib/sync/fpl-core.ts";
import { createSupabaseSyncRepository } from "../../lib/sync/supabase-sync-repository.ts";

const snapshot: FplSnapshot = {
  teams: [
    { id: 1, name: "Home", short_name: "HOM", code: 101 },
    { id: 2, name: "Away", short_name: "AWY", code: 102 },
  ],
  events: [{ id: 1, name: "Gameweek 1", is_current: true }],
  fixtures: [{
    id: 8,
    event: 1,
    kickoff_time: "2026-08-15T12:00:00Z",
    team_h: 1,
    team_a: 2,
    team_h_score: null,
    team_a_score: null,
    started: false,
    finished: false,
    finished_provisional: false,
    postponed: false,
  }],
};

test("applies a validated snapshot through exactly one atomic RPC", async () => {
  const calls: Array<{ name: string; params: unknown }> = [];
  const client = {
    rpc: async (name: string, params: unknown) => {
      calls.push({ name, params });
      return {
        data: {
          jobRunId: "job-1",
          teamsUpserted: 2,
          gameweeksUpserted: 1,
          fixturesUpserted: 1,
          movedFixtureIds: [],
          affectedGameweekIds: [],
        },
        error: null,
      };
    },
  };
  const repository = createSupabaseSyncRepository(client);

  const result = await repository.applySnapshot({
    jobRunId: "job-1",
    snapshot,
    syncedAt: "2026-08-02T10:00:00.000Z",
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    name: "apply_fpl_sync",
    params: {
      p_job_run_id: "job-1",
      p_synced_at: "2026-08-02T10:00:00.000Z",
      p_teams: snapshot.teams,
      p_gameweeks: snapshot.events,
      p_fixtures: snapshot.fixtures,
    },
  });
  assert.equal(result.fixturesUpserted, 1);
});

test("converts an RPC failure to a safe database failure", async () => {
  const repository = createSupabaseSyncRepository({
    rpc: async () => ({ data: null, error: { message: "database password and internal SQL" } }),
  });

  await assert.rejects(
    () => repository.applySnapshot({
      jobRunId: "job-1",
      snapshot,
      syncedAt: "2026-08-02T10:00:00.000Z",
    }),
    (error: unknown) => error instanceof Error
      && "code" in error
      && error.code === "SYNC_DATABASE_ERROR"
      && !error.message.includes("password")
      && !error.message.includes("internal SQL"),
  );
});
