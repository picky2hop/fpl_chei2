import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("Fantasy score method migration allows the captain-x2 calculation version", async () => {
  const source = await readFile(new URL("../../supabase/migrations/20260905160000_fantasy_captain_score_v2.sql", import.meta.url), "utf8");

  assert.match(source, /starting_xi_captain_v1/);
  assert.match(source, /starting_xi_captain_v2/);
  assert.match(source, /drop constraint if exists fantasy_entry_gameweek_scores_calculation_method_check/i);
});
