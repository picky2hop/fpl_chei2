import assert from "node:assert/strict";
import test from "node:test";
import type { FplSnapshot } from "../../lib/sync/fpl-core.ts";
import { SyncFailure } from "../../lib/sync/sync-errors.ts";
import { runFplSync, type SyncRunnerDependencies } from "../../lib/sync/sync-runner.ts";

const snapshot: FplSnapshot = {
  teams: [
    { id: 1, name: "Home", short_name: "HOM", code: 101 },
    { id: 2, name: "Away", short_name: "AWY", code: 102 },
  ],
  events: [{ id: 1, name: "Gameweek 1", is_current: true }],
  fixtures: [{
    id: 1,
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

function createDependencies(overrides: Partial<SyncRunnerDependencies> = {}) {
  const calls: Array<{ operation: string; input: unknown }> = [];
  const dependencies: SyncRunnerDependencies = {
    now: () => new Date("2026-08-02T10:00:00.000Z"),
    createRunId: () => "run-1",
    createJob: async (input) => {
      calls.push({ operation: "createJob", input });
      return { id: "job-1" };
    },
    fetchSnapshot: async () => {
      calls.push({ operation: "fetchSnapshot", input: null });
      return snapshot;
    },
    applySnapshot: async (input) => {
      calls.push({ operation: "applySnapshot", input });
      return {
        jobRunId: input.jobRunId,
        teamsUpserted: 2,
        gameweeksUpserted: 1,
        fixturesUpserted: 1,
        movedFixtureIds: [],
        affectedGameweekIds: [],
      };
    },
    failJob: async (input) => {
      calls.push({ operation: "failJob", input });
    },
    ...overrides,
  };
  return { calls, dependencies };
}

test("starts an audit job before fetching and applies the snapshot atomically once", async () => {
  const { calls, dependencies } = createDependencies();

  const result = await runFplSync("scheduled", dependencies);

  assert.deepEqual(calls.map((call) => call.operation), ["createJob", "fetchSnapshot", "applySnapshot"]);
  assert.deepEqual(calls[0]?.input, {
    idempotencyKey: "fpl:scheduled:run-1",
    mode: "scheduled",
    startedAt: "2026-08-02T10:00:00.000Z",
  });
  assert.deepEqual(calls[2]?.input, {
    jobRunId: "job-1",
    snapshot,
    syncedAt: "2026-08-02T10:00:00.000Z",
  });
  assert.equal(result.fixturesUpserted, 1);
});

test("records an allow-listed provider failure without attempting persistence", async () => {
  const { calls, dependencies } = createDependencies({
    fetchSnapshot: async () => {
      throw new SyncFailure("FPL_HTTP_403", "FPL source request failed", { providerStatus: 403 });
    },
  });

  await assert.rejects(() => runFplSync("scheduled", dependencies), { code: "FPL_HTTP_403" });

  assert.deepEqual(calls.map((call) => call.operation), ["createJob", "failJob"]);
  assert.deepEqual(calls[1]?.input, {
    jobRunId: "job-1",
    finishedAt: "2026-08-02T10:00:00.000Z",
    code: "FPL_HTTP_403",
    message: "FPL source request failed",
    details: { providerStatus: 403 },
  });
});

test("sanitizes an unexpected database error before recording job failure", async () => {
  const { calls, dependencies } = createDependencies({
    applySnapshot: async () => {
      throw new Error("postgres://user:password@internal-host secret table detail");
    },
  });

  await assert.rejects(() => runFplSync("manual", dependencies), { code: "SYNC_DATABASE_ERROR" });

  const failure = calls.find((call) => call.operation === "failJob")?.input;
  assert.deepEqual(failure, {
    jobRunId: "job-1",
    finishedAt: "2026-08-02T10:00:00.000Z",
    code: "SYNC_DATABASE_ERROR",
    message: "Sync database operation failed",
    details: {},
  });
  assert.doesNotMatch(JSON.stringify(failure), /password|internal-host|secret table/);
});

test("uses a distinct audit attempt id while safely applying the same snapshot twice", async () => {
  let runNumber = 0;
  const appliedFixtureIds = new Set<number>();
  const jobs: string[] = [];
  const fullSeasonSnapshot: FplSnapshot = {
    ...snapshot,
    fixtures: Array.from({ length: 380 }, (_, index) => ({
      ...snapshot.fixtures[0],
      id: index + 1,
    })),
  };
  const { dependencies } = createDependencies({
    createRunId: () => `run-${++runNumber}`,
    createJob: async (input) => {
      jobs.push(input.idempotencyKey);
      return { id: `job-${runNumber}` };
    },
    fetchSnapshot: async () => fullSeasonSnapshot,
    applySnapshot: async (input) => {
      for (const fixture of input.snapshot.fixtures) appliedFixtureIds.add(fixture.id);
      return {
        jobRunId: input.jobRunId,
        teamsUpserted: input.snapshot.teams.length,
        gameweeksUpserted: input.snapshot.events.length,
        fixturesUpserted: input.snapshot.fixtures.length,
        movedFixtureIds: [],
        affectedGameweekIds: [],
      };
    },
  });

  await runFplSync("scheduled", dependencies);
  await runFplSync("scheduled", dependencies);

  assert.deepEqual(jobs, ["fpl:scheduled:run-1", "fpl:scheduled:run-2"]);
  assert.equal(appliedFixtureIds.size, 380);
});
