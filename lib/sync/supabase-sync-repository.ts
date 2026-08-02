import type { SyncResult } from "./sync-runner.ts";
import { SyncFailure } from "./sync-errors.ts";

export type AtomicSyncClient = {
  rpc: (
    name: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function isSyncResult(value: unknown): value is SyncResult {
  return typeof value === "object"
    && value !== null
    && "jobRunId" in value
    && typeof value.jobRunId === "string"
    && "teamsUpserted" in value
    && typeof value.teamsUpserted === "number"
    && "gameweeksUpserted" in value
    && typeof value.gameweeksUpserted === "number"
    && "fixturesUpserted" in value
    && typeof value.fixturesUpserted === "number"
    && "movedFixtureIds" in value
    && Array.isArray(value.movedFixtureIds)
    && value.movedFixtureIds.every((id) => typeof id === "string")
    && "affectedGameweekIds" in value
    && Array.isArray(value.affectedGameweekIds)
    && value.affectedGameweekIds.every((id) => typeof id === "string");
}

export function createSupabaseSyncRepository(client: AtomicSyncClient) {
  return {
    async applySnapshot(input: {
      jobRunId: string;
      snapshot: Parameters<import("./sync-runner.ts").SyncRunnerDependencies["applySnapshot"]>[0]["snapshot"];
      syncedAt: string;
    }): Promise<SyncResult> {
      const { data, error } = await client.rpc("apply_fpl_sync", {
        p_job_run_id: input.jobRunId,
        p_synced_at: input.syncedAt,
        p_teams: input.snapshot.teams,
        p_gameweeks: input.snapshot.events,
        p_fixtures: input.snapshot.fixtures,
      });
      if (error || !isSyncResult(data)) {
        throw new SyncFailure("SYNC_DATABASE_ERROR", "Sync database operation failed");
      }
      return data;
    },
  };
}
