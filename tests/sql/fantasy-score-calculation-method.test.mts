import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260825125557_fantasy_score_calculation_method.sql", import.meta.url);

test("adds an explicit calculation method for multi-league Fantasy scores", async () => {
  const source = await readFile(migrationPath, "utf8");

  assert.match(source, /fantasy_entry_gameweek_scores/);
  assert.match(source, /calculation_method\s+text\s+not null\s+default\s+'legacy_fpl_history'/i);
  assert.match(source, /legacy_fpl_history/);
  assert.match(source, /starting_xi_captain_v1/);
  assert.match(source, /apply_fantasy_league_sync/);
  assert.match(source, /calculation_method/);
  assert.match(source, /apply_fantasy_score_recalculation/);
  assert.match(source, /apply_fantasy_player_stats_sync/);
  assert.match(source, /security invoker/i);
  assert.doesNotMatch(source, /fantasy_gameweek_scores/);
});
