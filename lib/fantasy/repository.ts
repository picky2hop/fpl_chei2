import { normalizePlayerSnapshot } from "./normalizers.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../db/types.ts";
import type { FantasyDashboardInput } from "./dashboard.ts";

export type { FantasyEntryMapping } from "./types.ts";
import type {
  CreateFantasyMappingInput,
  FantasyEntryCurrentSquad,
  FantasyEntryMapping,
  FantasyGameweekScoreInsert,
  FantasyPlayerStatInsert,
  FantasySyncWriteResult,
  FplPlayerSnapshot,
} from "./types.ts";
import type {
  FantasyEntryGameweekScoreInsert,
  FantasyEntryGameweekScoreMethodRow,
  FantasyLeagueMembershipInsert,
  FantasyLeagueRecord,
  CreateFantasyLeagueInput,
  FantasyLeagueMappingCandidate,
  FantasyLeagueSyncLeague,
  FantasyLeagueSyncWriteResult,
} from "./league-types.ts";
import type { FantasyLeagueDashboardInput } from "./league-dashboard.ts";

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
  getCurrentSquad?(input: { seasonId: string; entryId: number }): Promise<(FantasyEntryCurrentSquad & { gameweekId: string; sourceSyncedAt: string }) | null>;
  upsertCurrentSquad?(input: { seasonId: string; entryId: number; gameweekId: string; squad: FantasyEntryCurrentSquad; syncedAt: string }): Promise<void>;
  applySync(input: {
    jobRunId: string;
    syncedAt: string;
    scores: FantasyGameweekScoreInsert[];
    players: FantasyPlayerStatInsert[];
    mappingResults: Json[];
  }): Promise<FantasySyncWriteResult>;
  replaceAwards(input: { seasonId: string; gameweekId: string; selectedBy: string; awards: Array<{ mappingId: string; award: "champion" | "wooden_spoon" }> }): Promise<void>;
};

export type FantasyLeagueRepository = {
  listActiveLeagues(seasonId: string): Promise<FantasyLeagueRecord[]>;
  listLeagues(seasonId: string, includeArchived: boolean): Promise<FantasyLeagueRecord[]>;
  createLeague(input: CreateFantasyLeagueInput): Promise<FantasyLeagueRecord>;
  updateLeagueId(id: string, input: { fpl_league_id: number; official_name: string }): Promise<FantasyLeagueRecord>;
  archiveLeague(id: string): Promise<void>;
  listLeagueEntries(input: { seasonId: string; gameweekId: string }): Promise<FantasyLeagueMappingCandidate[]>;
  listUnmappedLeagueEntries(input: { seasonId: string; gameweekId: string }): Promise<FantasyLeagueMappingCandidate[]>;
  listLeagueEntryIds(input: { seasonId: string; leagueId: string; gameweekId: string }): Promise<number[]>;
  listLeagueAwards(seasonId: string): Promise<Array<{ leagueId: string; gameweekId: string; fplEntryId: number; award: "champion" | "wooden_spoon" }>>;
  listEntryGameweekScores(seasonId: string): Promise<FantasyEntryGameweekScoreMethodRow[]>;
  getCurrentLeagueEntry?(input: { seasonId: string; leagueId: string; entryId: number }): Promise<{ gameweekId: string; gameweekNumber: number }>;
  replaceLeagueAwards(input: { seasonId: string; leagueId: string; gameweekId: string; selectedBy: string; awards: Array<{ fplEntryId: number; award: "champion" | "wooden_spoon" }> }): Promise<void>;
  getLeagueDashboard(input: { seasonId: string; leagueId: string; selectedGameweekNumber?: number }): Promise<FantasyLeagueDashboardInput>;
  applyLeagueSync(input: {
    jobRunId: string;
    syncedAt: string;
    leagues: FantasyLeagueSyncLeague[];
    memberships: FantasyLeagueMembershipInsert[];
    scores: FantasyEntryGameweekScoreInsert[];
    players: FantasyPlayerStatInsert[];
  }): Promise<FantasyLeagueSyncWriteResult>;
  applyScoreRecalculation(input: {
    jobRunId: string;
    scores: FantasyEntryGameweekScoreInsert[];
  }): Promise<{ jobRunId: string; scoresUpserted: number }>;
  applyPlayerStatsSync(input: {
    jobRunId: string;
    syncedAt: string;
    players: FantasyPlayerStatInsert[];
  }): Promise<{ jobRunId: string; playersUpserted: number }>;
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

function currentSquadFromRow(value: unknown): FantasyEntryCurrentSquad & { gameweekId: string; sourceSyncedAt: string } {
  if (typeof value !== "object" || value === null) throw new Error("Fantasy current squad response is invalid");
  const row = value as Record<string, unknown>;
  if (typeof row.gameweek_id !== "string"
    || typeof row.source_synced_at !== "string"
    || typeof row.squad !== "object"
    || row.squad === null) {
    throw new Error("Fantasy current squad response is invalid");
  }
  return {
    ...(row.squad as FantasyEntryCurrentSquad),
    gameweekId: row.gameweek_id,
    sourceSyncedAt: row.source_synced_at,
  };
}

export function createFantasyRepository(client: FantasyDatabaseClient): FantasyRepository & FantasyLeagueRepository {
  return {
    async getActiveSeason() {
      const { data, error } = await client.from("seasons").select("id,name").eq("status", "active").maybeSingle();
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data;
    },

    async listActiveLeagues(seasonId) {
      return this.listLeagues(seasonId, false);
    },

    async listLeagues(seasonId, includeArchived) {
      let query = client
        .from("fantasy_leagues")
        .select("id,season_id,fpl_league_id,official_name,status,archived_at")
        .eq("season_id", seasonId)
        .order("fpl_league_id");
      if (!includeArchived) query = query.eq("status", "active");
      const { data, error } = await query;
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data.map((league) => ({ ...league, status: league.status as "active" | "archived" }));
    },

    async createLeague(input) {
      const { data, error } = await client
        .from("fantasy_leagues")
        .insert(input)
        .select("id,season_id,fpl_league_id,official_name,status,archived_at")
        .single();
      if (error || !data) throw new Error("Fantasy database operation failed");
      return { ...data, status: data.status as "active" | "archived" };
    },

    async updateLeagueId(id, input) {
      const { data, error } = await client
        .from("fantasy_leagues")
        .update({ fpl_league_id: input.fpl_league_id, official_name: input.official_name, status: "active", archived_at: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id,season_id,fpl_league_id,official_name,status,archived_at")
        .single();
      if (error || !data) throw new Error("Fantasy database operation failed");
      return { ...data, status: data.status as "active" | "archived" };
    },

    async archiveLeague(id) {
      const { error } = await client
        .from("fantasy_leagues")
        .update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error("Fantasy database operation failed");
    },

    async listLeagueEntries(input) {
      const { data: leagues, error: leagueError } = await client
        .from("fantasy_leagues")
        .select("id,official_name")
        .eq("season_id", input.seasonId)
        .eq("status", "active");
      if (leagueError || !leagues || leagues.length === 0) return [];
      const leagueIds = leagues.map((league) => league.id);
      const { data: memberships, error: membershipError } = await client
        .from("fantasy_league_membership_snapshots").select("league_id,fpl_entry_id,fpl_team_name,fpl_manager_name").eq("season_id", input.seasonId).eq("gameweek_id", input.gameweekId).in("league_id", leagueIds);
      if (membershipError || !memberships) throw new Error("Fantasy database operation failed");
      const leagueById = new Map(leagues.map((league) => [league.id, league.official_name]));
      const candidates = new Map<number, FantasyLeagueMappingCandidate>();
      for (const member of memberships) {
        const existing = candidates.get(member.fpl_entry_id);
        const league = { id: member.league_id, official_name: leagueById.get(member.league_id) ?? "" };
        if (!existing) {
          candidates.set(member.fpl_entry_id, { fpl_entry_id: member.fpl_entry_id, fpl_team_name: member.fpl_team_name, fpl_manager_name: member.fpl_manager_name, leagues: [league] });
        } else if (!existing.leagues.some((item) => item.id === league.id)) {
          existing.leagues.push(league);
        }
      }
      return [...candidates.values()].sort((left, right) => left.fpl_entry_id - right.fpl_entry_id);
    },

    async listUnmappedLeagueEntries(input) {
      const [entries, mappings] = await Promise.all([
        this.listLeagueEntries(input),
        client.from("fantasy_entry_mappings").select("fpl_entry_id").eq("season_id", input.seasonId).eq("mapping_status", "active"),
      ]);
      if (mappings.error || !mappings.data) throw new Error("Fantasy database operation failed");
      const mappedEntries = new Set(mappings.data.map((mapping) => mapping.fpl_entry_id));
      return entries.filter((entry) => !mappedEntries.has(entry.fpl_entry_id));
    },

    async listLeagueEntryIds(input) {
      const { data, error } = await client
        .from("fantasy_league_membership_snapshots")
        .select("fpl_entry_id")
        .eq("season_id", input.seasonId)
        .eq("league_id", input.leagueId)
        .eq("gameweek_id", input.gameweekId);
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data.map((row) => row.fpl_entry_id);
    },

    async listLeagueAwards(seasonId) {
      const { data, error } = await client
        .from("fantasy_league_awards")
        .select("league_id,gameweek_id,fpl_entry_id,award")
        .eq("season_id", seasonId);
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data.flatMap((row) => row.award === "champion" || row.award === "wooden_spoon"
        ? [{ leagueId: row.league_id, gameweekId: row.gameweek_id, fplEntryId: row.fpl_entry_id, award: row.award }]
        : []);
    },

    async listEntryGameweekScores(seasonId) {
      const { data, error } = await client
        .from("fantasy_entry_gameweek_scores")
        .select("fpl_entry_id,gameweek_id,calculation_method")
        .eq("season_id", seasonId);
      if (error || !data) throw new Error("Fantasy database operation failed");
      return data.map((row) => ({
        fpl_entry_id: row.fpl_entry_id,
        gameweek_id: row.gameweek_id,
        calculation_method: row.calculation_method as FantasyEntryGameweekScoreMethodRow["calculation_method"],
      }));
    },

    async getCurrentLeagueEntry(input) {
      const { data: gameweeks, error: gameweekError } = await client
        .from("gameweeks")
        .select("id,number,is_current,status")
        .eq("season_id", input.seasonId)
        .order("number");
      if (gameweekError || !gameweeks) throw new Error("Fantasy database operation failed");

      const currentGameweek = gameweeks.find((gameweek) => gameweek.is_current)
        ?? [...gameweeks]
          .filter((gameweek) => gameweek.status === "closed" || gameweek.status === "reopened")
          .sort((left, right) => right.number - left.number)[0]
        ?? gameweeks[0];
      if (!currentGameweek) throw new Error("Fantasy gameweek is unavailable");

      const { data: membership, error: membershipError } = await client
        .from("fantasy_league_membership_snapshots")
        .select("fpl_entry_id")
        .eq("season_id", input.seasonId)
        .eq("league_id", input.leagueId)
        .eq("gameweek_id", currentGameweek.id)
        .eq("fpl_entry_id", input.entryId)
        .maybeSingle();
      if (membershipError) throw new Error("Fantasy database operation failed");
      if (!membership) throw new Error("Fantasy league Entry is unavailable");

      return { gameweekId: currentGameweek.id, gameweekNumber: currentGameweek.number };
    },

    async replaceLeagueAwards(input) {
      const { error } = await client.rpc("replace_fantasy_league_awards", {
        p_season_id: input.seasonId,
        p_league_id: input.leagueId,
        p_gameweek_id: input.gameweekId,
        p_selected_by: input.selectedBy,
        p_awards: input.awards.map((award) => ({ fpl_entry_id: award.fplEntryId, award: award.award })),
      });
      if (error) throw new Error("Fantasy database operation failed");
    },

    async getLeagueDashboard(input) {
      const [{ data: season, error: seasonError }, { data: gameweeks, error: gameweekError }, { data: leagues, error: leagueError }] = await Promise.all([
        client.from("seasons").select("id,name").eq("id", input.seasonId).maybeSingle(),
        client.from("gameweeks").select("id,number,name,is_current,status").eq("season_id", input.seasonId).order("number"),
        client.from("fantasy_leagues").select("id,season_id,fpl_league_id,official_name,status,archived_at").eq("season_id", input.seasonId).order("fpl_league_id"),
      ]);
      if (seasonError || gameweekError || leagueError || !season || !gameweeks || !leagues) throw new Error("Fantasy database operation failed");
      const selectedLeague = leagues.find((league) => league.id === input.leagueId);
      if (!selectedLeague) throw new Error("Fantasy league is unavailable");
      const currentGameweekNumber = gameweeks.find((gameweek) => gameweek.is_current)?.number
        ?? [...gameweeks].filter((gameweek) => gameweek.status === "closed" || gameweek.status === "reopened").sort((left, right) => right.number - left.number)[0]?.number
        ?? gameweeks[0]?.number
        ?? 0;
      const selectedGameweekNumber = gameweeks.some((gameweek) => gameweek.number === input.selectedGameweekNumber)
        ? input.selectedGameweekNumber ?? currentGameweekNumber
        : currentGameweekNumber;
      const currentGameweekId = gameweeks.find((gameweek) => gameweek.number === currentGameweekNumber)?.id;
      const selectedGameweekId = gameweeks.find((gameweek) => gameweek.number === selectedGameweekNumber)?.id;
      if (!currentGameweekId || !selectedGameweekId) throw new Error("Fantasy gameweek is unavailable");
      const [membershipResult, scoreResult, playerResult, mappingResult, usersResult, awardResult, jobResult] = await Promise.all([
        client.from("fantasy_league_membership_snapshots").select("league_id,gameweek_id,fpl_entry_id,fpl_team_name,fpl_manager_name").eq("season_id", input.seasonId).eq("league_id", input.leagueId),
        client.from("fantasy_entry_gameweek_scores").select("fpl_entry_id,gameweek_id,points").eq("season_id", input.seasonId),
        client.from("fantasy_player_gameweek_stats").select("*").eq("season_id", input.seasonId).eq("gameweek_id", currentGameweekId),
        client.from("fantasy_entry_mappings").select("fpl_entry_id,app_user_id").eq("season_id", input.seasonId).eq("mapping_status", "active"),
        client.from("app_users").select("id,display_name,avatar_url"),
        client.from("fantasy_league_awards").select("fpl_entry_id,award").eq("season_id", input.seasonId).eq("league_id", input.leagueId).eq("gameweek_id", selectedGameweekId),
        client.from("job_runs").select("status,finished_at,started_at,error_message").eq("job_type", "fantasy_sync").order("started_at", { ascending: false }).limit(20),
      ]);
      if (membershipResult.error || scoreResult.error || playerResult.error || mappingResult.error || usersResult.error || awardResult.error || jobResult.error
        || !membershipResult.data || !scoreResult.data || !playerResult.data || !mappingResult.data || !usersResult.data || !awardResult.data || !jobResult.data) {
        throw new Error("Fantasy database operation failed");
      }
      const gameweekNumbers = new Map(gameweeks.map((gameweek) => [gameweek.id, gameweek.number]));
      const usersById = new Map(usersResult.data.map((user) => [user.id, user]));
      const latestSuccess = jobResult.data.find((job) => job.status === "succeeded");
      const latestJob = jobResult.data[0];
      return {
        season,
        gameweeks,
        leagues: leagues.map((league) => ({ ...league, status: league.status as "active" | "archived" })),
        selectedLeagueId: input.leagueId,
        selectedGameweekNumber,
        memberships: membershipResult.data.map((membership) => ({ ...membership, gameweek_number: gameweekNumbers.get(membership.gameweek_id) ?? 0 })),
        scores: scoreResult.data.map((score) => ({ ...score, gameweek_number: gameweekNumbers.get(score.gameweek_id) ?? 0 })),
        mappings: mappingResult.data.map((mapping) => ({
          fpl_entry_id: mapping.fpl_entry_id,
          app_user_id: mapping.app_user_id,
          display_name: usersById.get(mapping.app_user_id)?.display_name ?? "ไม่ทราบชื่อ",
          avatar_url: usersById.get(mapping.app_user_id)?.avatar_url ?? null,
        })),
        players: playerResult.data as unknown as FantasyLeagueDashboardInput["players"],
        globalCaptainPlayerId: playerResult.data.find((player) => player.is_global_captain)?.fpl_player_id ?? null,
        globalViceCaptainPlayerId: playerResult.data.find((player) => player.is_global_vice_captain)?.fpl_player_id ?? null,
        awards: awardResult.data.map((award) => ({ fpl_entry_id: award.fpl_entry_id, award: award.award as "champion" | "wooden_spoon" })),
        sync: {
          lastSyncedAt: latestSuccess?.finished_at ?? null,
          stale: !latestSuccess || latestJob?.status !== "succeeded",
          message: !latestSuccess || latestJob?.status !== "succeeded" ? "ยังไม่สามารถอัปเดตข้อมูล Fantasy ล่าสุดได้" : null,
        },
      };
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

    async getCurrentSquad(input) {
      const { data, error } = await client
        .from("fantasy_entry_current_squads")
        .select("gameweek_id,source_synced_at,squad")
        .eq("season_id", input.seasonId)
        .eq("fpl_entry_id", input.entryId)
        .maybeSingle();
      if (error) throw new Error("Fantasy database operation failed");
      return data ? currentSquadFromRow(data) : null;
    },

    async upsertCurrentSquad(input) {
      const { error } = await client
        .from("fantasy_entry_current_squads")
        .upsert([{
          season_id: input.seasonId,
          fpl_entry_id: input.entryId,
          gameweek_id: input.gameweekId,
          gameweek_number: input.squad.gameweekNumber,
          squad: input.squad as unknown as Json,
          source_synced_at: input.syncedAt,
        }], { onConflict: "season_id,fpl_entry_id" });
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

    async applyLeagueSync(input) {
      const { data, error } = await client.rpc("apply_fantasy_league_sync", {
        p_job_run_id: input.jobRunId,
        p_synced_at: input.syncedAt,
        p_leagues: input.leagues,
        p_memberships: input.memberships,
        p_scores: input.scores,
        p_players: input.players,
      });
      if (error || !data || typeof data !== "object") throw new Error("Fantasy database operation failed");
      const row = data as Record<string, unknown>;
      if (typeof row.jobRunId !== "string"
        || typeof row.leaguesUpserted !== "number"
        || typeof row.membershipsUpserted !== "number"
        || typeof row.scoresUpserted !== "number"
        || typeof row.playersUpserted !== "number") {
        throw new Error("Fantasy sync response is invalid");
      }
      return {
        jobRunId: row.jobRunId,
        leaguesUpserted: row.leaguesUpserted,
        membershipsUpserted: row.membershipsUpserted,
        scoresUpserted: row.scoresUpserted,
        playersUpserted: row.playersUpserted,
      };
    },

    async applyScoreRecalculation(input) {
      const { data, error } = await client.rpc("apply_fantasy_score_recalculation", {
        p_job_run_id: input.jobRunId,
        p_scores: input.scores,
      });
      if (error || !data || typeof data !== "object") throw new Error("Fantasy database operation failed");
      const row = data as Record<string, unknown>;
      if (typeof row.jobRunId !== "string" || typeof row.scoresUpserted !== "number") throw new Error("Fantasy recalculation response is invalid");
      return { jobRunId: row.jobRunId, scoresUpserted: row.scoresUpserted };
    },

    async applyPlayerStatsSync(input) {
      const { data, error } = await client.rpc("apply_fantasy_player_stats_sync", {
        p_job_run_id: input.jobRunId,
        p_synced_at: input.syncedAt,
        p_players: input.players,
      });
      if (error || !data || typeof data !== "object") throw new Error("Fantasy database operation failed");
      const row = data as Record<string, unknown>;
      if (typeof row.jobRunId !== "string" || typeof row.playersUpserted !== "number") throw new Error("Fantasy player stats response is invalid");
      return { jobRunId: row.jobRunId, playersUpserted: row.playersUpserted };
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
      gameweeks: [],
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
  const entries = new Set<string>();

  for (const row of rows) {
    if (row.mapping_status !== "active") continue;
    const entryKey = `${row.season_id}:${row.fpl_entry_id}`;
    if (entries.has(entryKey)) throw new Error("active mapping already exists for FPL entry");
    entries.add(entryKey);
  }
}
