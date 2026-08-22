import assert from "node:assert/strict";
import test from "node:test";
import { squadRows } from "../../lib/fantasy/squad-layout.ts";
import type { FantasyEntryCurrentSquad } from "../../lib/fantasy/types.ts";

const player = (playerId: number, position: "GK" | "DEF" | "MID" | "FWD") => ({
  pickPosition: playerId,
  playerId,
  playerName: `Player ${playerId}`,
  position,
  clubName: "Club",
  multiplier: position === "FWD" ? 2 : 1,
  isCaptain: position === "FWD",
  isViceCaptain: false,
  points: playerId,
});

test("organizes a current squad into five ordered display rows", () => {
  const squad: FantasyEntryCurrentSquad = {
    gameweekNumber: 3,
    formation: "3-4-3",
    captainPlayerId: 4,
    viceCaptainPlayerId: null,
    starters: [player(1, "GK"), player(2, "DEF"), player(3, "MID"), player(4, "FWD")],
    bench: [player(5, "MID")],
  };

  assert.deepEqual(squadRows(squad).map((row) => [row.key, row.players.map((item) => item.playerId)]), [
    ["GK", [1]],
    ["DEF", [2]],
    ["MID", [3]],
    ["FWD", [4]],
    ["BENCH", [5]],
  ]);
});
