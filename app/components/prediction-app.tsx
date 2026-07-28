"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  applyPrediction,
  isPredictionComplete,
  type PredictionChoice,
  type PredictionMap,
} from "@/lib/predictions";
import type {
  Fixture,
  Gameweek,
  LeaderboardEntry,
  UserProfile,
} from "@/lib/mock-data";

type Tab = "leaderboard" | "predictions" | "results";

type PredictionAppProps = {
  currentUser: UserProfile;
  gameweeks: Gameweek[];
  fixturesByGameweek: Record<number, Fixture[]>;
  leaderboardByGameweek: Record<number, LeaderboardEntry[]>;
};

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "leaderboard", label: "ตารางคะแนน", icon: "↗" },
  { id: "predictions", label: "ทายผล", icon: "✦" },
  { id: "results", label: "ผลแข่ง", icon: "✓" },
];

const choiceStyles: Record<PredictionChoice, string> = {
  home: "border-[#ff647c] bg-[#ff647c] text-white shadow-[0_8px_20px_rgba(255,100,124,0.2)]",
  draw: "border-[#47d7a0] bg-[#47d7a0] text-[#06221a] shadow-[0_8px_20px_rgba(71,215,160,0.2)]",
  away: "border-[#6da9ff] bg-[#6da9ff] text-[#06182d] shadow-[0_8px_20px_rgba(109,169,255,0.2)]",
};

function Avatar({ user, size = 40 }: { user: UserProfile; size?: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-full bg-[#22384f]" style={{ width: size, height: size }}>
      <Image src={user.avatarUrl} alt={user.displayName} fill sizes={`${size}px`} className="object-cover" unoptimized />
      <span className="absolute inset-0 grid place-items-center text-xs font-black text-white/80">{user.shortName}</span>
    </div>
  );
}

function TeamLogo({ fixtureTeam }: { fixtureTeam: Fixture["homeTeam"] }) {
  return (
    <div className="relative grid size-10 place-items-center rounded-[14px] bg-white p-1.5 shadow-sm">
      <Image src={fixtureTeam.crest} alt={`${fixtureTeam.name} crest`} width={32} height={32} className="object-contain" unoptimized />
    </div>
  );
}

function StatusPill({ fixture }: { fixture: Fixture }) {
  if (fixture.status === "finished") return <span className="rounded-full bg-[#e9edf2] px-2 py-1 text-[10px] font-bold text-[#5e7184]">จบแล้ว</span>;
  if (fixture.status === "live") return <span className="flex items-center gap-1 rounded-full bg-[#ff647c]/10 px-2 py-1 text-[10px] font-bold text-[#ff647c]"><span className="size-1.5 animate-pulse rounded-full bg-current" />LIVE</span>;
  return <span className="rounded-full bg-[#d9ff58]/15 px-2 py-1 text-[10px] font-bold text-[#7c9f18]">รอแข่ง</span>;
}

function GameweekPicker({ gameweeks, value, onChange }: { gameweeks: Gameweek[]; value: number; onChange: (value: number) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">เลือกเกมวีค</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="appearance-none rounded-full border border-[#dfe6ed] bg-white py-2 pl-3 pr-8 text-xs font-black text-[#0c2137] outline-none transition focus:border-[#8fb42f]">
        {gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.id}>{gameweek.label} · {gameweek.fixtureCount} คู่</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6d8297]">⌄</span>
    </label>
  );
}

function Leaderboard({ entries, gameweek, seasonMode, onSeasonModeChange }: { entries: LeaderboardEntry[]; gameweek: number; seasonMode: "gameweek" | "season"; onSeasonModeChange: (mode: "gameweek" | "season") => void }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#75899e]">Leaderboard</p><h2 className="mt-1 text-2xl font-black tracking-tight text-[#0c2137]">ตารางคะแนน</h2></div><div className="flex rounded-full bg-[#edf1f4] p-1 text-[11px] font-bold"><button type="button" onClick={() => onSeasonModeChange("gameweek")} className={`rounded-full px-3 py-1.5 transition ${seasonMode === "gameweek" ? "bg-[#0c2137] text-white" : "text-[#6f8295]"}`}>GW {gameweek}</button><button type="button" onClick={() => onSeasonModeChange("season")} className={`rounded-full px-3 py-1.5 transition ${seasonMode === "season" ? "bg-[#0c2137] text-white" : "text-[#6f8295]"}`}>ทั้งฤดูกาล</button></div></div>
      <div className="overflow-hidden rounded-[24px] border border-[#e6ebf0] bg-white shadow-[0_12px_35px_rgba(12,33,55,0.06)]"><div className="flex items-center justify-between border-b border-[#eef1f4] bg-[#f7f9fa] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#8192a3]"><span>Rank · Player</span><span>Points</span></div><div className="divide-y divide-[#eef1f4]">{entries.map((entry) => { const points = seasonMode === "season" ? entry.seasonPoints : entry.gameweekPoints; return <div key={entry.id} className={`flex items-center gap-3 px-4 py-3.5 ${entry.rank === 1 ? "bg-[#fbfdec]" : ""}`}><span className={`w-5 text-center text-sm font-black ${entry.rank === 1 ? "text-[#9bbd2a]" : "text-[#8da0b1]"}`}>{String(entry.rank).padStart(2, "0")}</span><Avatar user={entry} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#0c2137]">{entry.displayName}</p><div className="mt-1 flex items-center gap-1.5"><div className="flex gap-1">{entry.form.map((value, index) => <span key={`${entry.id}-${index}`} className={`size-1.5 rounded-full ${value >= 3 ? "bg-[#47d7a0]" : value === 0 ? "bg-[#dbe2e8]" : "bg-[#ffc857]"}`} />)}</div><span className={`text-[10px] font-bold ${entry.trend === "up" ? "text-[#1aa878]" : entry.trend === "down" ? "text-[#e35e73]" : "text-[#91a1af]"}`}>{entry.trend === "up" ? "↑ ขึ้นมา" : entry.trend === "down" ? "↓ หล่นลง" : "— เท่าเดิม"}</span></div></div><div className="text-right"><p className="text-lg font-black text-[#0c2137]">{points}</p><p className="text-[10px] font-bold text-[#92a1af]">คะแนน</p></div></div>; })}</div></div>
      <button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#dfe7ed] bg-white py-3 text-sm font-extrabold text-[#0c2137] transition hover:border-[#b4ca55] hover:bg-[#fbfdec]">แชร์ตารางคะแนนเข้า LINE <span className="text-[#4c9e77]">↗</span></button>
    </section>
  );
}

function FixturePredictionCard({ fixture, choice, onChoose }: { fixture: Fixture; choice?: PredictionChoice; onChoose: (choice: PredictionChoice) => void }) {
  const choices: { id: PredictionChoice; label: string; sublabel: string }[] = [{ id: "home", label: "เหย้า", sublabel: fixture.homeTeam.shortName }, { id: "draw", label: "เสมอ", sublabel: "X" }, { id: "away", label: "เยือน", sublabel: fixture.awayTeam.shortName }];
  return <article className="rounded-[24px] border border-[#e6ebf0] bg-white p-4 shadow-[0_12px_35px_rgba(12,33,55,0.045)]"><div className="mb-4 flex items-center justify-between"><p className="text-[11px] font-bold text-[#7b8e9f]">{fixture.dateLabel}</p><StatusPill fixture={fixture} /></div><div className="mb-4 flex items-center justify-center gap-4"><div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><TeamLogo fixtureTeam={fixture.homeTeam} /><p className="truncate text-xs font-extrabold text-[#0c2137]">{fixture.homeTeam.name}</p></div><span className="text-xs font-black text-[#a2afbb]">VS</span><div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><TeamLogo fixtureTeam={fixture.awayTeam} /><p className="truncate text-xs font-extrabold text-[#0c2137]">{fixture.awayTeam.name}</p></div></div><div className="grid grid-cols-3 gap-2">{choices.map((item) => <button key={item.id} type="button" onClick={() => onChoose(item.id)} className={`rounded-2xl border py-2.5 transition ${choice === item.id ? choiceStyles[item.id] : "border-[#e3e9ee] bg-[#f7f9fa] text-[#75899b] hover:border-[#b8c6d1]"}`}><span className="block text-xs font-black">{item.label}</span><span className="mt-0.5 block text-[10px] font-bold opacity-75">{item.sublabel}</span></button>)}</div></article>;
}

function Predictions({ fixtures, predictions, onChoose, onConfirm }: { fixtures: Fixture[]; predictions: PredictionMap; onChoose: (fixtureId: string, choice: PredictionChoice) => void; onConfirm: () => void }) {
  const fixtureIds = fixtures.map((fixture) => fixture.id);
  const complete = isPredictionComplete(fixtureIds, predictions);
  const selected = fixtureIds.filter((fixtureId) => predictions[fixtureId]).length;
  return <section className="space-y-4"><div className="flex items-end justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#75899e]">Make your call</p><h2 className="mt-1 text-2xl font-black tracking-tight text-[#0c2137]">ทายผลเกมวีคนี้</h2></div><span className="rounded-full bg-[#0c2137] px-3 py-2 text-[11px] font-black text-white">{selected}/{fixtures.length} คู่</span></div><div className="rounded-2xl border border-[#d9ff58]/30 bg-[#f8fce6] px-4 py-3 text-xs leading-5 text-[#64752e]">เลือกผลให้ครบทุกคู่ แล้วกดบันทึกด้านล่าง <span className="font-black">ชนะ/เสมอ/แพ้ ได้ 3 แต้ม</span></div><div className="space-y-3">{fixtures.map((fixture) => <FixturePredictionCard key={fixture.id} fixture={fixture} choice={predictions[fixture.id]} onChoose={(choice) => onChoose(fixture.id, choice)} />)}</div><button type="button" disabled={!complete} onClick={onConfirm} className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black transition ${complete ? "bg-[#0c2137] text-white shadow-[0_12px_24px_rgba(12,33,55,0.18)] hover:bg-[#173b5c]" : "cursor-not-allowed bg-[#e7ecef] text-[#94a3af]"}`}>{complete ? "ยืนยันคำทายทั้งหมด" : `เลือกอีก ${fixtures.length - selected} คู่เพื่อยืนยัน`} <span>→</span></button></section>;
}

function PredictorNames({ names }: { names: string[] }) {
  return <div className="flex -space-x-2">{names.slice(0, 3).map((name) => <div key={name} title={name} className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#dbe4eb] text-[9px] font-black text-[#2d4a62]">{name.slice(0, 2)}</div>)}{names.length > 3 && <div className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#eff3f6] text-[9px] font-black text-[#667c90]">+{names.length - 3}</div>}</div>;
}

function Results({ fixtures }: { fixtures: Fixture[] }) {
  return <section className="space-y-4"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#75899e]">Match insight</p><h2 className="mt-1 text-2xl font-black tracking-tight text-[#0c2137]">ผลการแข่งขัน</h2></div><div className="space-y-3">{fixtures.map((fixture) => <article key={fixture.id} className="rounded-[24px] border border-[#e6ebf0] bg-white p-4 shadow-[0_12px_35px_rgba(12,33,55,0.045)]"><div className="mb-4 flex items-center justify-between"><p className="text-[11px] font-bold text-[#7b8e9f]">{fixture.dateLabel}</p><StatusPill fixture={fixture} /></div><div className="flex items-center justify-between gap-3"><div className="flex flex-1 items-center gap-2.5"><TeamLogo fixtureTeam={fixture.homeTeam} /><p className="text-sm font-extrabold text-[#0c2137]">{fixture.homeTeam.name}</p></div><div className="text-center"><p className="text-xl font-black text-[#0c2137]">{fixture.status === "finished" ? `${fixture.homeScore} - ${fixture.awayScore}` : "—"}</p><p className="text-[10px] font-bold text-[#9aa9b6]">{fixture.status === "finished" ? "FULL TIME" : "ยังไม่เริ่ม"}</p></div><div className="flex flex-1 items-center justify-end gap-2.5 text-right"><p className="text-sm font-extrabold text-[#0c2137]">{fixture.awayTeam.name}</p><TeamLogo fixtureTeam={fixture.awayTeam} /></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-[10px]"><div className="rounded-xl bg-[#fff0f2] px-2 py-2 text-[#dc5369]"><div className="mb-1 flex items-center justify-between"><span className="font-black">เหย้า</span><span className="font-black">{fixture.predictionPercentages.home}%</span></div><div className="h-1 rounded-full bg-white/80"><div className="h-1 rounded-full bg-[#ff647c]" style={{ width: `${fixture.predictionPercentages.home}%` }} /></div><div className="mt-1.5"><PredictorNames names={fixture.predictors.home} /></div></div><div className="rounded-xl bg-[#eafaf3] px-2 py-2 text-[#239d73]"><div className="mb-1 flex items-center justify-between"><span className="font-black">เสมอ</span><span className="font-black">{fixture.predictionPercentages.draw}%</span></div><div className="h-1 rounded-full bg-white/80"><div className="h-1 rounded-full bg-[#47d7a0]" style={{ width: `${fixture.predictionPercentages.draw}%` }} /></div><div className="mt-1.5"><PredictorNames names={fixture.predictors.draw} /></div></div><div className="rounded-xl bg-[#edf5ff] px-2 py-2 text-[#4b8fe8]"><div className="mb-1 flex items-center justify-between"><span className="font-black">เยือน</span><span className="font-black">{fixture.predictionPercentages.away}%</span></div><div className="h-1 rounded-full bg-white/80"><div className="h-1 rounded-full bg-[#6da9ff]" style={{ width: `${fixture.predictionPercentages.away}%` }} /></div><div className="mt-1.5"><PredictorNames names={fixture.predictors.away} /></div></div></div></article>)}</div></section>;
}

export default function PredictionApp({ currentUser, gameweeks, fixturesByGameweek, leaderboardByGameweek }: PredictionAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>("leaderboard");
  const [selectedGameweek, setSelectedGameweek] = useState(28);
  const [seasonMode, setSeasonMode] = useState<"gameweek" | "season">("gameweek");
  const [predictionsByGameweek, setPredictionsByGameweek] = useState<Record<number, PredictionMap>>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const fixtures = fixturesByGameweek[selectedGameweek] ?? [];
  const entries = leaderboardByGameweek[selectedGameweek] ?? [];
  const predictions = predictionsByGameweek[selectedGameweek] ?? {};
  const selectedCount = Object.keys(predictions).length;
  const completionLabel = useMemo(() => `${selectedCount}/${fixtures.length} คู่`, [fixtures.length, selectedCount]);

  const handleGameweekChange = (value: number) => { setSelectedGameweek(value); setIsConfirmOpen(false); };
  const handleChoose = (fixtureId: string, choice: PredictionChoice) => { setPredictionsByGameweek((current) => ({ ...current, [selectedGameweek]: applyPrediction(current[selectedGameweek] ?? {}, fixtureId, choice) })); };

  return <main className="min-h-screen bg-[#f4f7f8] text-[#0c2137]"><div className="mx-auto min-h-screen w-full max-w-[520px] pb-8">
    <header className="bg-[#071525] px-5 pb-6 pt-7 text-white"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Avatar user={currentUser} size={42} /><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a6b6c5]">สวัสดีตอนเย็น</p><p className="mt-0.5 text-base font-black">{currentUser.displayName} 👋</p></div></div><span className="rounded-full border border-[#d9ff58]/25 bg-[#d9ff58]/10 px-2.5 py-1.5 text-[10px] font-bold text-[#d9ff58]">Preview mode</span></div><div className="mt-6 flex items-end justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8fa4b8]">This week&apos;s arena</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">เกมวีค {selectedGameweek}</h1></div><GameweekPicker gameweeks={gameweeks} value={selectedGameweek} onChange={handleGameweekChange} /></div></header>
    <nav className="sticky top-0 z-10 border-b border-[#e0e7ec] bg-[#f4f7f8]/95 px-4 py-3 backdrop-blur"><div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#e7edf1] p-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black transition ${activeTab === tab.id ? "bg-white text-[#0c2137] shadow-sm" : "text-[#8092a1]"}`}><span className={activeTab === tab.id ? "text-[#8cae27]" : ""}>{tab.icon}</span>{tab.label}</button>)}</div></nav>
    <div className="px-4 pt-5">{activeTab === "leaderboard" && <Leaderboard entries={entries} gameweek={selectedGameweek} seasonMode={seasonMode} onSeasonModeChange={setSeasonMode} />}{activeTab === "predictions" && <Predictions fixtures={fixtures} predictions={predictions} onChoose={handleChoose} onConfirm={() => setIsConfirmOpen(true)} />}{activeTab === "results" && <Results fixtures={fixtures} />}</div>
    <div className="px-4 pt-6 text-center text-[10px] font-bold text-[#9aa9b6]">ข้อมูลตัวอย่างสำหรับ Phase 1 · เวลาแสดงเป็นประเทศไทย (ICT)</div>
    {isConfirmOpen && <div className="fixed inset-0 z-20 flex items-end justify-center bg-[#071525]/60 p-4 backdrop-blur-sm sm:items-center"><div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-[480px] rounded-[28px] bg-white p-5 shadow-2xl"><div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-[#dbe3e9] sm:hidden" /><div className="grid size-12 place-items-center rounded-2xl bg-[#eaf8bd] text-2xl text-[#6c8f0b]">✓</div><h2 id="confirm-title" className="mt-4 text-2xl font-black tracking-tight">บันทึกคำทายแล้ว 🎉</h2><p className="mt-2 text-sm leading-6 text-[#718395]">คุณเลือกครบ {completionLabel} ใน GW {selectedGameweek} แล้ว อยากแชร์ให้เพื่อนในกลุ่มเห็นไหม?</p><div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => setIsConfirmOpen(false)} className="rounded-2xl border border-[#dfe7ed] py-3.5 text-sm font-black text-[#63788a]">ไว้ทีหลัง</button><button type="button" onClick={() => setIsConfirmOpen(false)} className="rounded-2xl bg-[#0c2137] py-3.5 text-sm font-black text-white">แชร์เข้า LINE ↗</button></div></div></div>}
  </div></main>;
}
