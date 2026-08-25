import { buildEntryScoreRequestIds, buildMembershipSnapshotRows, deduplicateLeagueMembers } from "./league-normalizers.ts";
import { calculateStartingXiCaptainScore } from "./fantasy-score-calculator.ts";
import { FantasyFplError } from "./fpl-client.ts";
import type { FantasyLeagueRepository } from "./repository.ts";
import type { FantasyFplProvider, FplEntryCurrentSquad, FplEntryHistoryEvent } from "./types.ts";
import type { FantasyLeagueMembershipInsert, FantasyLeagueSyncLeague, FantasyLeagueSyncWriteResult, LeagueMemberSource } from "./league-types.ts";

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
  repository: Pick<FantasyLeagueRepository, "listActiveLeagues" | "listEntryGameweekScores" | "applyLeagueSync">;
  createJob: (input: FantasyLeagueSyncJobStart) => Promise<{ id: string }>;
  finishJob: (input: FantasyLeagueSyncJobFinish) => Promise<void>;
};

export type FantasyScoreSyncFailure = {
  entryId: number;
  gameweek: number;
  reason: string;
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
  failedScoreTargets: FantasyScoreSyncFailure[];
};

const staleMessage = "ยังไม่สามารถอัปเดตข้อมูล Fantasy ล่าสุดได้";

type FantasySyncStage = "bootstrap" | "leagues" | "history" | "write";

type ScoreTarget = {
  entryId: number;
  gameweekNumber: number;
  gameweekId: string;
};

function fantasyFailureReason(error: unknown, stage: FantasySyncStage): string {
  const code = error instanceof FantasyFplError ? error.code : null;
  const detail = code === "FANTASY_FPL_HTTP_403"
    ? "FPL API ปฏิเสธการเข้าถึง"
    : code === "FANTASY_FPL_HTTP_502"
      ? "FPL API ไม่พร้อมให้บริการ"
      : code === "FANTASY_FPL_TIMEOUT"
        ? "FPL API ใช้เวลานานเกินกำหนด"
        : code === "FANTASY_FPL_UNAVAILABLE"
          ? "ไม่สามารถเชื่อมต่อ FPL API ได้"
          : code === "FANTASY_FPL_INVALID_DATA" || code === "FANTASY_FPL_INVALID_JSON"
            ? "ข้อมูล FPL ไม่ถูกต้อง"
            : code === "FANTASY_FPL_NO_GAMEWEEK"
              ? "ไม่พบ Gameweek ปัจจุบันจาก FPL"
              : "ระบบไม่สามารถดำเนินการต่อได้";

  if (stage === "bootstrap") return `โหลดข้อมูลหลัก FPL ไม่สำเร็จ: ${detail}`;
  if (stage === "leagues") return `โหลดข้อมูลลีกหรือสมาชิกจาก FPL ไม่สำเร็จ: ${detail}`;
  if (stage === "history") return `โหลดคะแนน Entry จาก FPL ไม่สำเร็จ: ${detail}`;
  return "บันทึกข้อมูล Fantasy ลงฐานข้อมูลไม่สำเร็จ";
}

function fantasyFailureDetail(error: unknown): string {
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

function buildScoreRow(input: {
  seasonId: string;
  syncedAt: string;
  target: ScoreTarget;
  member: ReturnType<typeof deduplicateLeagueMembers>[number];
  history?: FplEntryHistoryEvent;
  squad: FplEntryCurrentSquad;
}) {
  const calculated = calculateStartingXiCaptainScore([...input.squad.starters, ...input.squad.bench]);
  return {
    season_id: input.seasonId,
    gameweek_id: input.target.gameweekId,
    fpl_entry_id: input.target.entryId,
    fpl_team_name: input.member.teamName,
    fpl_manager_name: input.member.managerName,
    points: calculated.points,
    event_transfers: input.member.eventTransfers ?? input.history?.event_transfers ?? 0,
    event_transfers_cost: input.member.eventTransfersCost ?? input.history?.event_transfers_cost ?? 0,
    points_on_bench: input.history?.points_on_bench ?? 0,
    calculation_method: calculated.calculationMethod,
    source_synced_at: input.syncedAt,
  };
}

function buildScoreTargets(input: {
  members: ReturnType<typeof deduplicateLeagueMembers>;
  histories: Map<number, FplEntryHistoryEvent[]>;
  existing: Array<{ fpl_entry_id: number; gameweek_id: string; calculation_method: "legacy_fpl_history" | "starting_xi_captain_v1" }>;
  gameweekIds: Map<number, string>;
  currentGameweekNumber: number;
}): ScoreTarget[] {
  const existingByKey = new Map(input.existing.map((row) => [`${row.fpl_entry_id}:${row.gameweek_id}`, row.calculation_method]));
  const targets = new Map<string, ScoreTarget>();
  const addTarget = (entryId: number, gameweekNumber: number): void => {
    const gameweekId = input.gameweekIds.get(gameweekNumber);
    if (!gameweekId) return;
    const method = existingByKey.get(`${entryId}:${gameweekId}`);
    if (gameweekNumber !== input.currentGameweekNumber && method === "starting_xi_captain_v1") return;
    targets.set(`${entryId}:${gameweekId}`, { entryId, gameweekNumber, gameweekId });
  };

  for (const member of input.members) {
    for (const event of input.histories.get(member.entryId) ?? []) addTarget(member.entryId, event.event);
    addTarget(member.entryId, input.currentGameweekNumber);
  }
  return [...targets.values()];
}

async function calculateScoreTargets(input: {
  dependencies: FantasyLeagueSyncDependencies;
  targets: ScoreTarget[];
  members: ReturnType<typeof deduplicateLeagueMembers>;
  histories: Map<number, FplEntryHistoryEvent[]>;
  syncedAt: string;
}): Promise<{ scores: Array<ReturnType<typeof buildScoreRow>>; failures: FantasyScoreSyncFailure[] }> {
  const memberByEntry = new Map(input.members.map((member) => [member.entryId, member]));
  const results = await mapWithConcurrency(input.targets, 4, async (target) => {
    try {
      const getEntryPicks = input.dependencies.provider.getEntryPicks;
      if (!getEntryPicks) throw new Error("Entry Picks provider is unavailable");
      const squad = await getEntryPicks(target.entryId, target.gameweekNumber);
      const history = input.histories.get(target.entryId)?.find((event) => event.event === target.gameweekNumber);
      const member = memberByEntry.get(target.entryId);
      if (!member) throw new Error("Fantasy Entry member identity is unavailable");
      return { target, row: buildScoreRow({ seasonId: input.dependencies.seasonId, syncedAt: input.syncedAt, target, member, history, squad }) };
    } catch (error) {
      return { target, failure: { reason: fantasyFailureDetail(error) } };
    }
  });
  return {
    scores: results.filter((result): result is { target: ScoreTarget; row: ReturnType<typeof buildScoreRow> } => "row" in result).map((result) => result.row),
    failures: results.filter((result): result is { target: ScoreTarget; failure: { reason: string } } => "failure" in result).map((result) => ({ entryId: result.target.entryId, gameweek: result.target.gameweekNumber, reason: result.failure.reason })),
  };
}

export async function runFantasyLeagueSync(dependencies: FantasyLeagueSyncDependencies): Promise<FantasyLeagueSyncResult> {
  const startedAt = dependencies.now().toISOString();
  const job = await dependencies.createJob({ jobType: "fantasy_sync", seasonId: dependencies.seasonId, startedAt });
  const baseResult = { jobRunId: job.id, leaguesUpserted: 0, membershipsUpserted: 0, scoresUpserted: 0, playersUpserted: 0, stale: true, message: staleMessage, failedScoreTargets: [] as FantasyScoreSyncFailure[] };
  let stage: FantasySyncStage = "bootstrap";

  try {
    const [bootstrap, leagues] = await Promise.all([
      dependencies.provider.getBootstrap(),
      dependencies.repository.listActiveLeagues(dependencies.seasonId),
    ]);
    const currentGameweek = dependencies.gameweeks.find((gameweek) => gameweek.number === bootstrap.currentGameweek);
    if (!currentGameweek) throw new Error("Fantasy current gameweek is unavailable");
    if (leagues.length === 0) throw new Error("Fantasy has no active leagues");

    const syncedAt = dependencies.now().toISOString();
    stage = "leagues";
    const fetchedLeagues = await mapWithConcurrency(leagues, 4, async (league) => {
      const [summary, members] = await Promise.all([
        dependencies.provider.getLeague(league.fpl_league_id),
        dependencies.provider.getLeagueMembers(league.fpl_league_id),
      ]);
      return { league, summary, members };
    });
    const sources: LeagueMemberSource[] = fetchedLeagues.map(({ league, members }) => ({ leagueId: league.id, members }));
    const membershipRows: FantasyLeagueMembershipInsert[] = buildMembershipSnapshotRows({ seasonId: dependencies.seasonId, gameweekId: currentGameweek.id, syncedAt, sources });
    const members = deduplicateLeagueMembers(sources);
    const entryIds = buildEntryScoreRequestIds(membershipRows);
    stage = "history";
    const historyResults = await mapWithConcurrency(entryIds, 4, async (entryId) => ({ entryId, history: await dependencies.provider.getEntryHistory(entryId) }));
    const histories = new Map(historyResults.map((result) => [result.entryId, result.history]));
    const gameweekIds = new Map(dependencies.gameweeks.map((gameweek) => [gameweek.number, gameweek.id]));
    const existingScores = await dependencies.repository.listEntryGameweekScores(dependencies.seasonId);
    const targets = buildScoreTargets({ members, histories, existing: existingScores, gameweekIds, currentGameweekNumber: bootstrap.currentGameweek });
    const calculated = await calculateScoreTargets({ dependencies, targets, members, histories, syncedAt });
    const leagueRows: FantasyLeagueSyncLeague[] = fetchedLeagues.map(({ league, summary }) => ({ id: league.id, season_id: league.season_id, fpl_league_id: summary.leagueId, official_name: summary.officialName, status: league.status, archived_at: league.archived_at }));
    stage = "write";
    const writeResult: FantasyLeagueSyncWriteResult = await dependencies.repository.applyLeagueSync({ jobRunId: job.id, syncedAt, leagues: leagueRows, memberships: membershipRows, scores: calculated.scores, players: [] });
    const result: FantasyLeagueSyncResult = {
      ...writeResult,
      currentGameweek: bootstrap.currentGameweek,
      stale: false,
      message: `ซิงก์สำเร็จ: ลีก ${writeResult.leaguesUpserted}, สมาชิก ${writeResult.membershipsUpserted}, คะแนน ${writeResult.scoresUpserted}, นักเตะ ${writeResult.playersUpserted}${calculated.failures.length > 0 ? `, ล้มเหลว ${calculated.failures.length} รายการ` : ""}`,
      failedScoreTargets: calculated.failures,
    };
    await dependencies.finishJob({ id: job.id, status: "succeeded", finishedAt: dependencies.now().toISOString(), details: result });
    return result;
  } catch (error) {
    const reason = fantasyFailureReason(error, stage);
    await dependencies.finishJob({ id: job.id, status: "failed", finishedAt: dependencies.now().toISOString(), errorMessage: reason });
    return { ...baseResult, currentGameweek: null, message: reason };
  }
}
