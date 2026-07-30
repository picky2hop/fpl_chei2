import test from "node:test";
import assert from "node:assert/strict";
import { buildFixtureUpsertRow, normalizeFplFixture, splitFixtureUpsertRows } from "../../lib/sync/fpl-core.ts";

const fixture = normalizeFplFixture({
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
});

const baseInput = {
  fixture,
  seasonId: "season-1",
  gameweekId: "gameweek-4",
  homeTeamId: "team-home",
  awayTeamId: "team-away",
  syncedAt: "2026-07-30T00:00:00.000Z",
};

test("omits the internal id for a new fixture so the database default can generate it", () => {
  const row = buildFixtureUpsertRow(baseInput);

  assert.equal("id" in row, false);
  assert.equal(row.external_fixture_id, 123);
});

test("preserves the existing internal id when updating a fixture", () => {
  const row = buildFixtureUpsertRow({ ...baseInput, existingFixtureId: "fixture-1" });

  assert.equal(row.id, "fixture-1");
  assert.equal(row.external_fixture_id, 123);
});

test("partitions existing and new fixture rows before bulk upsert", () => {
  const existingRow = buildFixtureUpsertRow({ ...baseInput, existingFixtureId: "fixture-1" });
  const newRow = buildFixtureUpsertRow(baseInput);

  const partitions = splitFixtureUpsertRows([existingRow, newRow]);

  assert.deepEqual(partitions.existingRows, [existingRow]);
  assert.deepEqual(partitions.newRows, [newRow]);
});
