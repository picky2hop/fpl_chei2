import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("player-stat category migration stores API metrics and latest finished points", async () => {
  const files = await readdir(new URL("../../supabase/migrations/", import.meta.url));
  const migrationNames = files
    .filter(
      (file) =>
        file.endsWith("_fantasy_player_stat_categories.sql") ||
        file.endsWith("_fantasy_player_latest_finished_metrics.sql"),
    )
    .sort();
  assert.equal(migrationNames.length, 2, "expected player-stat category migrations");
  const sql = (
    await Promise.all(
      migrationNames.map((migrationName) =>
        readFile(new URL(`../../supabase/migrations/${migrationName}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");

  for (const column of [
    "defensive_contribution",
    "bps",
    "points_per_game",
    "expected_goal_involvements_per_90",
    "latest_finished_gameweek_points",
    "latest_finished_gameweek_defensive_contribution",
    "latest_finished_gameweek_bps",
    "latest_finished_gameweek_number",
  ]) assert.match(sql, new RegExp(column));
  assert.match(sql, /apply_fantasy_player_stats_sync/);
  assert.match(sql, /jsonb_to_recordset\(p_players\)/);
});
