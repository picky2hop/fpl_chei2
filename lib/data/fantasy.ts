import "server-only";

import { buildFantasyDashboard, type FantasyDashboardResponse } from "@/lib/fantasy/dashboard";
import { buildFantasyLeagueDashboard, type FantasyLeagueDashboardResponse } from "@/lib/fantasy/league-dashboard";
import { createFantasyRepository } from "@/lib/fantasy/repository";
import { createFantasyFplProvider } from "@/lib/fantasy/fpl-client";
import { loadCurrentSquad } from "@/lib/fantasy/current-squad-service";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadLatestPlayerOfWeek, loadLatestTeamOfWeek } from "@/lib/fantasy/weekly-features";
import { selectPreferredFantasyTeam, type FantasyMyTeamData } from "@/lib/data/line-bot-core";

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

export async function getFantasyMyTeamData(input: { lineUserId: string }): Promise<FantasyMyTeamData | null> {
  const admin = getSupabaseAdmin();
  const repository = createFantasyRepository(admin);
  const season = await repository.getActiveSeason();
  const [{ data: user, error: userError }, { data: leagues, error: leagueError }, { data: mappings, error: mappingError }, { data: gameweeks, error: gameweekError }] = await Promise.all([
    admin.from("app_users").select("id,display_name,avatar_url,status").eq("line_user_id", input.lineUserId).eq("status", "active").maybeSingle(),
    admin.from("fantasy_leagues").select("id,fpl_league_id,official_name").eq("season_id", season.id).eq("status", "active").in("fpl_league_id", [819498, 819502]),
    admin.from("fantasy_entry_mappings").select("app_user_id,fpl_entry_id,fpl_team_name,fpl_manager_name").eq("season_id", season.id).eq("mapping_status", "active"),
    admin.from("gameweeks").select("id,number,is_current,status").eq("season_id", season.id).order("number"),
  ]);
  if (userError || leagueError || mappingError || gameweekError) throw new Error("Fantasy my team is unavailable");
  if (!user) return null;

  const activeGameweek = (gameweeks ?? []).find((gameweek) => gameweek.is_current)
    ?? [...(gameweeks ?? [])].filter((gameweek) => gameweek.status === "closed" || gameweek.status === "reopened").sort((left, right) => right.number - left.number)[0]
    ?? (gameweeks ?? [])[0];
  const activeLeagues = leagues ?? [];
  const userMappings = (mappings ?? []).filter((mapping) => mapping.app_user_id === user.id && mapping.fpl_entry_id > 0);
  if (!activeGameweek || !activeLeagues.length || !userMappings.length) return null;

  const { data: memberships, error: membershipError } = await admin
    .from("fantasy_league_membership_snapshots")
    .select("league_id,fpl_entry_id,fpl_team_name,fpl_manager_name")
    .eq("season_id", season.id)
    .eq("gameweek_id", activeGameweek.id)
    .in("league_id", activeLeagues.map((league) => league.id))
    .in("fpl_entry_id", userMappings.map((mapping) => mapping.fpl_entry_id));
  if (membershipError) throw new Error("Fantasy my team is unavailable");

  const mappingsByEntry = new Map(userMappings.map((mapping) => [mapping.fpl_entry_id, mapping]));
  const leaguesById = new Map(activeLeagues.map((league) => [league.id, league]));
  const candidates = (memberships ?? []).flatMap((membership) => {
    const league = leaguesById.get(membership.league_id);
    const mapping = mappingsByEntry.get(membership.fpl_entry_id);
    if (!league || !mapping || (league.fpl_league_id !== 819498 && league.fpl_league_id !== 819502)) return [];
    return [{
      leagueId: league.id,
      leagueFplId: league.fpl_league_id as 819498 | 819502,
      leagueName: league.official_name,
      entryId: membership.fpl_entry_id,
      teamName: membership.fpl_team_name || mapping.fpl_team_name,
      managerName: membership.fpl_manager_name || mapping.fpl_manager_name,
    }];
  });
  const selected = selectPreferredFantasyTeam(candidates);
  if (!selected) return null;

  const current = await getFantasyCurrentSquadData({ leagueId: selected.leagueId, entryId: selected.entryId });
  return {
    leagueFplId: selected.leagueFplId,
    leagueName: selected.leagueName,
    entryId: selected.entryId,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    teamName: selected.teamName,
    managerName: selected.managerName,
    squad: current.squad,
  };
}
