import { requireAdmin } from "@/lib/auth/guards";
import { createAdminFantasyRecalculateScoresHandler } from "@/lib/api/admin-fantasy-handler";
import { runAdminFantasyScoreRecalculation } from "@/lib/data/fantasy-admin";

export const POST = createAdminFantasyRecalculateScoresHandler({
  requireAdmin,
  run: runAdminFantasyScoreRecalculation,
});
