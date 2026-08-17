import { createAdminFantasyReplaceHandler } from "@/lib/api/admin-fantasy-handler";
import { requireAdmin } from "@/lib/auth/guards";
import { getFantasyAdminProvider, getFantasyAdminRepository } from "@/lib/data/fantasy-admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return createAdminFantasyReplaceHandler({ requireAdmin, repository: getFantasyAdminRepository(), provider: getFantasyAdminProvider() }, id)(request);
}
