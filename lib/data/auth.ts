import "server-only";

import type { VerifiedLineProfile } from "@/lib/auth/liff";
import {
  getMissingParticipantGameweekIds,
  getAppUserRole,
  toLiffAuthIdentity,
  type RepositorySeason,
  type RepositoryUser,
} from "@/lib/auth/user-repository-core";
import type { LiffAuthIdentity } from "@/lib/auth/liff-handler";
import { getServerEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type UserRow = RepositoryUser & {
  line_user_id: string;
  role: string;
  status: string;
};

type SeasonRow = RepositorySeason;

function isNotFound(error: { code?: string } | null): boolean {
  return error?.code === "PGRST116";
}

async function getActiveSeason(): Promise<SeasonRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("seasons")
    .select("id,name")
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(`Unable to load active season: ${error.message}`);
  if (!data) throw new Error("No active season configured");
  return data;
}

async function findOrCreateUser(profile: VerifiedLineProfile): Promise<UserRow> {
  const admin = getSupabaseAdmin();
  const { data: existing, error: findError } = await admin
    .from("app_users")
    .select("id,line_user_id,display_name,avatar_url,role,status")
    .eq("line_user_id", profile.lineUserId)
    .maybeSingle();

  if (findError && !isNotFound(findError)) throw new Error(`Unable to load user: ${findError.message}`);

  if (existing) {
    const { data, error } = await admin
      .from("app_users")
      .update({
        display_name: profile.displayName,
        avatar_url: profile.pictureUrl,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id,line_user_id,display_name,avatar_url,role,status")
      .single();
    if (error) throw new Error(`Unable to update user: ${error.message}`);
    return data;
  }

  const { data, error } = await admin
    .from("app_users")
    .insert({
      id: crypto.randomUUID(),
      line_user_id: profile.lineUserId,
      display_name: profile.displayName,
      avatar_url: profile.pictureUrl,
      role: getAppUserRole(profile.lineUserId, getServerEnv().adminLineUserId),
      status: "active",
      last_seen_at: new Date().toISOString(),
    })
    .select("id,line_user_id,display_name,avatar_url,role,status")
    .single();

  if (!error) return data;

  // A concurrent first login may have won the unique line_user_id race.
  const { data: concurrent, error: retryError } = await admin
    .from("app_users")
    .select("id,line_user_id,display_name,avatar_url,role,status")
    .eq("line_user_id", profile.lineUserId)
    .single();
  if (retryError || !concurrent) throw new Error(`Unable to create user: ${error.message}`);
  return concurrent;
}

async function joinActiveSeason(userId: string, season: RepositorySeason): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: gameweeks, error: gameweekError } = await admin
    .from("gameweeks")
    .select("id")
    .eq("season_id", season.id)
    .order("number", { ascending: true });
  if (gameweekError) throw new Error(`Unable to load gameweeks: ${gameweekError.message}`);

  const gameweekIds = gameweeks.map((gameweek) => gameweek.id);
  if (gameweekIds.length === 0) return;

  const { data: participants, error: participantError } = await admin
    .from("gameweek_participants")
    .select("gameweek_id")
    .eq("user_id", userId)
    .in("gameweek_id", gameweekIds);
  if (participantError) throw new Error(`Unable to load participation: ${participantError.message}`);

  const missingGameweekIds = getMissingParticipantGameweekIds(
    gameweekIds,
    participants.map((participant) => participant.gameweek_id),
  );
  if (missingGameweekIds.length === 0) return;

  const { error } = await admin.from("gameweek_participants").insert(
    missingGameweekIds.map((gameweekId) => ({
      gameweek_id: gameweekId,
      user_id: userId,
      status: "active",
      reason: "joined_active_season",
    })),
  );
  if (error) throw new Error(`Unable to join gameweeks: ${error.message}`);
}

export async function upsertUserAndJoinSeason(profile: VerifiedLineProfile): Promise<LiffAuthIdentity> {
  const user = await findOrCreateUser(profile);
  if (user.status !== "active") throw new Error("User is not active");

  const season = await getActiveSeason();
  await joinActiveSeason(user.id, season);
  return toLiffAuthIdentity(user, season);
}
