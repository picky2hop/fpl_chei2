import { requireAdmin } from "@/lib/auth/guards";
import { createAdminFantasyPlayerStatsSyncHandler } from "@/lib/api/admin-fantasy-handler";
import { runAdminFantasyPlayerStatsSync } from "@/lib/data/fantasy-admin";

export const POST = createAdminFantasyPlayerStatsSyncHandler({
  requireAdmin,
  run: runAdminFantasyPlayerStatsSync,
});
