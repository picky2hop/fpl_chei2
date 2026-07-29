export type FplFixturePayload = {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  started: boolean;
  finished: boolean;
  finished_provisional: boolean;
  postponed: boolean;
};

export type NormalizedFplFixture = {
  externalFixtureId: number;
  externalGameweekId: number;
  kickoffAt: string;
  homeExternalTeamId: number;
  awayExternalTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "finished" | "postponed";
};

export function normalizeFplFixture(fixture: FplFixturePayload): NormalizedFplFixture {
  if (fixture.event === null) throw new Error(`Fixture ${fixture.id} has no gameweek`);
  if (!fixture.kickoff_time) throw new Error(`Fixture ${fixture.id} has no kickoff`);
  const kickoff = new Date(fixture.kickoff_time);
  if (Number.isNaN(kickoff.getTime())) throw new Error(`Fixture ${fixture.id} has an invalid kickoff`);

  return {
    externalFixtureId: fixture.id,
    externalGameweekId: fixture.event,
    kickoffAt: kickoff.toISOString(),
    homeExternalTeamId: fixture.team_h,
    awayExternalTeamId: fixture.team_a,
    homeScore: fixture.team_h_score,
    awayScore: fixture.team_a_score,
    status: fixture.postponed ? "postponed" : fixture.finished ? "finished" : fixture.started ? "live" : "scheduled",
  };
}
