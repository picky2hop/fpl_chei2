import assert from "node:assert/strict";
import test from "node:test";
import { playerPresentation } from "../../lib/fantasy/player-presentation.ts";

test("uses distinct position tones and a separate bench tone", () => {
  assert.match(playerPresentation("GK", false).className, /amber/);
  assert.match(playerPresentation("DEF", false).className, /blue/);
  assert.match(playerPresentation("MID", false).className, /green/);
  assert.match(playerPresentation("FWD", false).className, /violet/);
  assert.match(playerPresentation("FWD", true).className, /slate/);
  assert.equal(playerPresentation("FWD", true).label, "FWD · ตัวสำรอง");
});
