import { buildFantasyLeaderboard, rankPlayerStats, type FantasyLeaderboardEntry, type FantasyPlayerStatGroups, type FantasyPlayerStatRow } from "./scoring.ts";
import type { FantasyAward } from "./types.ts";

export type FantasyDashboardInput = {
  season: { id: string; name: string };
  gameweeks: Array<{ id: string; number: number; name: string | null; is_current: boolean; status: string }>;
  selectedGameweekNumber?: number;
  mappings: Array<{
    id: string;
    season_id: string;
    app_user_id: string;
    fpl_entry_id: number;
    fpl_team_name: string;
    fpl_manager_name: string;
    mapping_status: "active" | "archived";
    display_name: string;
    avatar_url: string | null;
  }>;
  scores: Array<{ mapping_id: string; gameweek_id: string; points: number }>;
  players: FantasyPlayerStatRow[];
  globalCaptainPlayerId: number | null;
  globalViceCaptainPlayerId: number | null;
  awards: Array<{ mapping_id: string; award: FantasyAward }>;
  sync: { lastSyncedAt: string | null; stale: boolean; message: string | null };
};

export type FantasyDashboardResponse = {
  season: { id: string; name: string };
  currentGameweek: number;
  latestFinishedGameweek: number | null;
  selectedLeaderboardGameweek: number;
  sync: FantasyDashboardInput["sync"];
  leaderboard: { gameweek: FantasyLeaderboardEntry[]; season: FantasyLeaderboardEntry[] };
  awards: {
    champions: Array<{ mappingId: string; award: "champion" }>;
    woodenSpoons: Array<{ mappingId: string; award: "wooden_spoon" }>;
  };
  playerStats: FantasyPlayerStatGroups;
};

function currentGameweek(gameweeks: FantasyDashboardInput["gameweeks"]): number {
  return gameweeks.find((gameweek) => gameweek.is_current)?.number
    ?? [...gameweeks]
      .filter((gameweek) => gameweek.status === "closed" || gameweek.status === "reopened")
      .sort((left, right) => right.number - left.number)[0]?.number
    ?? gameweeks[0]?.number
    ?? 0;
}

function latestFinishedGameweek(gameweeks: FantasyDashboardInput["gameweeks"]): number | null {
  return [...gameweeks]
    .filter((gameweek) => gameweek.status === "closed" || gameweek.status === "reopened")
    .sort((left, right) => right.number - left.number)[0]?.number ?? null;
}

export function buildFantasyDashboard(input: FantasyDashboardInput): FantasyDashboardResponse {
  const current = currentGameweek(input.gameweeks);
  const selected = input.gameweeks.some((gameweek) => gameweek.number === input.selectedGameweekNumber)
    ? input.selectedGameweekNumber ?? current
    : current;
  const selectedGameweekId = input.gameweeks.find((gameweek) => gameweek.number === selected)?.id ?? "";
  const currentGameweekId = input.gameweeks.find((gameweek) => gameweek.number === current)?.id ?? "";
  const leaderboardMappings = input.mappings.filter((mapping) => mapping.mapping_status === "active"
    || input.scores.some((score) => score.mapping_id === mapping.id));
  const playerStats = rankPlayerStats({
    players: input.players,
    currentGameweekId,
    globalCaptainPlayerId: input.globalCaptainPlayerId,
    globalViceCaptainPlayerId: input.globalViceCaptainPlayerId,
  });
  return {
    season: input.season,
    currentGameweek: current,
    latestFinishedGameweek: latestFinishedGameweek(input.gameweeks),
    selectedLeaderboardGameweek: selected,
    sync: input.sync,
    leaderboard: {
      gameweek: buildFantasyLeaderboard({ rows: input.scores, mappings: leaderboardMappings, selectedGameweekId, mode: "gameweek" }),
      season: buildFantasyLeaderboard({ rows: input.scores, mappings: leaderboardMappings, selectedGameweekId, mode: "season" }),
    },
    awards: {
      champions: input.awards.filter((award) => award.award === "champion").map((award) => ({ mappingId: award.mapping_id, award: "champion" as const })),
      woodenSpoons: input.awards.filter((award) => award.award === "wooden_spoon").map((award) => ({ mappingId: award.mapping_id, award: "wooden_spoon" as const })),
    },
    playerStats,
  };
}
