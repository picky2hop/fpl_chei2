import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminFantasyPlayerStatsSyncHandler,
  createAdminFantasyRecalculateScoresHandler,
  createAdminFantasyScoreSyncHandler,
} from "../../lib/api/admin-fantasy-handler.ts";

test("admin Fantasy sync handlers reject non-admin requests", async () => {
  const dependencies = { requireAdmin: async () => { throw new Error("no"); }, run: async () => ({ currentGameweek: 1 }) };
  assert.equal((await createAdminFantasyScoreSyncHandler(dependencies)()).status, 403);
  assert.equal((await createAdminFantasyPlayerStatsSyncHandler(dependencies)()).status, 403);
  assert.equal((await createAdminFantasyRecalculateScoresHandler(dependencies)()).status, 403);
});

test("admin Fantasy handlers call their separate action and return partial details", async () => {
  const calls: string[] = [];
  const score = createAdminFantasyScoreSyncHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    run: async () => { calls.push("scores"); return { currentGameweek: 2, failedScoreTargets: [{ entryId: 10, gameweek: 2, reason: "FPL API ไม่พร้อมให้บริการ" }], message: "ล้มเหลว 1 รายการ" }; },
  });
  const player = createAdminFantasyPlayerStatsSyncHandler({ requireAdmin: async () => ({ id: "admin-1" }), run: async () => { calls.push("players"); return { currentGameweek: 2, message: "player ok" }; } });
  const recalculate = createAdminFantasyRecalculateScoresHandler({ requireAdmin: async () => ({ id: "admin-1" }), run: async () => { calls.push("recalculate"); return { currentGameweek: 2, message: "recalculate ok" }; } });

  const scoreResponse = await score();
  assert.equal(scoreResponse.status, 200);
  assert.deepEqual(await scoreResponse.json(), { currentGameweek: 2, failedScoreTargets: [{ entryId: 10, gameweek: 2, reason: "FPL API ไม่พร้อมให้บริการ" }], message: "ล้มเหลว 1 รายการ" });
  assert.equal((await player()).status, 200);
  assert.equal((await recalculate()).status, 200);
  assert.deepEqual(calls, ["scores", "players", "recalculate"]);
});
