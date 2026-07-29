import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function listParticipantOptions() {
  const admin = getSupabaseAdmin();
  const { data: season, error: seasonError } = await admin.from("seasons").select("id").eq("status", "active").maybeSingle();
  if (seasonError || !season) throw new Error("Active season is unavailable");
  const [{ data: users, error: userError }, { data: gameweeks, error: gameweekError }] = await Promise.all([
    admin.from("app_users").select("id,display_name,status").order("display_name"),
    admin.from("gameweeks").select("id,name,number").eq("season_id", season.id).order("number"),
  ]);
  if (userError || gameweekError) throw new Error("Participant options are unavailable");
  return {
    users: users.map((user) => ({ id: user.id, displayName: user.display_name, status: user.status })),
    gameweeks: gameweeks.map((gameweek) => ({ id: gameweek.id, label: gameweek.name ?? `GW ${gameweek.number}` })),
  };
}
