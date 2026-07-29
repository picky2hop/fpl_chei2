export const predictionChoices = ["home", "draw", "away"] as const;

export type PredictionChoice = (typeof predictionChoices)[number];
export type PredictionStatus = "active" | "voided";

export function isPredictionChoice(value: unknown): value is PredictionChoice {
  return typeof value === "string" && predictionChoices.includes(value as PredictionChoice);
}
