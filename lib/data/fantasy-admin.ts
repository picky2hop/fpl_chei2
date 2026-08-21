import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/db/types";
import { createFantasyFplProvider } from "@/lib/fantasy/fpl-client";
import { createFantasyRepository } from "@/lib/fantasy/repository";
import { runFantasyLeagueSync, type FantasyLeagueSyncJobFinish } from "@/lib/fantasy/league-sync-service";

export function getFantasyAdminRepository() {
  return createFantasyRepository(getSupabaseAdmin());
}

export function getFantasyAdminProvider() {
  return createFantasyFplProvider();
}

export async function listFantasyAdminUsers() {
  const { data, error } = await getSupabaseAdmin().from("app_users").select("id,display_name,status").order("display_name");
  if (error || !data) throw new Error("Fantasy users are unavailable");
  return data.map((user) => ({ id: user.id, displayName: user.display_name, status: user.status }));
}

export async function runAdminFantasySync() {
  const repository = getFantasyAdminRepository();
  const provider = getFantasyAdminProvider();
  const season = await repository.getActiveSeason();
  const dashboard = await repository.getDashboard({ seasonId: season.id });
  return runFantasyLeagueSync({
    now: () => new Date(),
    seasonId: season.id,
    gameweeks: dashboard.gameweeks.map((gameweek) => ({ id: gameweek.id, number: gameweek.number })),
    provider,
    repository,
    createJob: async (input) => {
      const { data, error } = await getSupabaseAdmin().from("job_runs").insert({
        source_name: "fpl_api",
        scope: "fantasy",
        idempotency_key: `${input.jobType}:${input.seasonId}:${input.startedAt}:${crypto.randomUUID()}`,
        status: "running",
        started_at: input.startedAt,
        job_type: input.jobType,
        mode: "manual",
        source: "fpl_api",
      }).select("id").single();
      if (error || !data) throw new Error("Fantasy job could not start");
      return { id: data.id };
    },
    finishJob: async (input: FantasyLeagueSyncJobFinish) => {
      const { error } = await getSupabaseAdmin().from("job_runs").update({
        status: input.status,
        finished_at: input.finishedAt,
        error_message: input.errorMessage ?? null,
        details: (input.details ?? {}) as Json,
      }).eq("id", input.id);
      if (error) throw new Error("Fantasy job could not finish");
    },
  });
}
