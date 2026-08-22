import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("partial finished scoring migration recalculates before the whole gameweek is complete", async () => {
  const source = await readFile(new URL("../../supabase/migrations/20260822074947_partial_finished_scoring.sql", import.meta.url), "utf8");

  assert.equal(source.includes("if v_finished_count = 0 then"), true);
  assert.equal(source.includes("v_finished_count = 0 or exists"), false);
  assert.equal(source.includes("status in ('scheduled', 'live')"), true);
});
