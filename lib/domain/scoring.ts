import { getFixtureOutcome, type FixtureStatus } from "./fixtures.ts";
import type { PredictionChoice, PredictionStatus } from "./predictions.ts";

export type ScoringFixture = {
  id: string;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
};

export type ScoringPrediction = {
  userId: string;
  fixtureId: string;
  choice: PredictionChoice;
  status: PredictionStatus;
};

export type ScoringParticipant = {
  userId: string;
  status: "active" | "excluded";
};

export type ScoringInput = {
  fixtures: ScoringFixture[];
  predictions: ScoringPrediction[];
  participants: ScoringParticipant[];
};

export type GameweekScore = {
  userId: string;
  points: number;
  correctPredictions: number;
  predictedFixtures: number;
  countedFixtures: number;
};

export type GameweekAward = {
  userId: string;
  award: "champion" | "wooden_spoon";
  points: number;
};

export type GameweekScoringResult = {
  scores: GameweekScore[];
  awards: GameweekAward[];
};

export function scorePrediction(
  choice: PredictionChoice | null,
  outcome: PredictionChoice | null,
): 0 | 3 {
  return choice !== null && choice === outcome ? 3 : 0;
}

function getFinishedOutcome(fixture: ScoringFixture): PredictionChoice | null {
  if (fixture.status !== "finished" || fixture.homeScore === null || fixture.awayScore === null) {
    return null;
  }

  return getFixtureOutcome(fixture.homeScore, fixture.awayScore);
}

export function calculateGameweekScoring(input: ScoringInput): GameweekScoringResult {
  const activeParticipants = input.participants.filter((participant) => participant.status === "active");
  const finishedFixtures = input.fixtures.filter((fixture) => getFinishedOutcome(fixture) !== null);
  const fixtureOutcomes = new Map(
    finishedFixtures.map((fixture) => [fixture.id, getFinishedOutcome(fixture)] as const),
  );
  const activePredictions = input.predictions.filter((prediction) => prediction.status === "active");

  const scores = activeParticipants.map<GameweekScore>((participant) => {
    const userPredictions = activePredictions.filter((prediction) => prediction.userId === participant.userId);
    let points = 0;
    let correctPredictions = 0;

    for (const prediction of userPredictions) {
      const outcome = fixtureOutcomes.get(prediction.fixtureId) ?? null;
      if (outcome === null) continue;
      if (scorePrediction(prediction.choice, outcome) === 3) {
        points += 3;
        correctPredictions += 1;
      }
    }

    return {
      userId: participant.userId,
      points,
      correctPredictions,
      predictedFixtures: userPredictions.filter((prediction) => fixtureOutcomes.has(prediction.fixtureId)).length,
      countedFixtures: finishedFixtures.length,
    };
  });

  if (finishedFixtures.length === 0 || scores.length === 0) {
    return { scores, awards: [] };
  }

  const maxPoints = Math.max(...scores.map((score) => score.points));
  const minPoints = Math.min(...scores.map((score) => score.points));
  const awards: GameweekAward[] = [
    ...scores
      .filter((score) => score.points === maxPoints)
      .map((score) => ({ userId: score.userId, award: "champion" as const, points: score.points })),
    ...scores
      .filter((score) => score.points === minPoints)
      .map((score) => ({ userId: score.userId, award: "wooden_spoon" as const, points: score.points })),
  ];

  return { scores, awards };
}

export type SeasonScore = {
  userId: string;
  gameweekId: string;
  points: number;
};

export type SeasonTotal = {
  userId: string;
  points: number;
  includedGameweeks: number;
};

export function calculateSeasonTotals(
  scores: SeasonScore[],
  excludedGameweekIds: ReadonlySet<string>,
): SeasonTotal[] {
  const totals = new Map<string, SeasonTotal>();

  for (const score of scores) {
    if (excludedGameweekIds.has(score.gameweekId)) continue;
    const current = totals.get(score.userId) ?? {
      userId: score.userId,
      points: 0,
      includedGameweeks: 0,
    };
    current.points += score.points;
    current.includedGameweeks += 1;
    totals.set(score.userId, current);
  }

  return [...totals.values()];
}
