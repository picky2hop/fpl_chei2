import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../../supabase/migrations/20260829120000_fantasy_historical_membership_recalculation.sql", import.meta.url);

test("historical Fantasy recalculation migration upserts memberships atomically with scores", async () => {
  const source = await readFile(migrationPath, "utf8");

  assert.match(source, /apply_fantasy_score_recalculation/);
  assert.match(source, /p_memberships\s+jsonb/i);
  assert.match(source, /fantasy_league_membership_snapshots/);
  assert.match(source, /jsonb_to_recordset\(p_memberships\)/);
  assert.match(source, /fantasy_entry_gameweek_scores/);
  assert.match(source, /security invoker/i);
});
