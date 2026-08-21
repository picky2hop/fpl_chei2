import { buildEntryGameweekScoreRows, buildEntryScoreRequestIds, buildMembershipSnapshotRows, deduplicateLeagueMembers } from "./league-normalizers.ts";
import type { FantasyLeagueRepository } from "./repository.ts";
import type { FantasyFplProvider, FantasyPlayerStatInsert, FplEntryHistoryEvent } from "./types.ts";
import type { FantasyLeagueMembershipInsert, FantasyLeagueSyncLeague, FantasyLeagueSyncWriteResult, LeagueMemberSource } from "./league-types.ts";
import { normalizePlayerSnapshot } from "./normalizers.ts";

export type FantasyLeagueSyncJobStart = {
  jobType: "fantasy_sync";
  seasonId: string;
  startedAt: string;
};

export type FantasyLeagueSyncJobFinish = {
  id: string;
  status: "succeeded" | "failed";
  finishedAt: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
};

export type FantasyLeagueSyncDependencies = {
  now: () => Date;
  seasonId: string;
  gameweeks: Array<{ id: string; number: number }>;
  provider: FantasyFplProvider;
  repository: Pick<FantasyLeagueRepository, "listActiveLeagues" | "applyLeagueSync">;
  createJob: (input: FantasyLeagueSyncJobStart) => Promise<{ id: string }>;
  finishJob: (input: FantasyLeagueSyncJobFinish) => Promise<void>;
};

export type FantasyLeagueSyncResult = {
  jobRunId: string;
  currentGameweek: number | null;
  leaguesUpserted: number;
  membershipsUpserted: number;
  scoresUpserted: number;
  playersUpserted: number;
  stale: boolean;
  message: string | null;
};

const staleMessage = "ยังไม่สามารถอัปเดตข้อมูล Fantasy ล่าสุดได้";

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  async function consume(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => consume()));
  return results;
}

function scoreHistoryRows(input: {
  seasonId: string;
  gameweekIds: Map<number, string>;
  members: ReturnType<typeof deduplicateLeagueMembers>;
  histories: Map<number, FplEntryHistoryEvent[]>;
  syncedAt: string;
}) {
  return buildEntryGameweekScoreRows({
    seasonId: input.seasonId,
    gameweekIdByNumber: input.gameweekIds,
    historyByEntry: input.histories,
    membersByEntry: new Map(input.members.map((member) => [member.entryId, { teamName: member.teamName, managerName: member.managerName }])),
    syncedAt: input.syncedAt,
  });
}

export async function runFantasyLeagueSync(dependencies: FantasyLeagueSyncDependencies): Promise<FantasyLeagueSyncResult> {
  const startedAt = dependencies.now().toISOString();
  const job = await dependencies.createJob({ jobType: "fantasy_sync", seasonId: dependencies.seasonId, startedAt });
  const baseResult = { jobRunId: job.id, leaguesUpserted: 0, membershipsUpserted: 0, scoresUpserted: 0, playersUpserted: 0, stale: true, message: staleMessage };

  try {
    const [bootstrap, leagues] = await Promise.all([
      dependencies.provider.getBootstrap(),
      dependencies.repository.listActiveLeagues(dependencies.seasonId),
    ]);
    const currentGameweek = dependencies.gameweeks.find((gameweek) => gameweek.number === bootstrap.currentGameweek);
    if (!currentGameweek) throw new Error("Fantasy current gameweek is unavailable");
    if (leagues.length === 0) throw new Error("Fantasy has no active leagues");

    const syncedAt = dependencies.now().toISOString();
    const fetchedLeagues = await mapWithConcurrency(leagues, 4, async (league) => {
      const [summary, members] = await Promise.all([
        dependencies.provider.getLeague(league.fpl_league_id),
        dependencies.provider.getLeagueMembers(league.fpl_league_id),
      ]);
      return { league, summary, members };
    });
    const sources: LeagueMemberSource[] = fetchedLeagues.map(({ league, members }) => ({ leagueId: league.id, members }));
    const membershipRows: FantasyLeagueMembershipInsert[] = buildMembershipSnapshotRows({
      seasonId: dependencies.seasonId,
      gameweekId: currentGameweek.id,
      syncedAt,
      sources,
    });
    const members = deduplicateLeagueMembers(sources);
    const entryIds = buildEntryScoreRequestIds(membershipRows);
    const historyResults = await mapWithConcurrency(entryIds, 4, async (entryId) => ({
      entryId,
      history: await dependencies.provider.getEntryHistory(entryId),
    }));
    const histories = new Map(historyResults.map((result) => [result.entryId, result.history]));
    const gameweekIds = new Map(dependencies.gameweeks.map((gameweek) => [gameweek.number, gameweek.id]));
    const scores = scoreHistoryRows({ seasonId: dependencies.seasonId, gameweekIds, members, histories, syncedAt });
    const players: FantasyPlayerStatInsert[] = normalizePlayerSnapshot({
      seasonId: dependencies.seasonId,
      gameweekId: currentGameweek.id,
      snapshot: bootstrap,
      syncedAt,
    });
    const leagueRows: FantasyLeagueSyncLeague[] = fetchedLeagues.map(({ league, summary }) => ({
      id: league.id,
      season_id: league.season_id,
      fpl_league_id: summary.leagueId,
      official_name: summary.officialName,
      status: league.status,
      archived_at: league.archived_at,
    }));
    const writeResult: FantasyLeagueSyncWriteResult = await dependencies.repository.applyLeagueSync({
      jobRunId: job.id,
      syncedAt,
      leagues: leagueRows,
      memberships: membershipRows,
      scores,
      players,
    });
    const result: FantasyLeagueSyncResult = { ...writeResult, currentGameweek: bootstrap.currentGameweek, stale: false, message: null };
    await dependencies.finishJob({ id: job.id, status: "succeeded", finishedAt: dependencies.now().toISOString(), details: result });
    return result;
  } catch {
    await dependencies.finishJob({ id: job.id, status: "failed", finishedAt: dependencies.now().toISOString(), errorMessage: staleMessage });
    return { ...baseResult, currentGameweek: null };
  }
}
