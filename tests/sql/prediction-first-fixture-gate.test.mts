import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prediction write RPCs enforce the first non-postponed fixture gate", async () => {
  const source = await readFile(new URL("../../supabase/migrations/20260829130000_prediction_first_fixture_gate.sql", import.meta.url), "utf8");

  assert.equal(source.match(/create or replace function public\.save_prediction\(/g)?.length, 1);
  assert.equal(source.match(/create or replace function public\.save_predictions/g)?.length, 1);
  assert.equal(source.match(/FIRST_FIXTURE_MISSED/g)?.length, 2);
  assert.equal(source.match(/status <> 'postponed'/g)?.length, 2);
  assert.equal(source.match(/order by kickoff_at, external_fixture_id/g)?.length, 2);
  assert.equal(source.match(/\bp\.status = 'active'/g)?.length, 2);
});
