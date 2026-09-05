import { calculateStartingXiCaptainScore } from "./fantasy-score-calculator.ts";
import { FantasyFplError } from "./fpl-client.ts";
import type { FantasyLeagueRepository } from "./repository.ts";
import type { FantasyEntryGameweekScoreInsert, FantasyLeagueMembershipInsert } from "./league-types.ts";
import type { FantasyFplProvider, FplEntryHistoryEvent, FplEntrySummary } from "./types.ts";

type ScoreRecalculationDependencies = {
  now: () => Date;
  seasonId: string;
  gameweeks: Array<{ id: string; number: number }>;
  provider: FantasyFplProvider;
  repository: Pick<FantasyLeagueRepository, "listActiveLeagues" | "listLeagueEntryIds" | "listEntryGameweekScores" | "applyScoreRecalculation">;
  createJob: (input: { jobType: "fantasy_score_recalculation"; seasonId: string; startedAt: string }) => Promise<{ id: string }>;
  finishJob: (input: { id: string; status: "succeeded" | "failed"; finishedAt: string; details?: Record<string, unknown>; errorMessage?: string }) => Promise<void>;
};

export type FantasyScoreRecalculationFailure = { entryId: number; gameweek: number; reason: string };

export type FantasyScoreRecalculationResult = {
  jobRunId: string;
  currentGameweek: number | null;
  scoresUpserted: number;
  stale: boolean;
  message: string | null;
  failedScoreTargets: FantasyScoreRecalculationFailure[];
};

type Target = { entryId: number; gameweek: number; gameweekId: string };

function buildHistoricalMemberships(input: {
  seasonId: string;
  syncedAt: string;
  leagues: Array<{ id: string }>;
  entryIdsByLeague: Array<{ leagueId: string; entryIds: number[] }>;
  histories: Map<number, FplEntryHistoryEvent[]>;
  summaries: Map<number, FplEntrySummary>;
  gameweekIds: Map<number, string>;
}): FantasyLeagueMembershipInsert[] {
  const rows: FantasyLeagueMembershipInsert[] = [];
  const seen = new Set<string>();
  for (const league of input.leagues) {
    const entryIds = input.entryIdsByLeague.find((item) => item.leagueId === league.id)?.entryIds ?? [];
    for (const entryId of entryIds) {
      const summary = input.summaries.get(entryId);
      if (!summary) continue;
      for (const event of input.histories.get(entryId) ?? []) {
        const gameweekId = input.gameweekIds.get(event.event);
        if (!gameweekId) continue;
        const key = `${league.id}:${gameweekId}:${entryId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          season_id: input.seasonId,
          league_id: league.id,
          gameweek_id: gameweekId,
          fpl_entry_id: entryId,
          fpl_team_name: summary.teamName,
          fpl_manager_name: summary.managerName,
          source_synced_at: input.syncedAt,
        });
      }
    }
  }
  return rows;
}

function failureReason(error: unknown): string {
  const code = error instanceof FantasyFplError ? error.code : null;
  if (code === "FANTASY_FPL_HTTP_403") return "FPL API ปฏิเสธการเข้าถึง";
  if (code === "FANTASY_FPL_HTTP_502") return "FPL API ไม่พร้อมให้บริการ";
  if (code === "FANTASY_FPL_TIMEOUT") return "FPL API ใช้เวลานานเกินกำหนด";
  if (code === "FANTASY_FPL_UNAVAILABLE") return "ไม่สามารถเชื่อมต่อ FPL API ได้";
  if (code === "FANTASY_FPL_INVALID_DATA" || code === "FANTASY_FPL_INVALID_JSON") return "ข้อมูล FPL ไม่ถูกต้อง";
  return "ไม่สามารถอ่าน Picks ของ Entry/GW นี้ได้";
}

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

function buildTargets(input: {
  entryIds: number[];
  histories: Map<number, FplEntryHistoryEvent[]>;
  existing: Array<{ fpl_entry_id: number; gameweek_id: string; calculation_method: "legacy_fpl_history" | "starting_xi_captain_v1" | "starting_xi_captain_v2" }>;
  gameweekIds: Map<number, string>;
}): Target[] {
  const existingByKey = new Map(input.existing.map((row) => [`${row.fpl_entry_id}:${row.gameweek_id}`, row.calculation_method]));
  const targets = new Map<string, Target>();
  for (const entryId of input.entryIds) {
    for (const event of input.histories.get(entryId) ?? []) {
      const gameweekId = input.gameweekIds.get(event.event);
      if (!gameweekId || existingByKey.get(`${entryId}:${gameweekId}`) === "starting_xi_captain_v2") continue;
      targets.set(`${entryId}:${gameweekId}`, { entryId, gameweek: event.event, gameweekId });
    }
  }
  return [...targets.values()];
}

function buildRow(input: {
  seasonId: string;
  syncedAt: string;
  target: Target;
  summary: FplEntrySummary;
  history?: FplEntryHistoryEvent;
  squad: Awaited<ReturnType<NonNullable<FantasyFplProvider["getEntryPicks"]>>>;
}): FantasyEntryGameweekScoreInsert {
  const calculation = calculateStartingXiCaptainScore([...input.squad.starters, ...input.squad.bench]);
  return {
    season_id: input.seasonId,
    gameweek_id: input.target.gameweekId,
    fpl_entry_id: input.target.entryId,
    fpl_team_name: input.summary.teamName,
    fpl_manager_name: input.summary.managerName,
    points: calculation.points,
    event_transfers: input.history?.event_transfers ?? 0,
    event_transfers_cost: input.history?.event_transfers_cost ?? 0,
    points_on_bench: input.history?.points_on_bench ?? 0,
    calculation_method: calculation.calculationMethod,
    source_synced_at: input.syncedAt,
  };
}

export async function runFantasyScoreRecalculation(dependencies: ScoreRecalculationDependencies): Promise<FantasyScoreRecalculationResult> {
  const startedAt = dependencies.now().toISOString();
  const job = await dependencies.createJob({ jobType: "fantasy_score_recalculation", seasonId: dependencies.seasonId, startedAt });
  const base = { jobRunId: job.id, currentGameweek: null, scoresUpserted: 0, stale: true, message: "ยังไม่สามารถคำนวณคะแนน Fantasy ใหม่ได้", failedScoreTargets: [] as FantasyScoreRecalculationFailure[] };
  try {
    const bootstrap = await dependencies.provider.getBootstrap();
    const currentGameweek = dependencies.gameweeks.find((gameweek) => gameweek.number === bootstrap.currentGameweek);
    if (!currentGameweek) throw new Error("Fantasy current gameweek is unavailable");
    const leagues = await dependencies.repository.listActiveLeagues(dependencies.seasonId);
    const entryIdsByLeague = await mapWithConcurrency(leagues, 4, async (league) => ({
      leagueId: league.id,
      entryIds: await dependencies.repository.listLeagueEntryIds({ seasonId: dependencies.seasonId, leagueId: league.id, gameweekId: currentGameweek.id }),
    }));
    const existing = await dependencies.repository.listEntryGameweekScores(dependencies.seasonId);
    const entryIds = [...new Set([...existing.map((row) => row.fpl_entry_id), ...entryIdsByLeague.flatMap((item) => item.entryIds)])];
    const historyResults = await mapWithConcurrency(entryIds, 4, async (entryId) => ({ entryId, history: await dependencies.provider.getEntryHistory(entryId) }));
    const histories = new Map(historyResults.map((result) => [result.entryId, result.history]));
    const gameweekIds = new Map(dependencies.gameweeks.map((gameweek) => [gameweek.number, gameweek.id]));
    const targets = buildTargets({ entryIds, histories, existing, gameweekIds });
    const summaries = new Map(await mapWithConcurrency(entryIds, 4, async (entryId) => [entryId, await dependencies.provider.getEntrySummary(entryId)] as const));
    const memberships = buildHistoricalMemberships({ seasonId: dependencies.seasonId, syncedAt: dependencies.now().toISOString(), leagues, entryIdsByLeague, histories, summaries, gameweekIds });
    const results = await mapWithConcurrency(targets, 4, async (target) => {
      try {
        const getEntryPicks = dependencies.provider.getEntryPicks;
        if (!getEntryPicks) throw new Error("Entry Picks provider is unavailable");
        const squad = await getEntryPicks(target.entryId, target.gameweek);
        const summary = summaries.get(target.entryId);
        if (!summary) throw new Error("Fantasy Entry summary is unavailable");
        return { target, row: buildRow({ seasonId: dependencies.seasonId, syncedAt: dependencies.now().toISOString(), target, summary, history: histories.get(target.entryId)?.find((event) => event.event === target.gameweek), squad }) };
      } catch (error) {
        return { target, failure: { entryId: target.entryId, gameweek: target.gameweek, reason: failureReason(error) } };
      }
    });
    const scores = results.filter((result): result is { target: Target; row: FantasyEntryGameweekScoreInsert } => "row" in result).map((result) => result.row);
    const failures = results.filter((result): result is { target: Target; failure: FantasyScoreRecalculationFailure } => "failure" in result).map((result) => result.failure);
    const writeResult = await dependencies.repository.applyScoreRecalculation({ jobRunId: job.id, memberships, scores });
    const result = { jobRunId: job.id, currentGameweek: bootstrap.currentGameweek, scoresUpserted: writeResult.scoresUpserted, stale: false, message: `คำนวณคะแนนสำเร็จ ${writeResult.scoresUpserted} รายการ${failures.length > 0 ? `, ล้มเหลว ${failures.length} รายการ` : ""}`, failedScoreTargets: failures };
    await dependencies.finishJob({ id: job.id, status: "succeeded", finishedAt: dependencies.now().toISOString(), details: result });
    return result;
  } catch (error) {
    const reason = failureReason(error);
    await dependencies.finishJob({ id: job.id, status: "failed", finishedAt: dependencies.now().toISOString(), errorMessage: reason });
    return { ...base, message: reason };
  }
}
