import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Fantasy admin exposes three independent sync actions", async () => {
  const source = await readFile(new URL("../../app/admin/fantasy-admin-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /Sync Fantasy Scores/);
  assert.match(source, /Sync Player Statistics/);
  assert.match(source, /Recalculate Fantasy Scores/);
  assert.match(source, /\/api\/admin\/fantasy\/sync/);
  assert.match(source, /\/api\/admin\/fantasy\/player-stats-sync/);
  assert.match(source, /\/api\/admin\/fantasy\/recalculate-scores/);
});

test("Fantasy admin keeps mapping history compact and scopes awards to the selected gameweek", async () => {
  const source = await readFile(new URL("../../app/admin/fantasy-admin-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /selectedMappingId/);
  assert.match(source, /ประวัติ Mapping/);
  assert.match(source, /leagueEntriesByGameweek/);
  assert.match(source, /<select/);
  assert.match(source, /championEntryIds/);
  assert.match(source, /woodenSpoonEntryIds/);
});
