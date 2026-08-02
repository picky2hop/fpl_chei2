import { requireAdmin } from "@/lib/auth/guards";
import { createSyncHandler } from "@/lib/api/sync-handler";
import { getServerEnv } from "@/lib/env";
import { syncFplData } from "@/lib/sync/sync-service";

function hasSchedulerToken(request: Request): boolean {
  return request.headers.get("x-fpl-sync-token") === getServerEnv().syncToken;
}

export const POST = createSyncHandler({
  hasSchedulerToken,
  requireAdmin,
  sync: syncFplData,
});
