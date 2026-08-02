import "server-only";

import type { Json } from "@/lib/db/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchFplSnapshot } from "./fpl-client";
import { runFplSync, type SyncMode, type SyncResult } from "./sync-runner";
import { SyncFailure } from "./sync-errors";
import { createSupabaseSyncRepository, type AtomicSyncClient } from "./supabase-sync-repository";

export type { SyncMode, SyncResult } from "./sync-runner";

export async function syncFplData(mode: SyncMode): Promise<SyncResult> {
  const admin = getSupabaseAdmin();
  const repository = createSupabaseSyncRepository(admin as unknown as AtomicSyncClient);

  return runFplSync(mode, {
    now: () => new Date(),
    createRunId: () => crypto.randomUUID(),
    createJob: async ({ idempotencyKey, mode: jobMode, startedAt }) => {
      const { data, error } = await admin.from("job_runs").insert({
        idempotency_key: idempotencyKey,
        job_type: "fixture_sync",
        mode: jobMode,
        scope: "active_season",
        source: "fpl_api",
        source_name: "fpl_api",
        status: "running",
        started_at: startedAt,
        details: { phase: "started" },
      }).select("id").single();
      if (error || !data) {
        throw new SyncFailure("SYNC_DATABASE_ERROR", "Unable to start sync job");
      }
      return data;
    },
    fetchSnapshot: () => fetchFplSnapshot(),
    applySnapshot: repository.applySnapshot,
    failJob: async ({ jobRunId, finishedAt, code, message, details }) => {
      const { error } = await admin.from("job_runs").update({
        status: "failed",
        finished_at: finishedAt,
        error_code: code,
        error_message: message,
        details: details as Json,
      }).eq("id", jobRunId).eq("status", "running");
      if (error) throw new SyncFailure("SYNC_DATABASE_ERROR", "Unable to finalize sync job");
    },
  });
}
