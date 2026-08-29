import type { FantasyPlayerPosition, FantasyPlayerStatGroups, FantasyPlayerStatEntry } from "./scoring.ts";

export type PlayerStatsCategory = "selected" | "form" | "transfersIn" | "transfersOut" | "defensiveContribution" | "bps" | "pointsPerGame" | "expectedGoalInvolvementsPer90" | "latestGameweekPoints";
export type PlayerStatsPositionFilter = FantasyPlayerPosition | "ALL";

export type RankedVisiblePlayerStat = {
  player: FantasyPlayerStatEntry;
  rank: number;
};

const positions: FantasyPlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

export function isGoalkeeperExcluded(category: PlayerStatsCategory): boolean {
  return category === "defensiveContribution" || category === "expectedGoalInvolvementsPer90";
}

export function playerStatsPositionOptions(category: PlayerStatsCategory): PlayerStatsPositionFilter[] {
  return isGoalkeeperExcluded(category) ? ["ALL", "DEF", "MID", "FWD"] : ["ALL", ...positions];
}

export function visiblePlayerStats(groups: Pick<FantasyPlayerStatGroups, PlayerStatsCategory>, category: PlayerStatsCategory, position: PlayerStatsPositionFilter): FantasyPlayerStatEntry[] {
  const values = groups[category];
  return position === "ALL" ? positions.flatMap((item) => values[item]) : values[position];
}

export function rankVisiblePlayerStats(groups: Pick<FantasyPlayerStatGroups, PlayerStatsCategory>, category: PlayerStatsCategory, position: PlayerStatsPositionFilter): RankedVisiblePlayerStat[] {
  const ranks = new Map<FantasyPlayerPosition, number>();
  return visiblePlayerStats(groups, category, position).map((player) => {
    const rank = (ranks.get(player.position) ?? 0) + 1;
    ranks.set(player.position, rank);
    return { player, rank };
  });
}
