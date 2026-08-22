export const DEFAULT_FANTASY_LEAGUE_ID = 819498;

export type FantasyLeagueSelectionOption = {
  id: string;
  fpl_league_id: number;
  status: "active" | "archived";
};

export function selectDefaultFantasyLeague(
  leagues: FantasyLeagueSelectionOption[],
): string | null {
  return leagues.find(
    (league) =>
      league.status === "active" &&
      league.fpl_league_id === DEFAULT_FANTASY_LEAGUE_ID,
  )?.id
    ?? leagues.find((league) => league.status === "active")?.id
    ?? null;
}
