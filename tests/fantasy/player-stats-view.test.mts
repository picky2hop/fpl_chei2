import assert from "node:assert/strict";
import test from "node:test";
import { visiblePlayerStats } from "../../lib/fantasy/player-stats-view.ts";

const groups = {
  selected: { GK: [{ playerId: 1 }], DEF: [{ playerId: 2 }], MID: [{ playerId: 3 }], FWD: [{ playerId: 4 }] },
  form: { GK: [], DEF: [], MID: [], FWD: [] },
  transfersIn: { GK: [], DEF: [], MID: [], FWD: [] },
  transfersOut: { GK: [], DEF: [], MID: [], FWD: [] },
};

test("filters player stats by category position or all positions", () => {
  assert.deepEqual(visiblePlayerStats(groups, "selected", "DEF").map((player) => player.playerId), [2]);
  assert.deepEqual(visiblePlayerStats(groups, "selected", "ALL").map((player) => player.playerId), [1, 2, 3, 4]);
});
