import assert from "node:assert/strict";
import test from "node:test";
import { selectPreferredFantasyTeam } from "../../lib/data/line-bot-core.ts";

test("selects Chei Chei before Khao Kho when a LINE user has both mapped teams", () => {
  const selected = selectPreferredFantasyTeam([
    { leagueFplId: 819502, leagueName: "เขาค้อ inLove", entryId: 502 },
    { leagueFplId: 819498, leagueName: "เชยเชย Cup", entryId: 498 },
  ]);

  assert.equal(selected?.leagueFplId, 819498);
  assert.equal(selected?.entryId, 498);
});

test("falls back to Khao Kho when a LINE user has no Chei Chei team", () => {
  const selected = selectPreferredFantasyTeam([
    { leagueFplId: 819502, leagueName: "เขาค้อ inLove", entryId: 502 },
  ]);

  assert.equal(selected?.leagueFplId, 819502);
  assert.equal(selected?.entryId, 502);
});

test("returns no team when a LINE user has no mapped team in either league", () => {
  assert.equal(selectPreferredFantasyTeam([]), null);
});
