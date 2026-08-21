import { createAdminFantasyLeaguesHandler } from "@/lib/api/admin-fantasy-leagues-handler";
import { requireAdmin } from "@/lib/auth/guards";
import { getFantasyAdminProvider, getFantasyAdminRepository } from "@/lib/data/fantasy-admin";

export async function GET(request: Request): Promise<Response> {
  return createAdminFantasyLeaguesHandler({ requireAdmin, repository: getFantasyAdminRepository(), provider: getFantasyAdminProvider() })(request);
}

export async function POST(request: Request): Promise<Response> {
  return createAdminFantasyLeaguesHandler({ requireAdmin, repository: getFantasyAdminRepository(), provider: getFantasyAdminProvider() })(request);
}
