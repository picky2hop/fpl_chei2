import assert from "node:assert/strict";
import test from "node:test";
import { rankVisiblePlayerStats, visiblePlayerStats } from "../../lib/fantasy/player-stats-view.ts";

const groups = {
  selected: { GK: [{ playerId: 1, position: "GK" }], DEF: [{ playerId: 2, position: "DEF" }], MID: [{ playerId: 3, position: "MID" }], FWD: [{ playerId: 4, position: "FWD" }] },
  form: { GK: [], DEF: [], MID: [], FWD: [] },
  transfersIn: { GK: [], DEF: [], MID: [], FWD: [] },
  transfersOut: { GK: [], DEF: [], MID: [], FWD: [] },
};

test("filters player stats by category position or all positions", () => {
  assert.deepEqual(visiblePlayerStats(groups, "selected", "DEF").map((player) => player.playerId), [2]);
  assert.deepEqual(visiblePlayerStats(groups, "selected", "ALL").map((player) => player.playerId), [1, 2, 3, 4]);
});

test("restarts visible player-stat ranks for each position", () => {
  const ranked = rankVisiblePlayerStats(groups, "selected", "ALL");

  assert.deepEqual(ranked.map((item) => [item.player.position, item.rank]), [
    ["GK", 1],
    ["DEF", 1],
    ["MID", 1],
    ["FWD", 1],
  ]);
});
