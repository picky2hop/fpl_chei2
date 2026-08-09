export type PredictionChoice = "home" | "draw" | "away";

export type DashboardPredictionBook = Record<number, Record<string, Record<string, PredictionChoice>>>;

type FplOrderedFixture = {
  kickoff_at: string;
  external_fixture_id: number;
};

export function sortFixturesForFplOrder<T extends FplOrderedFixture>(fixtures: T[]): T[] {
  return [...fixtures].sort((left, right) => {
    const kickoffDifference = Date.parse(left.kickoff_at) - Date.parse(right.kickoff_at);
    return kickoffDifference || left.external_fixture_id - right.external_fixture_id;
  });
}

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
