import "server-only";

import { getSupabaseAdmin } from "../supabase/admin.ts";
import { createPredictionService } from "./prediction-service.ts";
import type { PredictionChoice } from "../domain/predictions.ts";
import type { PredictionResponse } from "../api/predictions-handler.ts";

export { PredictionWriteError } from "./prediction-service.ts";

export async function savePrediction(input: {
  userId: string;
  fixtureId: string;
  choice: PredictionChoice;
}): Promise<PredictionResponse> {
  return createPredictionService(getSupabaseAdmin()).savePrediction(input);
}

export async function savePredictions(input: {
  userId: string;
  predictions: Array<{ fixtureId: string; choice: PredictionChoice }>;
}): Promise<PredictionResponse[]> {
  return createPredictionService(getSupabaseAdmin()).savePredictions(input);
}

export async function listPredictions(input: {
  userId: string;
  gameweekId: string;
}): Promise<PredictionResponse[]> {
  return createPredictionService(getSupabaseAdmin()).listPredictions(input);
}
