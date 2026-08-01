"use client";

import Image from "next/image";
import Link from "next/link";
import LiffGate from "./components/liff-gate";
import { hasAvatarImage } from "@/lib/avatar";
import type { UserProfile } from "@/lib/mock-data";

const features = ["ข้อมูลกระชับ เปิดไว", "ทายครบทุกคู่ในเกมวีค", "แชร์ผลเข้า LINE ได้ทันที"];

function LandingPage({ profile }: { profile: UserProfile }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#071525] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-5 pb-8 pt-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#d9ff58] text-[#071525] shadow-[0_8px_30px_rgba(217,255,88,0.18)]"><span className="text-lg font-black">90′</span></div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#9fb0c4]">FPL CHEI CHEI</p><p className="mt-0.5 text-sm font-bold">สนามทายผลของแก๊งเรา</p></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2"><div className="relative size-7 overflow-hidden rounded-full bg-[#22384f]">{hasAvatarImage(profile.avatarUrl) ? <Image src={profile.avatarUrl} alt={profile.displayName} fill sizes="28px" className="object-cover" unoptimized /> : <span className="absolute inset-0 grid place-items-center text-[9px] font-black text-white/80">{profile.shortName}</span>}</div><span className="max-w-20 truncate text-[10px] font-bold text-[#d7e1eb]">{profile.displayName}</span></div>
        </header>

        <section className="relative flex flex-1 flex-col justify-center py-14"><div className="pointer-events-none absolute -right-28 top-20 size-72 rounded-full bg-[#123e63]/70 blur-3xl" /><div className="pointer-events-none absolute -left-36 bottom-20 size-72 rounded-full bg-[#213b20]/60 blur-3xl" /><div className="relative"><p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d9ff58]/20 bg-[#d9ff58]/10 px-3 py-1.5 text-xs font-semibold text-[#d9ff58]"><span className="size-1.5 rounded-full bg-[#d9ff58]" />Welcome to the group league</p><h1 className="max-w-[460px] text-5xl font-black leading-[1.03] tracking-[-0.07em] sm:text-6xl">เกมพรีเมียร์ลีก<br /><span className="text-[#d9ff58]">ที่เราเชยด้วยกัน</span></h1><p className="mt-6 max-w-sm text-base leading-7 text-[#afc0d0]">ทายผลแข่งกับเพื่อนในกลุ่ม ดูฟอร์มแบบสั้น ๆ แล้วลุ้นกันทุกสุดสัปดาห์</p><div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#afc0d0]">{features.map((feature) => <span key={feature} className="flex items-center gap-1.5"><span className="text-[#d9ff58]">✦</span>{feature}</span>)}</div></div></section>

        <section className="relative space-y-3"><Link href="/dashboard" className="group flex items-center justify-between rounded-[24px] bg-[#d9ff58] px-5 py-4 text-[#071525] transition-transform hover:-translate-y-0.5 active:translate-y-0"><span><span className="block text-xs font-bold uppercase tracking-[0.22em] text-[#4d6622]">Main game</span><span className="mt-0.5 block text-xl font-black tracking-tight">ทายผลพรีเมียร์ลีก</span></span><span className="grid size-11 place-items-center rounded-full bg-[#071525] text-xl text-[#d9ff58] transition-transform group-hover:translate-x-1">→</span></Link><button type="button" disabled className="flex w-full cursor-not-allowed items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-left opacity-65"><span><span className="block text-xs font-bold uppercase tracking-[0.22em] text-[#8498ac]">Coming soon</span><span className="mt-0.5 block text-xl font-black tracking-tight">แฟนตาซีเชยเชย</span></span><span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold text-[#9fb0c4]">ยังไม่เปิด</span></button><p className="pt-2 text-center text-[11px] text-[#6f859b]">เข้าสู่ระบบด้วย LINE แล้ว · Preview mode</p></section>
      </div>
    </main>
  );
}

export default function Home() {
  return <LiffGate>{(profile) => <LandingPage profile={profile} />}</LiffGate>;
}
