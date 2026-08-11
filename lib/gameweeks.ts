export type GameweekState = "current" | "past" | "future";

export function getCurrentGameweekId(
  gameweeks: Array<{ id: number; state: GameweekState }>,
): number | null {
  return gameweeks.find((gameweek) => gameweek.state === "current")?.id ?? gameweeks[0]?.id ?? null;
}
