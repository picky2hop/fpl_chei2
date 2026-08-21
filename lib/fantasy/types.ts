import type { FplLeagueMember, FplLeagueSummary } from "./league-types.ts";

export type FplEntryHistoryEvent = {
  event: number;
  points: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

export type FplEntrySummary = {
  entryId: number;
  teamName: string;
  managerName: string;
};

export type FplPlayerSnapshot = {
  playerId: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  clubId: number;
  clubName: string;
  status: string;
  selectedByPercent: number;
  transfersInEvent: number;
  transfersOutEvent: number;
  form: number;
  is_global_captain?: boolean;
  is_global_vice_captain?: boolean;
};

export type FplBootstrapSnapshot = {
  currentGameweek: number;
  latestFinishedGameweek: number | null;
  players: FplPlayerSnapshot[];
  mostCaptainedPlayerId: number | null;
  mostViceCaptainedPlayerId: number | null;
};

export type FantasyFplProvider = {
  getEntrySummary(entryId: number): Promise<FplEntrySummary>;
  getEntryHistory(entryId: number): Promise<FplEntryHistoryEvent[]>;
  getBootstrap(): Promise<FplBootstrapSnapshot>;
  getLeague(leagueId: number): Promise<FplLeagueSummary>;
  getLeagueMembers(leagueId: number): Promise<FplLeagueMember[]>;
};

export type FantasyPlayerStatInsert = {
  season_id: string;
  gameweek_id: string;
  fpl_player_id: number;
  player_name: string;
  position: FplPlayerSnapshot["position"];
  club_id: number;
  club_name: string;
  status: string;
  selected_by_percent: number;
  transfers_in_event: number;
  transfers_out_event: number;
  form: number;
  is_global_captain?: boolean;
  is_global_vice_captain?: boolean;
  source_synced_at: string;
};

export type FantasyGameweekScoreInsert = {
  season_id: string;
  mapping_id: string;
  gameweek_id: string;
  points: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
  source_synced_at: string;
};

export type FantasyMappingStatus = "active" | "archived";
export type FantasyValidationStatus = "valid" | "error";
export type FantasyAward = "champion" | "wooden_spoon";

export type FantasyEntryMapping = {
  id: string;
  season_id: string;
  app_user_id: string;
  fpl_entry_id: number;
  fpl_team_name: string;
  fpl_manager_name: string;
  mapping_status: FantasyMappingStatus;
  last_validation_status: FantasyValidationStatus;
  last_error_message: string | null;
  linked_at: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateFantasyMappingInput = {
  season_id: string;
  app_user_id: string;
  fpl_entry_id: number;
  fpl_team_name: string;
  fpl_manager_name: string;
};

export type FantasySyncWriteResult = {
  jobRunId: string;
  scoresUpserted: number;
  playersUpserted: number;
  mappingsUpdated: number;
  failedMappings: number[];
};
