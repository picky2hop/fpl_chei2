import { normalizeEntryHistory, normalizePlayerSnapshot } from "./normalizers.ts";
import type { FantasyRepository } from "./repository.ts";
import type { FantasyFplProvider, FantasyGameweekScoreInsert, FantasyPlayerStatInsert, FplEntryHistoryEvent } from "./types.ts";

export type FantasySyncJobStart = {
  jobType: "fantasy_sync";
  seasonId: string;
  startedAt: string;
};

export type FantasySyncJobFinish = {
  id: string;
  status: "succeeded" | "failed";
  finishedAt: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
};

export type FantasySyncDependencies = {
  now: () => Date;
  seasonId: string;
  gameweeks: Array<{ id: string; number: number }>;
  provider: FantasyFplProvider;
  repository: FantasyRepository;
  createJob: (input: FantasySyncJobStart) => Promise<{ id: string }>;
  finishJob: (input: FantasySyncJobFinish) => Promise<void>;
};

export type FantasySyncResult = {
  jobRunId: string;
  currentGameweek: number | null;
  scoresUpserted: number;
  playersUpserted: number;
  mappingsUpdated: number;
  failedMappings: number[];
  stale: boolean;
  message: string | null;
};

const staleMessage = "ยังไม่สามารถอัปเดตข้อมูล Fantasy ล่าสุดได้";
const mappingErrorMessage = "ไม่สามารถอ่านข้อมูล FPL Entry นี้ได้";

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

function safeHistoryResult(value: unknown): value is FplEntryHistoryEvent[] {
  return Array.isArray(value);
}

export async function runFantasySync(dependencies: FantasySyncDependencies): Promise<FantasySyncResult> {
  const startedAt = dependencies.now().toISOString();
  const job = await dependencies.createJob({ jobType: "fantasy_sync", seasonId: dependencies.seasonId, startedAt });
  const mappings = await dependencies.repository.listActiveMappings(dependencies.seasonId);
  const syncedAt = dependencies.now().toISOString();

  try {
    const bootstrap = await dependencies.provider.getBootstrap();
    const currentGameweek = dependencies.gameweeks.find((gameweek) => gameweek.number === bootstrap.currentGameweek);
    if (!currentGameweek) throw new Error("Fantasy current gameweek is unavailable");

    const historyResults = await mapWithConcurrency(mappings, 4, async (mapping) => {
      try {
        const history = await dependencies.provider.getEntryHistory(mapping.fpl_entry_id);
        return { mapping, history, error: null as string | null };
      } catch {
        return { mapping, history: [] as FplEntryHistoryEvent[], error: mappingErrorMessage };
      }
    });

    const gameweekIds = new Map(dependencies.gameweeks.map((gameweek) => [gameweek.number, gameweek.id]));
    const scores: FantasyGameweekScoreInsert[] = historyResults.flatMap((result) => safeHistoryResult(result.history)
      ? normalizeEntryHistory({
        seasonId: dependencies.seasonId,
        mappingId: result.mapping.id,
        gameweekIdByNumber: gameweekIds,
        history: result.history,
        syncedAt,
      })
      : []);
    const players: FantasyPlayerStatInsert[] = normalizePlayerSnapshot({
      seasonId: dependencies.seasonId,
      gameweekId: currentGameweek.id,
      snapshot: bootstrap,
      syncedAt,
    });
    const mappingResults = historyResults.map((result) => ({
      mapping_id: result.mapping.id,
      last_validation_status: result.error ? "error" : "valid",
      last_error_message: result.error,
      fpl_team_name: null,
      fpl_manager_name: null,
    }));
    const writeResult = await dependencies.repository.applySync({
      jobRunId: job.id,
      syncedAt,
      scores,
      players,
      mappingResults,
    });
    const failedMappings = historyResults
      .filter((result) => result.error)
      .map((result) => result.mapping.fpl_entry_id);
    const result: FantasySyncResult = {
      jobRunId: job.id,
      currentGameweek: bootstrap.currentGameweek,
      scoresUpserted: writeResult.scoresUpserted,
      playersUpserted: writeResult.playersUpserted,
      mappingsUpdated: writeResult.mappingsUpdated,
      failedMappings,
      stale: failedMappings.length > 0,
      message: failedMappings.length > 0 ? staleMessage : null,
    };
    await dependencies.finishJob({
      id: job.id,
      status: "succeeded",
      finishedAt: dependencies.now().toISOString(),
      details: result,
    });
    return result;
  } catch {
    await dependencies.finishJob({
      id: job.id,
      status: "failed",
      finishedAt: dependencies.now().toISOString(),
      errorMessage: staleMessage,
    });
    return {
      jobRunId: job.id,
      currentGameweek: null,
      scoresUpserted: 0,
      playersUpserted: 0,
      mappingsUpdated: 0,
      failedMappings: [],
      stale: true,
      message: staleMessage,
    };
  }
}
