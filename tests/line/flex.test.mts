import test from "node:test";
import assert from "node:assert/strict";
import { buildPredictionResultFlex, buildStandingsFlex } from "../../lib/line/flex.ts";

test("prediction Flex payload contains the selected gameweek and picks", () => {
  const message = buildPredictionResultFlex({
    displayName: "Picky",
    gameweek: 1,
    fixtures: [
      { homeTeam: "Arsenal", awayTeam: "Chelsea", choice: "home" },
      { homeTeam: "Liverpool", awayTeam: "Spurs", choice: "draw" },
    ],
  });

  assert.equal(message.type, "flex");
  assert.equal(message.altText, "FPL Chei Chei · ผลทาย GW1 ของ Picky");
  assert.equal(message.contents.type, "bubble");

  const serialized = JSON.stringify(message);
  assert.match(serialized, /GW1/);
  assert.match(serialized, /Arsenal/);
  assert.match(serialized, /เสมอ/);
  assert.doesNotMatch(serialized, /undefined/);
});

test("standings Flex payload contains rank, player, and points", () => {
  const message = buildStandingsFlex({
    gameweek: 1,
    rows: [
      { rank: 1, displayName: "Picky", points: 6 },
      { rank: 2, displayName: "Chei", points: 3 },
    ],
  });

  assert.equal(message.type, "flex");
  assert.equal(message.altText, "FPL Chei Chei · ตารางคะแนน GW1");
  const serialized = JSON.stringify(message);
  assert.match(serialized, /Picky/);
  assert.match(serialized, /6/);
  assert.match(serialized, /Chei/);
});
