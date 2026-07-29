import "server-only";

import type { ParticipantStatus } from "@/lib/api/admin-participant-handler";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function setParticipantStatus(input: { userId: string; gameweekId: string; status: ParticipantStatus }): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("gameweek_participants")
    .update({ status: input.status, reason: input.status === "excluded" ? "admin_excluded" : "admin_restored", changed_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .eq("gameweek_id", input.gameweekId);
  if (error) throw new Error(`Unable to update participant: ${error.message}`);
}
