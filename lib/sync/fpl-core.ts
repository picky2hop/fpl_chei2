import { SyncFailure } from "./sync-errors.ts";

export type FplTeamPayload = {
  id: number;
  name: string;
  short_name: string;
  code: number;
};

export type FplEventPayload = {
  id: number;
  name: string;
  is_current: boolean;
};

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
  postponed?: boolean;
};

export type FplSnapshot = {
  teams: FplTeamPayload[];
  events: FplEventPayload[];
  fixtures: FplFixturePayload[];
};

export type FplSnapshotValidationOptions = {
  expectedFixtureCount?: number;
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

export type FixtureUpsertRow = {
  id?: string;
  external_fixture_id: number;
  season_id: string;
  gameweek_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_at: string;
  status: NormalizedFplFixture["status"];
  home_score: number | null;
  away_score: number | null;
  last_synced_at: string;
};

export function buildFixtureUpsertRow(input: {
  fixture: NormalizedFplFixture;
  seasonId: string;
  gameweekId: string;
  homeTeamId: string;
  awayTeamId: string;
  syncedAt: string;
  existingFixtureId?: string;
}): FixtureUpsertRow {
  const row = {
    external_fixture_id: input.fixture.externalFixtureId,
    season_id: input.seasonId,
    gameweek_id: input.gameweekId,
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    kickoff_at: input.fixture.kickoffAt,
    status: input.fixture.status,
    home_score: input.fixture.homeScore,
    away_score: input.fixture.awayScore,
    last_synced_at: input.syncedAt,
  };

  return input.existingFixtureId ? { id: input.existingFixtureId, ...row } : row;
}

export function splitFixtureUpsertRows(rows: readonly FixtureUpsertRow[]) {
  return {
    existingRows: rows.filter((row) => "id" in row),
    newRows: rows.filter((row) => !("id" in row)),
  };
}

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
    status: fixture.postponed
      ? "postponed"
      : fixture.finished || fixture.finished_provisional
        ? "finished"
        : fixture.started
          ? "live"
          : "scheduled",
  };
}

function invalidSnapshot(reason: string, details: Record<string, string | number> = {}): never {
  throw new SyncFailure("FPL_INVALID_SNAPSHOT", "FPL source snapshot is invalid", { reason, ...details });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === "number" && value > 0;
}

function nonNegativeIntegerOrNull(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && typeof value === "number" && value >= 0);
}

function validateUniqueIds(rows: readonly { id: number }[], entity: string): void {
  const seen = new Set<number>();
  for (const row of rows) {
    if (seen.has(row.id)) invalidSnapshot(`duplicate_${entity}_id`, { externalId: row.id });
    seen.add(row.id);
  }
}

export function validateFplSnapshot(value: unknown, options: FplSnapshotValidationOptions = {}): FplSnapshot {
  if (!isRecord(value) || !Array.isArray(value.teams) || !Array.isArray(value.events) || !Array.isArray(value.fixtures)) {
    invalidSnapshot("invalid_root_shape");
  }

  const teams = value.teams.map((team, index): FplTeamPayload => {
    if (
      !isRecord(team)
      || !positiveInteger(team.id)
      || typeof team.name !== "string"
      || team.name.trim().length === 0
      || typeof team.short_name !== "string"
      || team.short_name.trim().length === 0
      || !positiveInteger(team.code)
    ) invalidSnapshot("invalid_team", { index });
    return team as FplTeamPayload;
  });

  const events = value.events.map((event, index): FplEventPayload => {
    if (
      !isRecord(event)
      || !positiveInteger(event.id)
      || typeof event.name !== "string"
      || event.name.trim().length === 0
      || typeof event.is_current !== "boolean"
    ) invalidSnapshot("invalid_gameweek", { index });
    return event as FplEventPayload;
  });

  const fixtures = value.fixtures.map((fixture, index): FplFixturePayload => {
    if (
      !isRecord(fixture)
      || !positiveInteger(fixture.id)
      || !positiveInteger(fixture.event)
      || typeof fixture.kickoff_time !== "string"
      || Number.isNaN(new Date(fixture.kickoff_time).getTime())
      || !positiveInteger(fixture.team_h)
      || !positiveInteger(fixture.team_a)
      || fixture.team_h === fixture.team_a
      || !nonNegativeIntegerOrNull(fixture.team_h_score)
      || !nonNegativeIntegerOrNull(fixture.team_a_score)
      || (fixture.team_h_score === null) !== (fixture.team_a_score === null)
      || typeof fixture.started !== "boolean"
      || typeof fixture.finished !== "boolean"
      || typeof fixture.finished_provisional !== "boolean"
      || (fixture.postponed !== undefined && typeof fixture.postponed !== "boolean")
      || (fixture.finished && fixture.team_h_score === null)
    ) invalidSnapshot("invalid_fixture", { index });
    return fixture as unknown as FplFixturePayload;
  });

  validateUniqueIds(teams, "team");
  validateUniqueIds(events, "gameweek");
  validateUniqueIds(fixtures, "fixture");

  if (options.expectedFixtureCount !== undefined && fixtures.length !== options.expectedFixtureCount) {
    invalidSnapshot("incomplete_fixture_set", { expectedFixtureCount: options.expectedFixtureCount, actualFixtureCount: fixtures.length });
  }

  const teamIds = new Set(teams.map((team) => team.id));
  const eventIds = new Set(events.map((event) => event.id));
  for (const fixture of fixtures) {
    if (!teamIds.has(fixture.team_h) || !teamIds.has(fixture.team_a)) {
      invalidSnapshot("unknown_fixture_team", { externalId: fixture.id });
    }
    if (fixture.event === null || !eventIds.has(fixture.event)) {
      invalidSnapshot("unknown_fixture_gameweek", { externalId: fixture.id });
    }
  }

  return { teams, events, fixtures };
}
