import { rankPlayerStats, type FantasyPlayerStatGroups, type FantasyPlayerStatRow } from "./scoring.ts";
import { buildLeagueLeaderboard, type EntryScoreRow, type LeagueLeaderboardRow, type LeagueMappingIdentity, type LeagueMembershipRow } from "./league-scoring.ts";
import type { FantasyLeagueRecord } from "./league-types.ts";
import type { FantasyPlayerOfWeek, FantasyWeeklyFeatureState } from "./types.ts";

export type FantasyLeagueDashboardInput = {
  season: { id: string; name: string };
  gameweeks: Array<{ id: string; number: number; name: string | null; is_current: boolean; status: string }>;
  leagues: FantasyLeagueRecord[];
  selectedLeagueId: string;
  selectedGameweekNumber?: number;
  memberships: Array<LeagueMembershipRow & { gameweek_number: number }>;
  scores: EntryScoreRow[];
  mappings: LeagueMappingIdentity[];
  players: FantasyPlayerStatRow[];
  globalCaptainPlayerId: number | null;
  globalViceCaptainPlayerId: number | null;
  awards: Array<{ fpl_entry_id: number; award: "champion" | "wooden_spoon" }>;
  sync: { lastSyncedAt: string | null; stale: boolean; message: string | null };
  playerOfWeek?: FantasyWeeklyFeatureState<FantasyPlayerOfWeek>;
};

export type FantasyLeagueDashboardResponse = {
  season: { id: string; name: string };
  leagues: FantasyLeagueRecord[];
  selectedLeagueId: string;
  currentGameweek: number;
  selectedLeaderboardGameweek: number;
  sync: FantasyLeagueDashboardInput["sync"];
  leaderboard: { gameweek: LeagueLeaderboardRow[]; season: LeagueLeaderboardRow[] };
  awards: {
    champions: Array<{ entryId: number; award: "champion" }>;
    woodenSpoons: Array<{ entryId: number; award: "wooden_spoon" }>;
  };
  playerStats: FantasyPlayerStatGroups;
  playerOfWeek: FantasyWeeklyFeatureState<FantasyPlayerOfWeek>;
};

function currentGameweek(gameweeks: FantasyLeagueDashboardInput["gameweeks"]): number {
  return gameweeks.find((gameweek) => gameweek.is_current)?.number
    ?? [...gameweeks].filter((gameweek) => gameweek.status === "closed" || gameweek.status === "reopened").sort((left, right) => right.number - left.number)[0]?.number
    ?? gameweeks[0]?.number
    ?? 0;
}

export function buildFantasyLeagueDashboard(input: FantasyLeagueDashboardInput): FantasyLeagueDashboardResponse {
  const current = currentGameweek(input.gameweeks);
  const selected = input.gameweeks.some((gameweek) => gameweek.number === input.selectedGameweekNumber)
    ? input.selectedGameweekNumber ?? current
    : current;
  const selectedGameweek = input.gameweeks.find((gameweek) => gameweek.number === selected) ?? input.gameweeks[0];
  if (!selectedGameweek) throw new Error("Fantasy gameweek is unavailable");
  const selectedMembers = input.memberships
    .filter((member) => member.league_id === input.selectedLeagueId && member.gameweek_id === selectedGameweek.id)
    .map((member) => ({
      league_id: member.league_id,
      gameweek_id: member.gameweek_id,
      fpl_entry_id: member.fpl_entry_id,
      fpl_team_name: member.fpl_team_name,
      fpl_manager_name: member.fpl_manager_name,
    }));
  const leaderboardInput = {
    members: selectedMembers,
    scores: input.scores,
    mappings: input.mappings,
    selectedGameweekId: selectedGameweek.id,
    selectedGameweekNumber: selected,
  } as const;
  const currentGameweekId = input.gameweeks.find((gameweek) => gameweek.number === current)?.id ?? "";
  return {
    season: input.season,
    leagues: input.leagues,
    selectedLeagueId: input.selectedLeagueId,
    currentGameweek: current,
    selectedLeaderboardGameweek: selected,
    sync: input.sync,
    leaderboard: {
      gameweek: buildLeagueLeaderboard({ ...leaderboardInput, mode: "gameweek" }),
      season: buildLeagueLeaderboard({ ...leaderboardInput, mode: "season" }),
    },
    awards: {
      champions: input.awards.filter((award) => award.award === "champion").map((award) => ({ entryId: award.fpl_entry_id, award: "champion" as const })),
      woodenSpoons: input.awards.filter((award) => award.award === "wooden_spoon").map((award) => ({ entryId: award.fpl_entry_id, award: "wooden_spoon" as const })),
    },
    playerStats: rankPlayerStats({
      players: input.players,
      currentGameweekId,
      globalCaptainPlayerId: input.globalCaptainPlayerId,
      globalViceCaptainPlayerId: input.globalViceCaptainPlayerId,
    }),
    playerOfWeek: input.playerOfWeek ?? { state: "unavailable", message: "ยังไม่มีข้อมูล Player of the Week" },
  };
}
