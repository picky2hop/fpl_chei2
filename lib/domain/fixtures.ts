import type { PredictionChoice } from "./predictions.ts";

export const fixtureStatuses = ["scheduled", "live", "finished", "postponed"] as const;
export type FixtureStatus = (typeof fixtureStatuses)[number];
export type ParticipantStatus = "active" | "excluded";

export function getFixtureOutcome(homeScore: number, awayScore: number): PredictionChoice {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

export function isPredictionOpen(input: {
  status: FixtureStatus;
  kickoffAt: Date;
  now: Date;
  participantStatus: ParticipantStatus;
}): boolean {
  return input.status === "scheduled"
    && input.participantStatus === "active"
    && Number.isFinite(input.kickoffAt.getTime())
    && input.now.getTime() < input.kickoffAt.getTime();
}

export function canCloseGameweek(fixtures: Array<{ status: FixtureStatus }>): boolean {
  return fixtures.some((fixture) => fixture.status === "finished")
    && !fixtures.some((fixture) => fixture.status === "scheduled" || fixture.status === "live");
}

export type FixtureMoveInput = {
  oldGameweekId: string | null;
  newGameweekId: string | null;
  kickoffChanged: boolean;
  fixtureStarted: boolean;
};

export type FixtureMoveReconciliation = {
  moved: boolean;
  voidPrediction: boolean;
  reopenTarget: boolean;
  oldGameweekId: string | null;
  newGameweekId: string | null;
};

export function reconcileFixtureMove(input: FixtureMoveInput): FixtureMoveReconciliation {
  const moved = input.oldGameweekId !== input.newGameweekId;
  const voidPrediction = moved;

  return {
    moved,
    voidPrediction,
    reopenTarget: moved && input.newGameweekId !== null,
    oldGameweekId: input.oldGameweekId,
    newGameweekId: input.newGameweekId,
  };
}
