export type FplLeagueSummary = {
  leagueId: number;
  officialName: string;
};

export type FplLeagueMember = {
  entryId: number;
  teamName: string;
  managerName: string;
  rank: number | null;
};

export type LeagueMemberSource = {
  leagueId: string;
  members: FplLeagueMember[];
};

export type DeduplicatedLeagueMember = {
  entryId: number;
  teamName: string;
  managerName: string;
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
  source_synced_at: string;
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
