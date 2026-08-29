import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("player-stat category migration stores API metrics and latest finished points", async () => {
  const files = await readdir(new URL("../../supabase/migrations/", import.meta.url));
  const migrationName = files.find((file) => file.endsWith("_fantasy_player_stat_categories.sql"));
  assert.ok(migrationName, "expected player-stat category migration");
  const sql = await readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), "utf8");

  for (const column of [
    "defensive_contribution",
    "bps",
    "points_per_game",
    "expected_goal_involvements_per_90",
    "latest_finished_gameweek_points",
  ]) assert.match(sql, new RegExp(column));
  assert.match(sql, /apply_fantasy_player_stats_sync/);
  assert.match(sql, /jsonb_to_recordset\(p_players\)/);
});
