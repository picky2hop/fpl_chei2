export type FplLeagueSummary = {
  leagueId: number;
  officialName: string;
};

export type FplLeagueMember = {
  entryId: number;
  teamName: string;
  managerName: string;
  rank: number | null;
  eventTotal?: number;
  seasonTotal?: number;
  eventTransfers?: number;
  eventTransfersCost?: number;
};

export type LeagueMemberSource = {
  leagueId: string;
  members: FplLeagueMember[];
};

export type DeduplicatedLeagueMember = {
  entryId: number;
  teamName: string;
  managerName: string;
  eventTotal?: number;
  seasonTotal?: number;
  eventTransfers?: number;
  eventTransfersCost?: number;
  leagues: Array<{ leagueId: string; rank: number | null }>;
};

export type FantasyLeagueMembershipInsert = {
  season_id: string;
  league_id: string;
  gameweek_id: string;
  fpl_entry_id: number;
  fpl_team_name: string;
  fpl_manager_name: string;
  source_synced_at: string;
};

export type FantasyLeagueRecord = {
  id: string;
  season_id: string;
  fpl_league_id: number;
  official_name: string;
  status: "active" | "archived";
  archived_at: string | null;
};

export type FantasyLeagueSyncLeague = {
  id: string;
  season_id: string;
  fpl_league_id: number;
  official_name: string;
  status: "active" | "archived";
  archived_at: string | null;
};

export type FantasyEntryGameweekScoreInsert = {
  season_id: string;
  gameweek_id: string;
  fpl_entry_id: number;
  fpl_team_name: string;
  fpl_manager_name: string;
  points: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
  calculation_method: "legacy_fpl_history" | "starting_xi_captain_v1" | "starting_xi_captain_v2";
  source_synced_at: string;
};

export type FantasyEntryGameweekScoreMethodRow = {
  fpl_entry_id: number;
  gameweek_id: string;
  calculation_method: "legacy_fpl_history" | "starting_xi_captain_v1" | "starting_xi_captain_v2";
};

export type FantasyLeagueSyncWriteResult = {
  jobRunId: string;
  leaguesUpserted: number;
  membershipsUpserted: number;
  scoresUpserted: number;
  playersUpserted: number;
};

export type CreateFantasyLeagueInput = {
  season_id: string;
  fpl_league_id: number;
  official_name: string;
};

export type FantasyLeagueMappingCandidate = {
  fpl_entry_id: number;
  fpl_team_name: string;
  fpl_manager_name: string;
  leagues: Array<{ id: string; official_name: string }>;
};
