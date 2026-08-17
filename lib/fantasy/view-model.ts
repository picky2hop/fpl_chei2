import type { FantasyDashboardResponse } from "./dashboard.ts";

export type FantasyTab = "leaderboard" | "player-stats";
export type LeaderboardMode = "gameweek" | "season";

export type FantasyViewModel = {
  tab: FantasyTab;
  mode: LeaderboardMode;
  selectedGameweek: number;
  currentGameweek: number;
  stale: boolean;
  leaderboard: FantasyDashboardResponse["leaderboard"]["gameweek"];
  playerStats: FantasyDashboardResponse["playerStats"];
};

export function buildFantasyViewModel(payload: FantasyDashboardResponse, state: { tab: FantasyTab; mode: LeaderboardMode; selectedGameweek: number }): FantasyViewModel {
  const selectedGameweek = state.selectedGameweek > 0 ? state.selectedGameweek : payload.currentGameweek;
  return {
    tab: state.tab,
    mode: state.mode,
    selectedGameweek,
    currentGameweek: payload.currentGameweek,
    stale: payload.sync.stale,
    leaderboard: state.mode === "season" ? payload.leaderboard.season : payload.leaderboard.gameweek,
    playerStats: payload.playerStats,
  };
}
