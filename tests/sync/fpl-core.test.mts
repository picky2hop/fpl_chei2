import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFplFixture, type FplFixturePayload } from "../../lib/sync/fpl-core.ts";

const baseFixture: FplFixturePayload = {
  id: 123,
  event: 4,
  kickoff_time: "2026-08-22T11:30:00Z",
  team_h: 1,
  team_a: 2,
  team_h_score: null,
  team_a_score: null,
  started: false,
  finished: false,
  finished_provisional: false,
  postponed: false,
};

test("normalizes scheduled, live, finished, and postponed fixtures", () => {
  assert.equal(normalizeFplFixture(baseFixture).status, "scheduled");
  assert.equal(normalizeFplFixture({ ...baseFixture, started: true }).status, "live");
  assert.equal(normalizeFplFixture({ ...baseFixture, finished: true, team_h_score: 2, team_a_score: 1 }).status, "finished");
  assert.equal(normalizeFplFixture({ ...baseFixture, postponed: true }).status, "postponed");
});

test("rejects fixtures without a gameweek or kickoff time", () => {
  assert.throws(() => normalizeFplFixture({ ...baseFixture, event: null }), /gameweek/);
  assert.throws(() => normalizeFplFixture({ ...baseFixture, kickoff_time: null }), /kickoff/);
});

test("preserves source fixture identity and scores", () => {
  assert.deepEqual(normalizeFplFixture({ ...baseFixture, finished: true, team_h_score: 3, team_a_score: 0 }), {
    externalFixtureId: 123,
    externalGameweekId: 4,
    kickoffAt: "2026-08-22T11:30:00.000Z",
    homeExternalTeamId: 1,
    awayExternalTeamId: 2,
    homeScore: 3,
    awayScore: 0,
    status: "finished",
  });
});
