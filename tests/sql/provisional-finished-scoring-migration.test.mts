import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("sync migration treats provisional finished fixtures as completed", async () => {
  const source = await readFile(new URL("../../supabase/migrations/20260822092359_provisional_finished_scoring.sql", import.meta.url), "utf8");

  assert.match(source, /finished_provisional/);
  assert.match(source, /finished.*finished_provisional/s);
});
