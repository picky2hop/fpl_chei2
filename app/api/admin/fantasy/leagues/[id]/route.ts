import { createAdminFantasyLeaguePatchHandler } from "@/lib/api/admin-fantasy-leagues-handler";
import { requireAdmin } from "@/lib/auth/guards";
import { getFantasyAdminProvider, getFantasyAdminRepository } from "@/lib/data/fantasy-admin";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return createAdminFantasyLeaguePatchHandler({ requireAdmin, repository: getFantasyAdminRepository(), provider: getFantasyAdminProvider() }, id)(request);
}
