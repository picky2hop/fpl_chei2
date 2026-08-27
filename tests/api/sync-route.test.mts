import assert from "node:assert/strict";
import test from "node:test";
import { createSyncHandler } from "../../lib/api/sync-handler.ts";
import { SyncFailure } from "../../lib/sync/sync-errors.ts";

test("sync API keeps provider and database failure details private", async () => {
  const handler = createSyncHandler({
    hasSchedulerToken: () => true,
    requireAdmin: async () => ({ id: "admin-1" }),
    sync: async () => {
      const error = new Error("postgres://user:password@internal FPL response body");
      Object.assign(error, { code: "SYNC_DATABASE_ERROR" });
      throw error;
    },
  });

  const response = await handler(new Request("https://example.test/api/sync", { method: "POST" }));

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Sync failed" });
});

test("sync API returns a safe reason for typed provider failures", async () => {
  const handler = createSyncHandler({
    hasSchedulerToken: () => true,
    requireAdmin: async () => ({ id: "admin-1" }),
    sync: async () => {
      throw new SyncFailure("FPL_TIMEOUT", "raw provider secret");
    },
  });

  const response = await handler(new Request("https://example.test/api/sync", { method: "POST" }));
  const body = await response.json() as { error?: string; reason?: string };

  assert.equal(response.status, 502);
  assert.deepEqual(body, { error: "Sync failed", reason: "FPL API ใช้เวลานานเกินกำหนด" });
  assert.doesNotMatch(JSON.stringify(body), /raw provider secret|password/);
});

test("scheduler authentication selects scheduled mode without requiring an admin session", async () => {
  const modes: string[] = [];
  const handler = createSyncHandler({
    hasSchedulerToken: () => true,
    requireAdmin: async () => {
      throw new Error("admin auth must not run");
    },
    sync: async (mode) => {
      modes.push(mode);
      return {
        jobRunId: "job-1",
        teamsUpserted: 20,
        gameweeksUpserted: 38,
        fixturesUpserted: 380,
        movedFixtureIds: [],
        affectedGameweekIds: ["gw-1", "gw-2"],
      };
    },
  });

  const response = await handler(new Request("https://example.test/api/sync", { method: "POST" }));

  assert.equal(response.status, 200);
  assert.deepEqual(modes, ["scheduled"]);
  const body = await response.json() as { message?: string };
  assert.match(body.message ?? "", /fixtures 380/);
  assert.match(body.message ?? "", /2 GW/);
});

test("scheduler authentication routes Fantasy player-stat mode to the separate sync job", async () => {
  const calls: string[] = [];
  const handler = createSyncHandler({
    hasSchedulerToken: () => true,
    requireAdmin: async () => { throw new Error("admin auth must not run"); },
    sync: async () => {
      calls.push("fixtures");
      throw new Error("fixture sync must not run");
    },
    syncFantasyPlayerStats: async () => {
      calls.push("player-stats");
      return { jobRunId: "fantasy-job-1", currentGameweek: 2, playersUpserted: 606, stale: false, message: "player stats ok" };
    },
  });

  const response = await handler(new Request("https://example.test/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "fantasy_player_stats" }),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["player-stats"]);
  assert.deepEqual(await response.json(), { jobRunId: "fantasy-job-1", currentGameweek: 2, playersUpserted: 606, stale: false, message: "player stats ok" });
});
