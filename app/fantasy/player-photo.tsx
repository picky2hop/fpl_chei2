"use client";

import Image from "next/image";
import { useState } from "react";
import { buildFplPlayerPhotoUrl } from "@/lib/fantasy/player-image";

export function PlayerPhoto({ playerId, playerName, photoUrl, className = "size-10" }: { playerId: number; playerName: string; photoUrl?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-label={`รูป ${playerName} โหลดไม่ได้`} className={`grid ${className} shrink-0 place-items-center rounded-full bg-[#29435d] text-[10px] font-black text-white/70`}>{playerName.slice(0, 2)}</span>;
  return <Image src={photoUrl ?? buildFplPlayerPhotoUrl(playerId)} alt="" width={40} height={52} unoptimized onError={() => setFailed(true)} className={`${className} shrink-0 rounded-full object-cover object-top`} />;
}
