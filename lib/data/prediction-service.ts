import type { SupabaseClient } from "@supabase/supabase-js";
import type { PredictionChoice } from "../domain/predictions.ts";
import type { PredictionResponse } from "../api/predictions-handler.ts";
import type { Database } from "../db/types.ts";

export class PredictionWriteError extends Error {
  public readonly status: 409 | 422;
  public readonly reason: "locked" | "first_fixture_missed" | "not_active_participant";

  constructor(
    status: 409 | 422,
    message: string,
    reason: "locked" | "first_fixture_missed" | "not_active_participant" = status === 409 ? "locked" : "not_active_participant",
  ) {
    super(message);
    this.name = "PredictionWriteError";
    this.status = status;
    this.reason = reason;
  }
}

type SavedPrediction = {
  fixture_id: string;
  outcome: PredictionChoice;
  status: string;
};

export function createPredictionService(admin: SupabaseClient<Database>) {
  return {
    async savePrediction(input: {
      userId: string;
      fixtureId: string;
      choice: PredictionChoice;
    }): Promise<PredictionResponse> {
      const { data, error } = await admin.rpc("save_prediction", {
        p_user_id: input.userId,
        p_fixture_id: input.fixtureId,
        p_choice: input.choice,
      });

      if (error) {
        if (error.code === "55P03") throw new PredictionWriteError(409, "Prediction is locked");
        if (error.code === "P0001" && error.hint === "FIRST_FIXTURE_MISSED") {
          throw new PredictionWriteError(409, "First fixture was missed", "first_fixture_missed");
        }
        if (error.code === "42501") throw new PredictionWriteError(422, "User is not an active participant");
        throw new Error(`Unable to save prediction: ${error.message}`);
      }

      const prediction = data as unknown as SavedPrediction;
      return {
        fixtureId: prediction.fixture_id,
        choice: prediction.outcome,
        status: prediction.status,
      };
    },

    async savePredictions(input: {
      userId: string;
      predictions: Array<{ fixtureId: string; choice: PredictionChoice }>;
    }): Promise<PredictionResponse[]> {
      const { data, error } = await admin.rpc("save_predictions", {
        p_user_id: input.userId,
        p_predictions: input.predictions,
      });

      if (error) {
        if (error.code === "55P03") throw new PredictionWriteError(409, "Prediction is locked");
        if (error.code === "P0001" && error.hint === "FIRST_FIXTURE_MISSED") {
          throw new PredictionWriteError(409, "First fixture was missed", "first_fixture_missed");
        }
        if (error.code === "42501") throw new PredictionWriteError(422, "User is not an active participant");
        throw new Error(`Unable to save predictions: ${error.message}`);
      }

      if (!Array.isArray(data)) throw new Error("Unable to save predictions: invalid response");
      return data.map((prediction) => {
        const row = prediction as unknown as SavedPrediction;
        return { fixtureId: row.fixture_id, choice: row.outcome, status: row.status };
      });
    },

    async listPredictions(input: {
      userId: string;
      gameweekId: string;
    }): Promise<PredictionResponse[]> {
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
    },
  };
}
