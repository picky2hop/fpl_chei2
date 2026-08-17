import "server-only";

import { buildFantasyDashboard, type FantasyDashboardResponse } from "@/lib/fantasy/dashboard";
import { createFantasyRepository } from "@/lib/fantasy/repository";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getFantasyDashboardData(input: { gameweekNumber?: number }): Promise<FantasyDashboardResponse> {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const season = await repository.getActiveSeason();
  return buildFantasyDashboard(await repository.getDashboard({ seasonId: season.id, selectedGameweekNumber: input.gameweekNumber }));
}
