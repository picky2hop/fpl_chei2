import { createAdminFantasyArchiveHandler } from "@/lib/api/admin-fantasy-handler";
import { requireAdmin } from "@/lib/auth/guards";
import { getFantasyAdminRepository } from "@/lib/data/fantasy-admin";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  return createAdminFantasyArchiveHandler({ requireAdmin, repository: getFantasyAdminRepository() }, id)();
}
