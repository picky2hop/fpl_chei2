import "server-only";

import { buildFantasyDashboard, type FantasyDashboardResponse } from "@/lib/fantasy/dashboard";
import { buildFantasyLeagueDashboard, type FantasyLeagueDashboardResponse } from "@/lib/fantasy/league-dashboard";
import { createFantasyRepository } from "@/lib/fantasy/repository";
import { createFantasyFplProvider } from "@/lib/fantasy/fpl-client";
import { loadCurrentSquad } from "@/lib/fantasy/current-squad-service";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadLatestPlayerOfWeek, loadLatestTeamOfWeek } from "@/lib/fantasy/weekly-features";

export async function getFantasyDashboardData(input: { gameweekNumber?: number }): Promise<FantasyDashboardResponse> {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const season = await repository.getActiveSeason();
  return buildFantasyDashboard(await repository.getDashboard({ seasonId: season.id, selectedGameweekNumber: input.gameweekNumber }));
}

export async function getFantasyLeagueDashboardData(input: { leagueId: string; gameweekNumber?: number }): Promise<FantasyLeagueDashboardResponse> {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const season = await repository.getActiveSeason();
  const provider = createFantasyFplProvider();
  const [dashboardInput, playerOfWeek] = await Promise.all([
    repository.getLeagueDashboard({ seasonId: season.id, leagueId: input.leagueId, selectedGameweekNumber: input.gameweekNumber }),
    loadLatestPlayerOfWeek({ provider }),
  ]);
  return buildFantasyLeagueDashboard({ ...dashboardInput, playerOfWeek });
}

export async function getFantasyLeaguesData() {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const season = await repository.getActiveSeason();
  return { season, leagues: await repository.listLeagues(season.id, true) };
}

export async function getFantasyTeamOfWeekData() {
  return loadLatestTeamOfWeek({ provider: createFantasyFplProvider() });
}

export async function getFantasyCurrentSquadData(input: { leagueId: string; entryId: number }) {
  const repository = createFantasyRepository(getSupabaseAdmin());
  const provider = createFantasyFplProvider();
  const season = await repository.getActiveSeason();
  if (!repository.getCurrentLeagueEntry || !repository.getCurrentSquad || !repository.upsertCurrentSquad || !provider.getEntryPicks) {
    throw new Error("Fantasy current squad is unavailable");
  }
  const context = await repository.getCurrentLeagueEntry({
    seasonId: season.id,
    leagueId: input.leagueId,
    entryId: input.entryId,
  });
  return loadCurrentSquad({
    seasonId: season.id,
    entryId: input.entryId,
    gameweekId: context.gameweekId,
    gameweekNumber: context.gameweekNumber,
    now: new Date().toISOString(),
    repository: {
      getCurrentSquad: repository.getCurrentSquad,
      upsertCurrentSquad: repository.upsertCurrentSquad,
    },
    provider: { getEntryPicks: provider.getEntryPicks },
  });
}
