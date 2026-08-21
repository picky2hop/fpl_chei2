import "server-only";

import { buildFantasyDashboard, type FantasyDashboardResponse } from "@/lib/fantasy/dashboard";
import { buildFantasyLeagueDashboard, type FantasyLeagueDashboardResponse } from "@/lib/fantasy/league-dashboard";
import { createFantasyRepository } from "@/lib/fantasy/repository";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getFantasyDashboardData(input: { gameweekNumber?: number }): Promise<FantasyDashboardResponse> {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const season = await repository.getActiveSeason();
  return buildFantasyDashboard(await repository.getDashboard({ seasonId: season.id, selectedGameweekNumber: input.gameweekNumber }));
}

export async function getFantasyLeagueDashboardData(input: { leagueId: string; gameweekNumber?: number }): Promise<FantasyLeagueDashboardResponse> {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const season = await repository.getActiveSeason();
  return buildFantasyLeagueDashboard(await repository.getLeagueDashboard({ seasonId: season.id, leagueId: input.leagueId, selectedGameweekNumber: input.gameweekNumber }));
}

export async function getFantasyLeaguesData() {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const season = await repository.getActiveSeason();
  return { season, leagues: await repository.listLeagues(season.id, true) };
}
