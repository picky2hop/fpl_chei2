import assert from "node:assert/strict";
import test from "node:test";
import { selectBottomLeaderboardRows, selectTopLeaderboardRows } from "../../lib/fantasy/leaderboard-share-selection.ts";

function rows(ranks: number[]) {
  return ranks.map((rank, index) => ({ rank, id: index }));
}

test("includes every row tied at the Top 5 boundary", () => {
  const selected = selectTopLeaderboardRows(rows([1, 2, 3, 4, 5, 5, 7]));
  assert.equal(selected.length, 6);
  assert.deepEqual(selected.map((row) => row.rank), [1, 2, 3, 4, 5, 5]);
});

test("selects the bottom five ranks and keeps the bottom boundary tie", () => {
  const selected = selectBottomLeaderboardRows(rows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10]));
  assert.equal(selected.length, 6);
  assert.deepEqual(selected.map((row) => row.rank), [6, 7, 8, 9, 10, 10]);
});
