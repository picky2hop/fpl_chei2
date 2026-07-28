export type PredictionChoice = "home" | "draw" | "away";

export type PredictionMap = Record<string, PredictionChoice>;

export function applyPrediction(
  current: PredictionMap,
  fixtureId: string,
  choice: PredictionChoice,
): PredictionMap {
  return { ...current, [fixtureId]: choice };
}

export function isPredictionComplete(
  fixtureIds: string[],
  predictions: PredictionMap,
): boolean {
  return fixtureIds.length > 0 && fixtureIds.every((fixtureId) => Boolean(predictions[fixtureId]));
}

export function getPredictionPercentages(choices: PredictionChoice[]) {
  const total = choices.length;
  const counts: Record<PredictionChoice, number> = { home: 0, draw: 0, away: 0 };

  choices.forEach((choice) => {
    counts[choice] += 1;
  });

  return {
    home: total ? Math.round((counts.home / total) * 100) : 0,
    draw: total ? Math.round((counts.draw / total) * 100) : 0,
    away: total ? Math.round((counts.away / total) * 100) : 0,
  };
}
