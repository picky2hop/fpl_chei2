export type PredictionChoice = "home" | "draw" | "away";

export type DashboardPredictionBook = Record<number, Record<string, Record<string, PredictionChoice>>>;

type PredictionBookInput = {
  gameweeks: Array<{ id: string; number: number }>;
  fixtures: Array<{ id: string; gameweekId: string | null }>;
  predictions: Array<{ userId: string; fixtureId: string; outcome: string; status: string }>;
};

export function mapPredictionBook(input: PredictionBookInput): DashboardPredictionBook {
  const gameweekById = new Map(input.gameweeks.map((gameweek) => [gameweek.id, gameweek.number]));
  const fixtureGameweekById = new Map(
    input.fixtures.flatMap((fixture) => {
      const number = fixture.gameweekId ? gameweekById.get(fixture.gameweekId) : undefined;
      return number === undefined ? [] : [[fixture.id, number] as const];
    }),
  );
  const result: DashboardPredictionBook = {};

  for (const prediction of input.predictions) {
    if (prediction.status !== "active" || !isPredictionChoice(prediction.outcome)) continue;
    const gameweek = fixtureGameweekById.get(prediction.fixtureId);
    if (gameweek === undefined || !prediction.userId) continue;
    result[gameweek] ??= {};
    result[gameweek][prediction.userId] ??= {};
    result[gameweek][prediction.userId][prediction.fixtureId] = prediction.outcome;
  }

  return result;
}

function isPredictionChoice(value: string): value is PredictionChoice {
  return value === "home" || value === "draw" || value === "away";
}
