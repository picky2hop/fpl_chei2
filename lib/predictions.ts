export type PredictionChoice = "home" | "draw" | "away";

export type PredictionMap = Record<string, PredictionChoice>;

export type PredictionEditableFixture = {
  status: "scheduled" | "upcoming" | "live" | "finished" | "postponed";
  kickoffAt: string;
};

export type PredictionFixture = {
  id: string;
  homeTeam: string;
  awayTeam: string;
};

export type UserPredictionDetail = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  choice: PredictionChoice;
};

export type FixturePredictor = {
  name: string;
  avatarUrl: string;
  choice: PredictionChoice;
};

export type GroupedFixturePredictionDetails = Record<PredictionChoice, FixturePredictor[]>;

export function canEditPrediction(fixture: PredictionEditableFixture, now: Date): boolean {
  const kickoffAt = new Date(fixture.kickoffAt);
  return (fixture.status === "scheduled" || fixture.status === "upcoming")
    && Number.isFinite(kickoffAt.getTime())
    && now.getTime() < kickoffAt.getTime();
}

export function getFixtureScoreText(fixture: { homeScore?: number; awayScore?: number }): string | null {
  return typeof fixture.homeScore === "number" && typeof fixture.awayScore === "number"
    ? `${fixture.homeScore} - ${fixture.awayScore}`
    : null;
}

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

export function getCompleteLeaderboardEntries<T extends { id: string }>(
  entries: T[],
  fixtureIds: string[],
  predictionBook: Record<number, Record<string, PredictionMap>>,
  gameweek: number,
): T[] {
  return entries.filter((entry) => isPredictionComplete(fixtureIds, predictionBook[gameweek]?.[entry.id] ?? {}));
}

export function normalizePredictionPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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

export function getUserPredictionDetails(
  fixtures: PredictionFixture[],
  predictions: PredictionMap,
): UserPredictionDetail[] {
  return fixtures.flatMap((fixture) => {
    const choice = predictions[fixture.id];
    return choice
      ? [{
          fixtureId: fixture.id,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          choice,
        }]
      : [];
  });
}

export function getFixturePredictors(
  entries: Array<{ id: string; displayName: string; avatarUrl: string }>,
  predictionBook: Record<number, Record<string, PredictionMap>>,
  gameweek: number,
  fixtureId: string,
): FixturePredictor[] {
  return entries.flatMap((entry) => {
    const choice = predictionBook[gameweek]?.[entry.id]?.[fixtureId];
    return choice
      ? [{ name: entry.displayName, avatarUrl: entry.avatarUrl, choice }]
      : [];
  });
}

export function getFixturePredictionDetails(
  predictors: FixturePredictor[],
): GroupedFixturePredictionDetails {
  return predictors.reduce<GroupedFixturePredictionDetails>(
    (groups, predictor) => {
      groups[predictor.choice].push(predictor);
      return groups;
    },
    { home: [], draw: [], away: [] },
  );
}

export function getPredictionTeamHighlights(choice: PredictionChoice) {
  return {
    home: choice === "home",
    away: choice === "away",
  };
}
