import assert from "node:assert/strict";
import test from "node:test";
import { countLeaderboardAwards, formatLeaderboardName } from "../lib/leaderboard-awards.ts";

test("counts champion and wooden-spoon awards by leaderboard identity", () => {
  const counts = countLeaderboardAwards([
    { key: "user-a", award: "champion" as const },
    { key: "user-a", award: "wooden_spoon" as const },
    { key: "user-a", award: "champion" as const },
    { key: "user-b", award: "wooden_spoon" as const },
  ], (row) => row.key);

  assert.deepEqual(counts.get("user-a"), { championCount: 2, woodenSpoonCount: 1 });
  assert.deepEqual(counts.get("user-b"), { championCount: 0, woodenSpoonCount: 1 });
  assert.deepEqual(counts.get("missing"), undefined);
});

test("formats every leaderboard name with both award counts", () => {
  assert.equal(formatLeaderboardName("ผู้เล่น A", { championCount: 2, woodenSpoonCount: 1 }), "ผู้เล่น A (🥇2 💩1)");
  assert.equal(formatLeaderboardName("ผู้เล่น B", undefined), "ผู้เล่น B (🥇0 💩0)");
});
