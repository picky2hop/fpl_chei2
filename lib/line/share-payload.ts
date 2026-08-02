import {
  buildPredictionResultFlex,
  buildStandingsFlex,
  type FlexMessage,
} from "./flex.ts";
import type { PredictionMap } from "../predictions.ts";
import type { Fixture, LeaderboardEntry, UserProfile } from "../mock-data.ts";

export function buildStandingsShareFlex(input: {
  entries: LeaderboardEntry[];
  gameweek: number;
  period: "gameweek" | "season";
}): FlexMessage {
  return buildStandingsFlex({
    period: input.period,
    gameweek: input.gameweek,
    rows: input.entries.map((entry) => ({
      rank: entry.rank,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      points: input.period === "season" ? entry.seasonPoints : entry.gameweekPoints,
    })),
  });
}

export function buildPredictionShareFlex(input: {
  currentUser: UserProfile;
  fixtures: Fixture[];
  gameweek: number;
  predictions: PredictionMap;
}): FlexMessage {
  return buildPredictionResultFlex({
    displayName: input.currentUser.displayName,
    avatarUrl: input.currentUser.avatarUrl,
    gameweek: input.gameweek,
    fixtures: input.fixtures.map((fixture) => ({
      homeTeam: { name: fixture.homeTeam.name, logoUrl: fixture.homeTeam.crest },
      awayTeam: { name: fixture.awayTeam.name, logoUrl: fixture.awayTeam.crest },
      choice: input.predictions[fixture.id] ?? "draw",
      kickoffAt: fixture.kickoff,
    })),
  });
}
