import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type FixtureMove = {
  fixtureId: string;
  oldGameweekId: string;
  newGameweekId: string;
};

export async function reconcileFixtureMoves(moves: readonly FixtureMove[]): Promise<void> {
  const admin = getSupabaseAdmin();
  for (const move of moves) {
    const { error: historyError } = await admin.from("fixture_gameweek_history").insert({
      fixture_id: move.fixtureId,
      old_gameweek_id: move.oldGameweekId,
      new_gameweek_id: move.newGameweekId,
      source: "fpl_api",
      provider_payload: { reason: "fixture_gameweek_changed" },
    });
    if (historyError) throw new Error(`Unable to record fixture move: ${historyError.message}`);

    const { data: predictions, error: predictionError } = await admin
      .from("predictions")
      .select("id,user_id,fixture_id,outcome")
      .eq("fixture_id", move.fixtureId)
      .eq("status", "active");
    if (predictionError) throw new Error(`Unable to load moved predictions: ${predictionError.message}`);
    if (predictions.length === 0) continue;

    const voidedAt = new Date().toISOString();
    const { error: voidError } = await admin
      .from("predictions")
      .update({ status: "voided", void_reason: "fixture_moved", voided_at: voidedAt, updated_at: voidedAt })
      .eq("fixture_id", move.fixtureId)
      .eq("status", "active");
    if (voidError) throw new Error(`Unable to void moved predictions: ${voidError.message}`);

    const { error: eventError } = await admin.from("prediction_events").insert(predictions.map((prediction) => ({
      prediction_id: prediction.id,
      user_id: prediction.user_id,
      fixture_id: prediction.fixture_id,
      event_type: "voided",
      previous_choice: prediction.outcome,
      reason: "fixture_moved",
    })));
    if (eventError) throw new Error(`Unable to record void events: ${eventError.message}`);

    await admin.from("gameweeks").update({ status: "reopened" }).eq("id", move.newGameweekId).eq("status", "closed");
  }
}
