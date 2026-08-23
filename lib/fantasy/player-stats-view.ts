import type { FantasyPlayerPosition, FantasyPlayerStatGroups, FantasyPlayerStatEntry } from "./scoring.ts";

export type PlayerStatsCategory = "selected" | "form" | "transfersIn" | "transfersOut";
export type PlayerStatsPositionFilter = FantasyPlayerPosition | "ALL";

export type RankedVisiblePlayerStat = {
  player: FantasyPlayerStatEntry;
  rank: number;
};

const positions: FantasyPlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

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
