import assert from "node:assert/strict";
import test from "node:test";
import { createSyncHandler } from "../../lib/api/sync-handler.ts";

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
        affectedGameweekIds: [],
      };
    },
  });

  const response = await handler(new Request("https://example.test/api/sync", { method: "POST" }));

  assert.equal(response.status, 200);
  assert.deepEqual(modes, ["scheduled"]);
});
