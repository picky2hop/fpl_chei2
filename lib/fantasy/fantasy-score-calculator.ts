import type { FantasySquadPlayer } from "./types.ts";

export type FantasyCalculatedScore = {
  points: number;
  captainPlayerId: number;
  calculationMethod: "starting_xi_captain_v1";
};

export function calculateStartingXiCaptainScore(picks: FantasySquadPlayer[]): FantasyCalculatedScore {
  if (picks.length !== 15) throw new Error("Fantasy score requires 15 picks");

  const sorted = [...picks].sort((left, right) => left.pickPosition - right.pickPosition);
  if (sorted.some((pick, index) => pick.pickPosition !== index + 1)) {
    throw new Error("Fantasy pick positions are invalid");
  }

  const starters = sorted.slice(0, 11);
  const captains = starters.filter((player) => player.multiplier > 1);
  if (captains.length !== 1) throw new Error("Fantasy starting captain is invalid");
  if (starters.some((player) => typeof player.points !== "number" || !Number.isFinite(player.points))) {
    throw new Error("Fantasy starter points are invalid");
  }

  const starterPoints = starters.reduce((total, player) => total + player.points! * player.multiplier, 0);
  return {
    points: starterPoints,
    captainPlayerId: captains[0].playerId,
    calculationMethod: "starting_xi_captain_v1",
  };
}
