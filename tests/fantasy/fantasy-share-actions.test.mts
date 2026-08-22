import assert from "node:assert/strict";
import test from "node:test";
import type { ShareTargetPickerApi } from "../../lib/line/share.ts";
import { shareFantasyLeaderboard, shareFantasySquad } from "../../lib/fantasy/fantasy-share-actions.ts";

const leaderboardInput = {
  leagueName: "เชยเชย Cup",
  gameweek: 3,
  period: "gameweek" as const,
  rows: [],
};

const squadInput = {
  managerName: "Picky",
  managerAvatarUrl: null,
  teamName: "Chei FC",
  squad: {
    gameweekNumber: 3,
    formation: "3-4-3",
    captainPlayerId: null,
    viceCaptainPlayerId: null,
    starters: [],
    bench: [],
  },
};

function api(result: unknown, available = true): ShareTargetPickerApi {
  return {
    isApiAvailable: () => available,
    shareTargetPicker: async () => result,
  };
}

test("returns shared after the LINE picker succeeds", async () => {
  const result = await shareFantasyLeaderboard(api({ status: "success" }), leaderboardInput);
  assert.equal(result.state, "shared");
});

test("returns cancelled without reporting success when the picker is cancelled", async () => {
  const result = await shareFantasyLeaderboard(api({ status: "cancelled" }), leaderboardInput);
  assert.equal(result.state, "cancelled");
  assert.match(result.message ?? "", /ยกเลิก/);
});

test("returns a safe error when shareTargetPicker is unavailable", async () => {
  const result = await shareFantasySquad(api({ status: "success" }, false), squadInput);
  assert.equal(result.state, "error");
  assert.match(result.message ?? "", /LINE WebView/);
});

test("maps a rejected picker promise to a safe error", async () => {
  const rejectedApi: ShareTargetPickerApi = {
    isApiAvailable: () => true,
    shareTargetPicker: async () => { throw new Error("network details"); },
  };
  const result = await shareFantasyLeaderboard(rejectedApi, leaderboardInput);
  assert.equal(result.state, "error");
  assert.match(result.message ?? "", /แชร์เข้า LINE ไม่สำเร็จ/);
  assert.doesNotMatch(result.message ?? "", /network details/);
});
