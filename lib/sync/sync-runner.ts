import type { FplSnapshot } from "./fpl-core.ts";
import { toSafeSyncFailure, type SafeSyncDetails, type SyncFailureCode } from "./sync-errors.ts";

export type SyncMode = "scheduled" | "manual";

export type SyncResult = {
  jobRunId: string;
  teamsUpserted: number;
  gameweeksUpserted: number;
  fixturesUpserted: number;
  movedFixtureIds: string[];
  affectedGameweekIds: string[];
};

export type SyncRunnerDependencies = {
  now: () => Date;
  createRunId: () => string;
  createJob: (input: {
    idempotencyKey: string;
    mode: SyncMode;
    startedAt: string;
  }) => Promise<{ id: string }>;
  fetchSnapshot: () => Promise<FplSnapshot>;
  applySnapshot: (input: {
    jobRunId: string;
    snapshot: FplSnapshot;
    syncedAt: string;
  }) => Promise<SyncResult>;
  failJob: (input: {
    jobRunId: string;
    finishedAt: string;
    code: SyncFailureCode;
    message: string;
    details: SafeSyncDetails;
  }) => Promise<void>;
};

export async function runFplSync(mode: SyncMode, dependencies: SyncRunnerDependencies): Promise<SyncResult> {
  const startedAt = dependencies.now().toISOString();
  const job = await dependencies.createJob({
    idempotencyKey: `fpl:${mode}:${dependencies.createRunId()}`,
    mode,
    startedAt,
  });

  try {
    const snapshot = await dependencies.fetchSnapshot();
    return await dependencies.applySnapshot({ jobRunId: job.id, snapshot, syncedAt: startedAt });
  } catch (error) {
    const failure = toSafeSyncFailure(error);
    try {
      await dependencies.failJob({
        jobRunId: job.id,
        finishedAt: dependencies.now().toISOString(),
        code: failure.code,
        message: failure.message,
        details: failure.details,
      });
    } catch {
      // Preserve the original safe failure when job finalization is unavailable.
    }
    throw failure;
  }
}
