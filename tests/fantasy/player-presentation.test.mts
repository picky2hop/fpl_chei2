import assert from "node:assert/strict";
import test from "node:test";
import { fantasyPlayersTotalPoints, formatFantasyShareTimestamp, playerDisplayPoints, playerHighlight, playerPresentation } from "../../lib/fantasy/player-presentation.ts";

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

test("formats share timestamps in the Bangkok Buddhist calendar", () => {
  assert.equal(formatFantasyShareTimestamp(new Date("2026-08-24T14:45:00.000Z")), "แชร์เมื่อ 24/08/2569 21:45 น.");
});

test("sums display points and applies the captain multiplier", () => {
  const player = {
    pickPosition: 1,
    playerId: 10,
    playerName: "Player",
    position: "FWD" as const,
    clubName: "Club",
    multiplier: 1,
    isCaptain: false,
    isViceCaptain: false,
    points: 2,
  };

  assert.equal(fantasyPlayersTotalPoints([
    { ...player, points: 6, isCaptain: true },
    player,
  ]), 14);
});

test("highlights only Player of the Week IDs", () => {
  const ids = new Set([10]);
  assert.deepEqual(playerHighlight(10, ids), { label: "Player of the Week", className: "border-[#d9ff58] bg-[#d9ff58]/10" });
  assert.deepEqual(playerHighlight(11, ids), { label: null, className: "" });
});
