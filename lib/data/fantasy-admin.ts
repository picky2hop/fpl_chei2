import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/db/types";
import { createFantasyFplProvider } from "@/lib/fantasy/fpl-client";
import { createFantasyRepository } from "@/lib/fantasy/repository";
import { runFantasyLeagueSync, type FantasyLeagueSyncJobFinish } from "@/lib/fantasy/league-sync-service";
import { runFantasyPlayerStatsSync } from "@/lib/fantasy/player-stats-sync-service";
import { runFantasyScoreRecalculation } from "@/lib/fantasy/score-recalculation-service";

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

type FantasyAdminJobStart = { jobType: string; mode?: "manual" | "scheduled"; seasonId: string; startedAt: string };
type FantasyAdminJobFinish = { id: string; status: "succeeded" | "failed"; finishedAt: string; details?: Record<string, unknown>; errorMessage?: string };

async function createFantasyAdminJob(input: FantasyAdminJobStart): Promise<{ id: string }> {
  const { data, error } = await getSupabaseAdmin().from("job_runs").insert({
    source_name: "fpl_api",
    scope: "fantasy",
    idempotency_key: `${input.jobType}:${input.seasonId}:${input.startedAt}:${crypto.randomUUID()}`,
    status: "running",
    started_at: input.startedAt,
    job_type: input.jobType,
    mode: input.mode ?? "manual",
    source: "fpl_api",
  }).select("id").single();
  if (error || !data) throw new Error("Fantasy job could not start");
  return { id: data.id };
}

async function finishFantasyAdminJob(input: FantasyAdminJobFinish): Promise<void> {
  const { error } = await getSupabaseAdmin().from("job_runs").update({
    status: input.status,
    finished_at: input.finishedAt,
    error_message: input.errorMessage ?? null,
    details: (input.details ?? {}) as Json,
  }).eq("id", input.id);
  if (error) throw new Error("Fantasy job could not finish");
}

export async function runAdminFantasyPlayerStatsSync(mode: "manual" | "scheduled" = "manual") {
  const repository = getFantasyAdminRepository();
  const provider = getFantasyAdminProvider();
  const season = await repository.getActiveSeason();
  const dashboard = await repository.getDashboard({ seasonId: season.id });
  return runFantasyPlayerStatsSync({
    now: () => new Date(),
    mode,
    seasonId: season.id,
    gameweeks: dashboard.gameweeks.map((gameweek) => ({ id: gameweek.id, number: gameweek.number })),
    provider,
    repository,
    createJob: createFantasyAdminJob,
    finishJob: finishFantasyAdminJob,
  });
}

export async function runAdminFantasyScoreRecalculation() {
  const repository = getFantasyAdminRepository();
  const provider = getFantasyAdminProvider();
  const season = await repository.getActiveSeason();
  const dashboard = await repository.getDashboard({ seasonId: season.id });
  return runFantasyScoreRecalculation({
    now: () => new Date(),
    seasonId: season.id,
    gameweeks: dashboard.gameweeks.map((gameweek) => ({ id: gameweek.id, number: gameweek.number })),
    provider,
    repository,
    createJob: createFantasyAdminJob,
    finishJob: finishFantasyAdminJob,
  });
}
