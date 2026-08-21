export type LeagueMembershipRow = {
  league_id: string;
  gameweek_id: string;
  fpl_entry_id: number;
  fpl_team_name: string;
  fpl_manager_name: string;
};

export type EntryScoreRow = {
  fpl_entry_id: number;
  gameweek_id: string;
  gameweek_number: number;
  points: number;
};

export type LeagueMappingIdentity = {
  fpl_entry_id: number;
  app_user_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type LeagueLeaderboardRow = {
  rank: number;
  fplEntryId: number;
  teamName: string;
  managerName: string;
  points: number;
  mapped: boolean;
  appUserId: string | null;
  displayName: string;
  avatarUrl: string | null;
};

function scoreForEntry(input: {
  scores: EntryScoreRow[];
  entryId: number;
  selectedGameweekId: string;
  selectedGameweekNumber: number;
  mode: "gameweek" | "season";
}): number {
  return input.scores
    .filter((score) => score.fpl_entry_id === input.entryId)
    .filter((score) => input.mode === "season"
      ? score.gameweek_number <= input.selectedGameweekNumber
      : score.gameweek_id === input.selectedGameweekId)
    .reduce((total, score) => total + score.points, 0);
}

export function rankCompetition(rows: Array<{ points: number }>): number[] {
  let previousPoints: number | null = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = previousPoints === row.points ? previousRank : index + 1;
    previousPoints = row.points;
    previousRank = rank;
    return rank;
  });
}

export function buildLeagueLeaderboard(input: {
  members: LeagueMembershipRow[];
  scores: EntryScoreRow[];
  mappings: LeagueMappingIdentity[];
  selectedGameweekId: string;
  selectedGameweekNumber: number;
  mode: "gameweek" | "season";
}): LeagueLeaderboardRow[] {
  const mappingByEntry = new Map(input.mappings.map((mapping) => [mapping.fpl_entry_id, mapping]));
  const uniqueMembers = [...new Map(input.members.map((member) => [member.fpl_entry_id, member])).values()];
  const rows = uniqueMembers.map((member) => {
    const mapping = mappingByEntry.get(member.fpl_entry_id);
    return {
      rank: 0,
      fplEntryId: member.fpl_entry_id,
      teamName: member.fpl_team_name,
      managerName: member.fpl_manager_name,
      points: scoreForEntry({ ...input, entryId: member.fpl_entry_id }),
      mapped: Boolean(mapping),
      appUserId: mapping?.app_user_id ?? null,
      displayName: mapping?.display_name ?? member.fpl_team_name,
      avatarUrl: mapping?.avatar_url ?? null,
    } satisfies LeagueLeaderboardRow;
  }).sort((left, right) => right.points - left.points || left.fplEntryId - right.fplEntryId);

  const ranks = rankCompetition(rows);
  return rows.map((row, index) => ({ ...row, rank: ranks[index] }));
}
