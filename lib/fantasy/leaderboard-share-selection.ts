export function selectTopLeaderboardRows<T extends { rank: number }>(rows: readonly T[], limit = 5): T[] {
  return rows.filter((row) => row.rank <= limit);
}

export function selectBottomLeaderboardRows<T extends { rank: number }>(rows: readonly T[], limit = 5): T[] {
  const ranks = [...new Set(rows.map((row) => row.rank))].sort((left, right) => left - right);
  const boundary = ranks[Math.max(0, ranks.length - limit)];
  return boundary === undefined ? [] : rows.filter((row) => row.rank >= boundary);
}
