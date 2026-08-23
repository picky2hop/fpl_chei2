import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Fantasy player form migration accepts negative FPL form values", async () => {
  const source = await readFile(new URL("../../supabase/migrations/20260823150000_fantasy_form_negative.sql", import.meta.url), "utf8");

  assert.match(source, /drop constraint if exists fantasy_player_gameweek_stats_form_check/i);
});
