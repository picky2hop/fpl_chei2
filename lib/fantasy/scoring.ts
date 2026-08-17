import type { FantasyAward, FantasyEntryMapping } from "./types.ts";

export type FantasyScoreRow = {
  mapping_id: string;
  gameweek_id: string;
  points: number;
};

export type FantasyMappingLeaderboardRow = Pick<
  FantasyEntryMapping,
  "id" | "fpl_entry_id" | "fpl_team_name" | "fpl_manager_name" | "mapping_status" | "app_user_id"
> & {
  display_name: string;
  avatar_url: string | null;
};

export type FantasyLeaderboardEntry = {
  mappingId: string;
  fplEntryId: number;
  teamName: string;
  managerName: string;
  mappingStatus: "active" | "archived";
  appUserId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
};

export type FantasyPlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export type FantasyPlayerStatRow = {
  gameweek_id?: string;
  fpl_player_id: number;
  player_name: string;
  position: FantasyPlayerPosition;
  club_id: number;
  club_name: string;
  status: string;
  selected_by_percent: number;
  transfers_in_event: number;
  transfers_out_event: number;
  form: number;
};

export type FantasyPlayerStatEntry = {
  playerId: number;
  playerName: string;
  position: FantasyPlayerPosition;
  clubId: number;
  clubName: string;
  status: string;
  metricValue: number;
};

export type FantasyPlayerStatGroups = {
  selected: Record<FantasyPlayerPosition, FantasyPlayerStatEntry[]>;
  transfersIn: Record<FantasyPlayerPosition, FantasyPlayerStatEntry[]>;
  transfersOut: Record<FantasyPlayerPosition, FantasyPlayerStatEntry[]>;
  form: Record<FantasyPlayerPosition, FantasyPlayerStatEntry[]>;
  globalCaptain: FantasyPlayerStatEntry | null;
  globalViceCaptain: FantasyPlayerStatEntry | null;
};

const positions: FantasyPlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

export function sumFantasySeasonPoints(scores: Array<{ points: number; event_transfers_cost?: number }>): number {
  return scores.reduce((total, score) => total + score.points, 0);
}

function pointsForMapping(rows: FantasyScoreRow[], mappingId: string, selectedGameweekId: string, mode: "gameweek" | "season"): number {
  return sumFantasySeasonPoints(rows.filter((row) => row.mapping_id === mappingId
    && (mode === "season" || row.gameweek_id === selectedGameweekId)));
}

export function buildFantasyLeaderboard(input: {
  rows: FantasyScoreRow[];
  mappings: FantasyMappingLeaderboardRow[];
  selectedGameweekId: string;
  mode: "gameweek" | "season";
}): FantasyLeaderboardEntry[] {
  return input.mappings
    .map((mapping) => ({
      mappingId: mapping.id,
      fplEntryId: mapping.fpl_entry_id,
      teamName: mapping.fpl_team_name,
      managerName: mapping.fpl_manager_name,
      mappingStatus: mapping.mapping_status,
      appUserId: mapping.app_user_id,
      displayName: mapping.display_name,
      avatarUrl: mapping.avatar_url,
      points: pointsForMapping(input.rows, mapping.id, input.selectedGameweekId, input.mode),
    }))
    .sort((left, right) => right.points - left.points || left.mappingId.localeCompare(right.mappingId));
}

function isSelectable(status: string): boolean {
  return status === "a" || status === "d";
}

function toEntry(row: FantasyPlayerStatRow, metricValue: number): FantasyPlayerStatEntry {
  return {
    playerId: row.fpl_player_id,
    playerName: row.player_name,
    position: row.position,
    clubId: row.club_id,
    clubName: row.club_name,
    status: row.status,
    metricValue,
  };
}

function rankTopFive(rows: FantasyPlayerStatRow[], metric: (row: FantasyPlayerStatRow) => number): FantasyPlayerStatEntry[] {
  const sorted = rows
    .filter((row) => isSelectable(row.status))
    .map((row) => ({ row, value: metric(row) }))
    .sort((left, right) => right.value - left.value || left.row.fpl_player_id - right.row.fpl_player_id);
  const cutoff = sorted[4]?.value;
  return sorted
    .filter((item) => cutoff === undefined || item.value >= cutoff)
    .map((item) => toEntry(item.row, item.value));
}

function grouped(rows: FantasyPlayerStatRow[], metric: (row: FantasyPlayerStatRow) => number): Record<FantasyPlayerPosition, FantasyPlayerStatEntry[]> {
  return Object.fromEntries(positions.map((position) => [
    position,
    rankTopFive(rows.filter((row) => row.position === position), metric),
  ])) as Record<FantasyPlayerPosition, FantasyPlayerStatEntry[]>;
}

export function rankPlayerStats(input: {
  players: FantasyPlayerStatRow[];
  currentGameweekId: string;
  globalCaptainPlayerId?: number | null;
  globalViceCaptainPlayerId?: number | null;
}): FantasyPlayerStatGroups {
  const currentPlayers = input.players.filter((player) => !player.gameweek_id || player.gameweek_id === input.currentGameweekId);
  const captain = currentPlayers.find((player) => player.fpl_player_id === input.globalCaptainPlayerId && isSelectable(player.status));
  const viceCaptain = currentPlayers.find((player) => player.fpl_player_id === input.globalViceCaptainPlayerId && isSelectable(player.status));
  return {
    selected: grouped(currentPlayers, (row) => row.selected_by_percent),
    transfersIn: grouped(currentPlayers, (row) => row.transfers_in_event),
    transfersOut: grouped(currentPlayers, (row) => row.transfers_out_event),
    form: grouped(currentPlayers, (row) => row.form),
    globalCaptain: captain ? toEntry(captain, captain.selected_by_percent) : null,
    globalViceCaptain: viceCaptain ? toEntry(viceCaptain, viceCaptain.selected_by_percent) : null,
  };
}

export type FantasyAwardEntry = {
  mappingId: string;
  award: FantasyAward;
};
