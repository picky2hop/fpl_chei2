"use client";

import Image from "next/image";
import { useState } from "react";

export function PlayerPhoto({ playerName, photoUrl, className = "size-10" }: { playerName: string; photoUrl?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !photoUrl) return <span aria-label={`รูป ${playerName} โหลดไม่ได้`} className={`grid ${className} shrink-0 place-items-center rounded-full bg-[#29435d] text-[10px] font-black text-white/70`}>{playerName.slice(0, 2)}</span>;
  return <Image src={photoUrl} alt="" width={40} height={52} unoptimized onError={() => setFailed(true)} className={`${className} shrink-0 rounded-full object-cover object-top`} />;
}
