import { createAdminFantasyAwardsHandler } from "@/lib/api/admin-fantasy-handler";
import { requireAdmin } from "@/lib/auth/guards";
import { getFantasyAdminRepository } from "@/lib/data/fantasy-admin";

export async function PUT(request: Request): Promise<Response> {
  return createAdminFantasyAwardsHandler({ requireAdmin, repository: getFantasyAdminRepository() })(request);
}
