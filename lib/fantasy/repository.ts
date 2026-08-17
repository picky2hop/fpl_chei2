import { normalizePlayerSnapshot } from "./normalizers.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../db/types.ts";
import type { FantasyDashboardInput } from "./dashboard.ts";

export type { FantasyEntryMapping } from "./types.ts";
import type {
  CreateFantasyMappingInput,
  FantasyEntryMapping,
  FantasyGameweekScoreInsert,
  FantasyPlayerStatInsert,
  FantasySyncWriteResult,
  FplPlayerSnapshot,
} from "./types.ts";

export type FantasyMappingIdentity = Pick<
  FantasyEntryMapping,
  "season_id" | "app_user_id" | "fpl_entry_id" | "mapping_status"
>;

export type FantasyRepository = {
  getActiveSeason(): Promise<{ id: string; name: string }>;
  getDashboard(input: { seasonId: string; selectedGameweekNumber?: number }): Promise<FantasyDashboardInput>;
  listActiveMappings(seasonId: string): Promise<FantasyEntryMapping[]>;
  listMappings(seasonId: string): Promise<FantasyEntryMapping[]>;
  createMapping(input: CreateFantasyMappingInput): Promise<FantasyEntryMapping>;
  replaceMapping(mappingId: string, input: CreateFantasyMappingInput): Promise<FantasyEntryMapping>;
  archiveMapping(mappingId: string): Promise<void>;
  applySync(input: {
    jobRunId: string;
    syncedAt: string;
    scores: FantasyGameweekScoreInsert[];
    players: FantasyPlayerStatInsert[];
    mappingResults: Json[];
  }): Promise<FantasySyncWriteResult>;
  replaceAwards(input: { seasonId: string; gameweekId: string; selectedBy: string; awards: Array<{ mappingId: string; award: "champion" | "wooden_spoon" }> }): Promise<void>;
};

type FantasyDatabaseClient = SupabaseClient<Database>;

function mappingFromUnknown(value: unknown): FantasyEntryMapping {
  if (typeof value !== "object" || value === null) throw new Error("Fantasy mapping response is invalid");
  const row = value as Record<string, unknown>;
  const requiredStrings = [
    "id", "season_id", "app_user_id", "fpl_team_name", "fpl_manager_name",
    "mapping_status", "last_validation_status", "linked_at", "created_at", "updated_at",
  ];
  if (requiredStrings.some((key) => typeof row[key] !== "string")) {
    throw new Error("Fantasy mapping response is invalid");
  }
  if (typeof row.fpl_entry_id !== "number") throw new Error("Fantasy mapping response is invalid");
  return row as unknown as FantasyEntryMapping;
}

function syncResultFromUnknown(value: unknown): FantasySyncWriteResult {
  if (typeof value !== "object" || value === null) throw new Error("Fantasy sync response is invalid");
  const row = value as Record<string, unknown>;
  if (typeof row.jobRunId !== "string"
    || typeof row.scoresUpserted !== "number"
    || typeof row.playersUpserted !== "number"
    || typeof row.mappingsUpdated !== "number") {
    throw new Error("Fantasy sync response is invalid");
  }
  return {
    jobRunId: row.jobRunId,
    scoresUpserted: row.scoresUpserted,
    playersUpserted: row.playersUpserted,
    mappingsUpdated: row.mappingsUpdated,
    failedMappings: Array.isArray(row.failedMappings)
      ? row.failedMappings.filter((id): id is number => typeof id === "number")
      : [],
  };
}

export function createFantasyRepository(client: FantasyDatabaseClient): FantasyRepository {
  return {
    async getActiveSeason() {
      const { data, error } = await client.from("seasons").select("id,name").eq("status", "active").maybeSingle();
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data;
    },

    async getDashboard(input) {
      const { data: season, error: seasonError } = await client.from("seasons").select("id,name").eq("id", input.seasonId).maybeSingle();
      if (seasonError || !season) throw new Error("Fantasy database operation failed");
      const { data: gameweeks, error: gameweekError } = await client
        .from("gameweeks")
        .select("id,number,name,is_current,status")
        .eq("season_id", input.seasonId)
        .order("number");
      if (gameweekError || !gameweeks) throw new Error("Fantasy database operation failed");
      const currentGameweek = gameweeks.find((gameweek) => gameweek.is_current)?.number
        ?? [...gameweeks].filter((gameweek) => gameweek.status === "closed" || gameweek.status === "reopened").sort((a, b) => b.number - a.number)[0]?.number
        ?? gameweeks[0]?.number
        ?? 0;
      const currentGameweekId = gameweeks.find((gameweek) => gameweek.number === currentGameweek)?.id;
      if (!currentGameweekId) throw new Error("Fantasy database operation failed");
      const selectedGameweek = gameweeks.find((gameweek) => gameweek.number === input.selectedGameweekNumber)?.number ?? currentGameweek;
      const selectedGameweekId = gameweeks.find((gameweek) => gameweek.number === selectedGameweek)?.id ?? currentGameweekId;
      const [mappingResult, scoreResult, playerResult, awardResult, usersResult, jobResult] = await Promise.all([
        client.from("fantasy_entry_mappings").select("*").eq("season_id", input.seasonId),
        client.from("fantasy_gameweek_scores").select("mapping_id,gameweek_id,points").eq("season_id", input.seasonId),
        client.from("fantasy_player_gameweek_stats").select("*").eq("season_id", input.seasonId).eq("gameweek_id", currentGameweekId),
        client.from("fantasy_awards").select("mapping_id,award").eq("season_id", input.seasonId).eq("gameweek_id", selectedGameweekId),
        client.from("app_users").select("id,display_name,avatar_url"),
        client.from("job_runs").select("status,finished_at,started_at,error_message").eq("job_type", "fantasy_sync").order("started_at", { ascending: false }).limit(20),
      ]);
      if (mappingResult.error || scoreResult.error || playerResult.error || awardResult.error || usersResult.error || jobResult.error) {
        throw new Error("Fantasy database operation failed");
      }
      const usersById = new Map(usersResult.data.map((user) => [user.id, user]));
      const mappings = mappingResult.data.map((mapping) => {
        const user = usersById.get(mapping.app_user_id);
        return {
          id: mapping.id,
          season_id: mapping.season_id,
          app_user_id: mapping.app_user_id,
          fpl_entry_id: mapping.fpl_entry_id,
          fpl_team_name: mapping.fpl_team_name,
          fpl_manager_name: mapping.fpl_manager_name,
          mapping_status: mapping.mapping_status as "active" | "archived",
          display_name: user?.display_name ?? "ไม่ทราบชื่อ",
          avatar_url: user?.avatar_url ?? null,
        };
      });
      const latestSuccess = jobResult.data.find((job) => job.status === "succeeded");
      const latestJob = jobResult.data[0];
      const stale = !latestSuccess || latestJob?.status !== "succeeded";
      return {
        season,
        gameweeks,
        selectedGameweekNumber: input.selectedGameweekNumber,
        mappings,
        scores: scoreResult.data,
        players: playerResult.data as unknown as FantasyDashboardInput["players"],
        globalCaptainPlayerId: playerResult.data.find((player) => player.is_global_captain)?.fpl_player_id ?? null,
        globalViceCaptainPlayerId: playerResult.data.find((player) => player.is_global_vice_captain)?.fpl_player_id ?? null,
        awards: awardResult.data.map((award) => ({ mapping_id: award.mapping_id, award: award.award as "champion" | "wooden_spoon" })),
        sync: {
          lastSyncedAt: latestSuccess?.finished_at ?? null,
          stale,
          message: stale ? "ยังไม่สามารถอัปเดตข้อมูล Fantasy ล่าสุดได้" : null,
        },
      };
    },

    async listActiveMappings(seasonId) {
      const { data, error } = await client
        .from("fantasy_entry_mappings")
        .select("*")
        .eq("season_id", seasonId)
        .eq("mapping_status", "active")
        .order("updated_at", { ascending: false });
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data.map(mappingFromUnknown);
    },

    async listMappings(seasonId) {
      const { data, error } = await client
        .from("fantasy_entry_mappings")
        .select("*")
        .eq("season_id", seasonId)
        .order("updated_at", { ascending: false });
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data.map(mappingFromUnknown);
    },

    async createMapping(input) {
      const { data, error } = await client
        .from("fantasy_entry_mappings")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error("Fantasy database operation failed");
      return mappingFromUnknown(data);
    },

    async replaceMapping(mappingId, input) {
      const { data, error } = await client.rpc("replace_fantasy_mapping", {
        p_mapping_id: mappingId,
        p_season_id: input.season_id,
        p_app_user_id: input.app_user_id,
        p_fpl_entry_id: input.fpl_entry_id,
        p_fpl_team_name: input.fpl_team_name,
        p_fpl_manager_name: input.fpl_manager_name,
        p_archived_at: new Date().toISOString(),
      });
      if (error || !data) throw new Error("Fantasy database operation failed");
      return mappingFromUnknown(data);
    },

    async archiveMapping(mappingId) {
      const { error } = await client
        .from("fantasy_entry_mappings")
        .update({ mapping_status: "archived", archived_at: new Date().toISOString() })
        .eq("id", mappingId);
      if (error) throw new Error("Fantasy database operation failed");
    },

    async applySync(input) {
      const { data, error } = await client.rpc("apply_fantasy_sync", {
        p_job_run_id: input.jobRunId,
        p_synced_at: input.syncedAt,
        p_scores: input.scores,
        p_players: input.players,
        p_mapping_results: input.mappingResults,
      });
      if (error || !data) throw new Error("Fantasy database operation failed");
      return syncResultFromUnknown(data);
    },

    async replaceAwards(input) {
      const { error } = await client.rpc("replace_fantasy_awards", {
        p_season_id: input.seasonId,
        p_gameweek_id: input.gameweekId,
        p_selected_by: input.selectedBy,
        p_awards: input.awards.map((award) => ({ mapping_id: award.mappingId, award: award.award })),
      });
      if (error) throw new Error("Fantasy database operation failed");
    },
  };
}

export function buildPlayerSnapshotRows(input: {
  seasonId: string;
  gameweekId: string;
  players: FplPlayerSnapshot[];
  syncedAt?: string;
}): FantasyPlayerStatInsert[] {
  return normalizePlayerSnapshot({
    seasonId: input.seasonId,
    gameweekId: input.gameweekId,
    snapshot: {
      currentGameweek: Number(input.gameweekId.replace(/\D/g, "")) || 1,
      latestFinishedGameweek: null,
      players: input.players,
      mostCaptainedPlayerId: null,
      mostViceCaptainedPlayerId: null,
    },
    syncedAt: input.syncedAt ?? new Date().toISOString(),
  });
}

export function uniqueSnapshotKeys(rows: FantasyPlayerStatInsert[]): Set<string> {
  return new Set(rows.map((row) => `${row.season_id}:${row.gameweek_id}:${row.fpl_player_id}`));
}

export function assertActiveMappingUniqueness(rows: FantasyMappingIdentity[]): void {
  const users = new Set<string>();
  const entries = new Set<string>();

  for (const row of rows) {
    if (row.mapping_status !== "active") continue;
    const userKey = `${row.season_id}:${row.app_user_id}`;
    const entryKey = `${row.season_id}:${row.fpl_entry_id}`;
    if (users.has(userKey)) throw new Error("active mapping already exists for user");
    if (entries.has(entryKey)) throw new Error("active mapping already exists for FPL entry");
    users.add(userKey);
    entries.add(entryKey);
  }
}
