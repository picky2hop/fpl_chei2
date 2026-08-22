import type { FantasyPlayerPosition, FantasyPlayerStatGroups, FantasyPlayerStatEntry } from "./scoring.ts";

export type PlayerStatsCategory = "selected" | "form" | "transfersIn" | "transfersOut";
export type PlayerStatsPositionFilter = FantasyPlayerPosition | "ALL";

const positions: FantasyPlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

export function visiblePlayerStats(groups: Pick<FantasyPlayerStatGroups, PlayerStatsCategory>, category: PlayerStatsCategory, position: PlayerStatsPositionFilter): FantasyPlayerStatEntry[] {
  const values = groups[category];
  return position === "ALL" ? positions.flatMap((item) => values[item]) : values[position];
}
