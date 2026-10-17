export type LeaderboardAward = "champion" | "wooden_spoon";

export type LeaderboardAwardCounts = {
  championCount: number;
  woodenSpoonCount: number;
};

export function countLeaderboardAwards<T extends { award: LeaderboardAward }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): Map<string, LeaderboardAwardCounts> {
  const counts = new Map<string, LeaderboardAwardCounts>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = counts.get(key) ?? { championCount: 0, woodenSpoonCount: 0 };
    if (row.award === "champion") current.championCount += 1;
    if (row.award === "wooden_spoon") current.woodenSpoonCount += 1;
    counts.set(key, current);
  }
  return counts;
}

export function formatLeaderboardName(name: string, counts?: Partial<LeaderboardAwardCounts>): string {
  return `${name} (🥇${counts?.championCount ?? 0} 💩${counts?.woodenSpoonCount ?? 0})`;
}
