import "server-only";

import type { PredictionChoice } from "@/lib/domain/predictions";
import type { PredictionResponse } from "@/lib/api/predictions-handler";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export class PredictionWriteError extends Error {
  constructor(public readonly status: 409 | 422, message: string) {
    super(message);
    this.name = "PredictionWriteError";
  }
}

type SavedPrediction = {
  fixture_id: string;
  outcome: PredictionChoice;
  status: string;
};

export async function savePrediction(input: {
  userId: string;
  fixtureId: string;
  choice: PredictionChoice;
}): Promise<PredictionResponse> {
  const { data, error } = await getSupabaseAdmin().rpc("save_prediction", {
    p_user_id: input.userId,
    p_fixture_id: input.fixtureId,
    p_choice: input.choice,
  });

  if (error) {
    if (error.code === "55P03") throw new PredictionWriteError(409, "Prediction is locked");
    if (error.code === "42501") throw new PredictionWriteError(422, "User is not an active participant");
    throw new Error(`Unable to save prediction: ${error.message}`);
  }

  const prediction = data as unknown as SavedPrediction;
  return {
    fixtureId: prediction.fixture_id,
    choice: prediction.outcome,
    status: prediction.status,
  };
}

export async function listPredictions(input: {
  userId: string;
  gameweekId: string;
}): Promise<PredictionResponse[]> {
  const admin = getSupabaseAdmin();
  const { data: fixtures, error: fixtureError } = await admin
    .from("fixtures")
    .select("id")
    .eq("gameweek_id", input.gameweekId);
  if (fixtureError) throw new Error(`Unable to load gameweek fixtures: ${fixtureError.message}`);

  const fixtureIds = fixtures.map((fixture) => fixture.id);
  if (fixtureIds.length === 0) return [];

  const { data: predictions, error } = await admin
    .from("predictions")
    .select("fixture_id,outcome,status")
    .eq("user_id", input.userId)
    .in("fixture_id", fixtureIds)
    .eq("status", "active");
  if (error) throw new Error(`Unable to load predictions: ${error.message}`);

  return predictions.map((prediction) => ({
    fixtureId: prediction.fixture_id,
    choice: prediction.outcome as PredictionChoice,
    status: prediction.status,
  }));
}
