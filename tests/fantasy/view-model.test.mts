import assert from "node:assert/strict";
import test from "node:test";
import { buildFantasyViewModel } from "../../lib/fantasy/view-model.ts";

const payload = {
  currentGameweek: 3,
  selectedLeaderboardGameweek: 1,
  sync: { lastSyncedAt: null, stale: true, message: "stale" },
  leaderboard: { gameweek: [{ mappingId: "gw", points: 1 }], season: [{ mappingId: "season", points: 3 }] },
  playerStats: { selected: {}, transfersIn: {}, transfersOut: {}, form: {}, globalCaptain: null, globalViceCaptain: null },
} as never;

test("view model keeps selected tab/mode, season leaderboard, and stale state", () => {
  const view = buildFantasyViewModel(payload, { tab: "leaderboard", mode: "season", selectedGameweek: 1 });
  assert.equal(view.selectedGameweek, 1);
  assert.equal(view.leaderboard[0].mappingId, "season");
  assert.equal(view.stale, true);
});

test("reset state falls back to current GW", () => {
  assert.equal(buildFantasyViewModel(payload, { tab: "player-stats", mode: "gameweek", selectedGameweek: 0 }).selectedGameweek, 3);
});
