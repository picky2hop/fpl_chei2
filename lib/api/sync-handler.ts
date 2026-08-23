import type { SyncMode, SyncResult } from "../sync/sync-runner.ts";
import { safeSyncFailureReason, SyncFailure } from "../sync/sync-errors.ts";

export type SyncHandlerDependencies = {
  hasSchedulerToken: (request: Request) => boolean;
  requireAdmin: () => Promise<unknown>;
  sync: (mode: SyncMode) => Promise<SyncResult>;
};

export function createSyncHandler(dependencies: SyncHandlerDependencies) {
  return async function handler(request: Request): Promise<Response> {
    const scheduled = dependencies.hasSchedulerToken(request);
    if (!scheduled) {
      try {
        await dependencies.requireAdmin();
      } catch (error) {
        const status = typeof error === "object"
          && error !== null
          && "status" in error
          && (error.status === 401 || error.status === 403)
          ? error.status
          : 500;
        return Response.json(
          { error: status === 403 ? "Admin access required" : "Authentication required" },
          { status },
        );
      }
    }

    let mode: SyncMode = scheduled ? "scheduled" : "manual";
    try {
      const body = await request.json() as { mode?: unknown };
      if (!scheduled && body.mode === "scheduled") mode = "manual";
    } catch {
      // Empty request bodies are valid for both scheduler and manual calls.
    }

    try {
      const result = await dependencies.sync(mode);
      return Response.json({
        ...result,
        message: `ซิงก์สำเร็จ: อัปเดต fixtures ${result.fixturesUpserted} รายการ และคำนวณใหม่ ${result.affectedGameweekIds.length} GW`,
      });
    } catch (error) {
      if (error instanceof SyncFailure) {
        return Response.json({ error: "Sync failed", reason: safeSyncFailureReason(error) }, { status: 502 });
      }
      return Response.json({ error: "Sync failed" }, { status: 502 });
    }
  };
}
