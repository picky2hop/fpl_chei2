import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sync migration treats provisional finished fixtures as completed", async () => {
  const source = await readFile(new URL("../../supabase/migrations/20260822092359_provisional_finished_scoring.sql", import.meta.url), "utf8");

  assert.match(source, /finished_provisional/);
  assert.match(source, /finished.*finished_provisional/s);
});

test("prediction award migration removes participants without an active GW prediction", async () => {
  const source = await readFile(new URL("../../supabase/migrations/20260825120000_prediction_awards_require_active_prediction.sql", import.meta.url), "utf8");

  assert.match(source, /apply_fpl_sync_legacy/);
  assert.match(source, /delete from public\.gameweek_scores/);
  assert.match(source, /delete from public\.gameweek_awards/);
  assert.match(source, /not exists[\s\S]*gameweek_participants[\s\S]*predictions[\s\S]*fixtures/);
});
