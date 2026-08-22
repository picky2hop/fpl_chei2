import assert from "node:assert/strict";
import test from "node:test";
import { playerDisplayPoints, playerPresentation } from "../../lib/fantasy/player-presentation.ts";

test("uses distinct position tones and a separate bench tone", () => {
  assert.match(playerPresentation("GK", false).className, /amber/);
  assert.match(playerPresentation("DEF", false).className, /blue/);
  assert.match(playerPresentation("MID", false).className, /green/);
  assert.match(playerPresentation("FWD", false).className, /violet/);
  assert.match(playerPresentation("FWD", true).className, /slate/);
  assert.equal(playerPresentation("FWD", true).label, "FWD · ตัวสำรอง");
});

test("shows captain points multiplied by two while preserving the raw score", () => {
  assert.deepEqual(playerDisplayPoints({ points: 6, isCaptain: true }), { raw: 6, multiplier: 2, total: 12, label: "6 × 2 = 12" });
  assert.deepEqual(playerDisplayPoints({ points: 6, isCaptain: false }), { raw: 6, multiplier: 1, total: 6, label: "6" });
});
