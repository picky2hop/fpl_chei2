import type { FantasyEntryCurrentSquad, FantasySquadPlayer } from "./types.ts";

export type SquadRow = {
  key: "GK" | "DEF" | "MID" | "FWD" | "BENCH";
  label: string;
  players: FantasySquadPlayer[];
};

export function squadRows(squad: FantasyEntryCurrentSquad): SquadRow[] {
  return [
    { key: "GK", label: "ผู้รักษาประตู", players: squad.starters.filter((player) => player.position === "GK") },
    { key: "DEF", label: "กองหลัง", players: squad.starters.filter((player) => player.position === "DEF") },
    { key: "MID", label: "กองกลาง", players: squad.starters.filter((player) => player.position === "MID") },
    { key: "FWD", label: "กองหน้า", players: squad.starters.filter((player) => player.position === "FWD") },
    { key: "BENCH", label: "ตัวสำรอง", players: squad.bench },
  ];
}
