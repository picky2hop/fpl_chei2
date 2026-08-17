import { createAdminFantasyMappingsHandler } from "@/lib/api/admin-fantasy-handler";
import { requireAdmin } from "@/lib/auth/guards";
import { getFantasyAdminProvider, getFantasyAdminRepository, listFantasyAdminUsers } from "@/lib/data/fantasy-admin";

async function handler(request: Request): Promise<Response> {
  return createAdminFantasyMappingsHandler({ requireAdmin, repository: getFantasyAdminRepository(), provider: getFantasyAdminProvider(), listUsers: listFantasyAdminUsers })(request);
}

export const GET = handler;
export const POST = handler;
