import type { FantasySquadPlayer } from "./types.ts";

type Position = FantasySquadPlayer["position"];

const positionStyles: Record<Position, string> = {
  GK: "border-amber-300/35 bg-amber-400/15 text-amber-100",
  DEF: "border-blue-300/35 bg-blue-400/15 text-blue-100",
  MID: "border-green-300/35 bg-green-400/15 text-green-100",
  FWD: "border-violet-300/35 bg-violet-400/15 text-violet-100",
};

export function playerPresentation(position: Position, bench: boolean): { label: string; className: string } {
  return {
    label: `${position}${bench ? " · ตัวสำรอง" : ""}`,
    className: bench
      ? "border-slate-300/30 bg-slate-400/15 text-slate-100"
      : positionStyles[position],
  };
}
