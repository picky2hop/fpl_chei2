import { FantasyFplError } from "./fpl-client.ts";
import { normalizePlayerSnapshot } from "./normalizers.ts";
import type { FantasyLeagueRepository } from "./repository.ts";
import type { FantasyPlayerStatInsert, FantasyFplProvider } from "./types.ts";

type FantasyPlayerStatsSyncDependencies = {
  now: () => Date;
  seasonId: string;
  gameweeks: Array<{ id: string; number: number }>;
  provider: FantasyFplProvider;
  repository: Pick<FantasyLeagueRepository, "applyPlayerStatsSync">;
  createJob: (input: { jobType: "fantasy_player_stats_sync"; seasonId: string; startedAt: string }) => Promise<{ id: string }>;
  finishJob: (input: { id: string; status: "succeeded" | "failed"; finishedAt: string; details?: Record<string, unknown>; errorMessage?: string }) => Promise<void>;
};

export type FantasyPlayerStatsSyncResult = {
  jobRunId: string;
  currentGameweek: number | null;
  playersUpserted: number;
  stale: boolean;
  message: string | null;
};

function safeReason(error: unknown): string {
  const code = error instanceof FantasyFplError ? error.code : null;
  if (code === "FANTASY_FPL_HTTP_403") return "FPL API ปฏิเสธการเข้าถึง";
  if (code === "FANTASY_FPL_HTTP_502") return "FPL API ไม่พร้อมให้บริการ";
  if (code === "FANTASY_FPL_TIMEOUT") return "FPL API ใช้เวลานานเกินกำหนด";
  if (code === "FANTASY_FPL_UNAVAILABLE") return "ไม่สามารถเชื่อมต่อ FPL API ได้";
  if (code === "FANTASY_FPL_INVALID_DATA" || code === "FANTASY_FPL_INVALID_JSON") return "ข้อมูล FPL ไม่ถูกต้อง";
  return "ไม่สามารถซิงก์สถิตินักเตะได้";
}

export async function runFantasyPlayerStatsSync(dependencies: FantasyPlayerStatsSyncDependencies): Promise<FantasyPlayerStatsSyncResult> {
  const startedAt = dependencies.now().toISOString();
  const job = await dependencies.createJob({ jobType: "fantasy_player_stats_sync", seasonId: dependencies.seasonId, startedAt });
  const base = { jobRunId: job.id, currentGameweek: null, playersUpserted: 0, stale: true, message: "ยังไม่สามารถอัปเดตสถิตินักเตะล่าสุดได้" };
  try {
    const bootstrap = await dependencies.provider.getBootstrap();
    const currentGameweek = dependencies.gameweeks.find((gameweek) => gameweek.number === bootstrap.currentGameweek);
    if (!currentGameweek) throw new Error("Fantasy current gameweek is unavailable");
    const syncedAt = dependencies.now().toISOString();
    const players: FantasyPlayerStatInsert[] = normalizePlayerSnapshot({ seasonId: dependencies.seasonId, gameweekId: currentGameweek.id, snapshot: bootstrap, syncedAt });
    const writeResult = await dependencies.repository.applyPlayerStatsSync({ jobRunId: job.id, syncedAt, players });
    const result = { jobRunId: job.id, currentGameweek: bootstrap.currentGameweek, playersUpserted: writeResult.playersUpserted, stale: false, message: `ซิงก์สถิตินักเตะสำเร็จ ${writeResult.playersUpserted} รายการ` };
    await dependencies.finishJob({ id: job.id, status: "succeeded", finishedAt: dependencies.now().toISOString(), details: result });
    return result;
  } catch (error) {
    const reason = safeReason(error);
    await dependencies.finishJob({ id: job.id, status: "failed", finishedAt: dependencies.now().toISOString(), errorMessage: reason });
    return { ...base, message: reason };
  }
}
