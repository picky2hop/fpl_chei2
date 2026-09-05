import assert from "node:assert/strict";
import test from "node:test";
import { calculateStartingXiCaptainScore } from "../../lib/fantasy/fantasy-score-calculator.ts";
import type { FantasySquadPlayer } from "../../lib/fantasy/types.ts";

function picks(input: { captainPoints?: number; starterPoints?: number; benchPoints?: number; captainPosition?: number; captainMultiplier?: number; nullStarterPosition?: number; duplicatePosition?: boolean } = {}): FantasySquadPlayer[] {
  const captainPosition = input.captainPosition ?? 5;
  const starterPoints = input.starterPoints ?? 52;
  const benchPoints = input.benchPoints ?? 100;
  const baseStarterPoints = starterPoints - (input.captainPoints ?? 8);
  const starters = Array.from({ length: 11 }, (_, index) => ({
    pickPosition: index + 1,
    playerId: index + 1,
    playerName: `Starter ${index + 1}`,
    position: index === 0 ? "GK" as const : index < 5 ? "DEF" as const : index < 9 ? "MID" as const : "FWD" as const,
    clubName: "Club",
    multiplier: index + 1 === captainPosition ? input.captainMultiplier ?? 2 : 1,
    isCaptain: index + 1 === captainPosition,
    isViceCaptain: false,
    points: index + 1 === captainPosition ? input.captainPoints ?? 8 : index === 0 ? baseStarterPoints : 0,
  }));
  const bench = Array.from({ length: 4 }, (_, index) => ({
    pickPosition: index + 12,
    playerId: index + 12,
    playerName: `Bench ${index + 1}`,
    position: "DEF" as const,
    clubName: "Club",
    multiplier: 0,
    isCaptain: false,
    isViceCaptain: false,
    points: benchPoints,
  }));
  const result = [...starters, ...bench];
  if (input.nullStarterPosition) result[input.nullStarterPosition - 1].points = null;
  if (input.duplicatePosition) result[1].pickPosition = 1;
  return result;
}

test("sums positions 1 through 11 and adds the captain raw points once", () => {
  assert.deepEqual(calculateStartingXiCaptainScore(picks()), {
    points: 60,
    captainPlayerId: 5,
    calculationMethod: "starting_xi_captain_v2",
  });
});

test("ignores the FPL Triple Captain multiplier and still adds the captain raw points once", () => {
  assert.equal(calculateStartingXiCaptainScore(picks({ starterPoints: 16, captainPoints: 8, captainMultiplier: 3 })).points, 24);
});

test("excludes non-zero bench points", () => {
  assert.equal(calculateStartingXiCaptainScore(picks({ benchPoints: 999 })).points, 60);
});

test("accepts negative player points", () => {
  assert.equal(calculateStartingXiCaptainScore(picks({ starterPoints: -4, captainPoints: -2 })).points, -6);
});

test("rejects incomplete or duplicate pick positions", () => {
  assert.throws(() => calculateStartingXiCaptainScore(picks().slice(0, 14)), /15/);
  assert.throws(() => calculateStartingXiCaptainScore(picks({ duplicatePosition: true })), /position/);
});

test("rejects null starter points and a missing starting captain", () => {
  assert.throws(() => calculateStartingXiCaptainScore(picks({ nullStarterPosition: 1 })), /points/);
  const noCaptain = picks().map((player) => ({ ...player, isCaptain: false, multiplier: 1 }));
  assert.throws(() => calculateStartingXiCaptainScore(noCaptain), /captain/);
});

test("uses the vice-captain multiplier when FPL moves the original captain to the bench", () => {
  const autoSubstituted = picks().map((player) => {
    if (player.playerId === 5) return { ...player, isCaptain: false, isViceCaptain: true, multiplier: 2 };
    if (player.playerId === 12) return { ...player, isCaptain: true, multiplier: 0 };
    return player;
  });

  assert.deepEqual(calculateStartingXiCaptainScore(autoSubstituted), {
    points: 60,
    captainPlayerId: 5,
    calculationMethod: "starting_xi_captain_v2",
  });
});
