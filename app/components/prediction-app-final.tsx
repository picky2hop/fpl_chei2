"use client";

import liff from "@line/liff";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Share2,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import DetailModal from "./detail-modal";
import { hasAvatarImage } from "@/lib/avatar";
import { buildPredictionShareFlex, buildStandingsShareFlex } from "@/lib/line/share-payload";
import { shareFlexMessage } from "@/lib/line/share";
import {
  applyPrediction,
  getFixturePredictionDetails,
  getPredictionTeamHighlights,
  getUserPredictionDetails,
  isPredictionComplete,
  type PredictionChoice,
  type PredictionMap,
} from "@/lib/predictions";
import {
  predictionBookByGameweek as mockPredictionBookByGameweek,
  type Fixture,
  type Gameweek,
  type LeaderboardEntry,
  type UserProfile,
} from "@/lib/mock-data";

type Tab = "leaderboard" | "predictions" | "results";

type PredictionAppProps = {
  currentUser: UserProfile;
  gameweeks: Gameweek[];
  fixturesByGameweek: Record<number, Fixture[]>;
  leaderboardByGameweek: Record<number, LeaderboardEntry[]>;
  initialPredictionsByGameweek?: Record<number, PredictionMap>;
  initialGameweek?: number;
  predictionBookByGameweek?: Record<number, Record<string, PredictionMap>>;
  onConfirmPredictions?: (gameweek: number, predictions: PredictionMap) => Promise<void>;
};

const predictionBookByEntries = new WeakMap<LeaderboardEntry[], Record<number, Record<string, PredictionMap>>>();

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "leaderboard", label: "ตารางคะแนน", icon: ArrowUpRight },
  { id: "predictions", label: "ทายผล", icon: Sparkles },
  { id: "results", label: "ผลแข่ง", icon: CheckCircle2 },
];

const choiceLabels: Record<PredictionChoice, string> = { home: "เหย้า", draw: "เสมอ", away: "เยือน" };
const choiceColors: Record<PredictionChoice, string> = {
  home: "bg-[#ff647c] text-white",
  draw: "bg-[#47d7a0] text-[#06221a]",
  away: "bg-[#6da9ff] text-[#06182d]",
};

function Avatar({ user, size = 40 }: { user: UserProfile; size?: number }) {
  return <div className="relative shrink-0 overflow-hidden rounded-full bg-[#29435d]" style={{ width: size, height: size }}>{hasAvatarImage(user.avatarUrl) ? <Image src={user.avatarUrl} alt={user.displayName} fill sizes={`${size}px`} className="object-cover" unoptimized /> : <span className="absolute inset-0 grid place-items-center text-[11px] font-black text-white/85">{user.shortName}</span>}</div>;
}

function TeamLogo({ team }: { team: Fixture["homeTeam"] }) {
  return <div className="grid size-10 shrink-0 place-items-center rounded-[14px]"><Image src={team.crest} alt={`${team.name} crest`} width={40} height={40} className="object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.28)]" unoptimized /></div>;
}

function StatusPill({ fixture }: { fixture: Fixture }) {
  if (fixture.status === "finished") return <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/55">จบแล้ว</span>;
  if (fixture.status === "live") return <span className="flex items-center gap-1 rounded-full bg-[#ff647c]/15 px-2 py-1 text-[10px] font-bold text-[#ff8698]"><span className="size-1.5 animate-pulse rounded-full bg-current" />LIVE</span>;
  return <span className="rounded-full bg-[#d9ff58]/15 px-2 py-1 text-[10px] font-bold text-[#d9ff58]">รอแข่ง</span>;
}

function GameweekPicker({ gameweeks, value, onChange }: { gameweeks: Gameweek[]; value: number; onChange: (value: number) => void }) {
  return <label className="relative block"><span className="sr-only">เลือกเกมวีค</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="appearance-none rounded-full border border-white/15 bg-[#10253a] py-2 pl-3 pr-8 text-xs font-black text-white outline-none transition focus:border-[#d9ff58]"><option value="">เลือก GW</option>{gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.id}>{gameweek.label} · {gameweek.fixtureCount} คู่</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/55" size={14} /></label>;
}

function LegacyLeaderboard({ entries, gameweek, onSelect }: { entries: LeaderboardEntry[]; gameweek: number; onSelect: (entry: LeaderboardEntry) => void }) {
  const [mode, setMode] = useState<"gameweek" | "season">("gameweek");
  return <section className="space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ca6bd]">Leaderboard</p><h2 className="mt-1 text-2xl font-black tracking-tight">ตารางคะแนน</h2></div><div className="flex rounded-full bg-white/10 p-1 text-[11px] font-bold"><button type="button" onClick={() => setMode("gameweek")} className={`rounded-full px-3 py-1.5 transition ${mode === "gameweek" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>GW {gameweek}</button><button type="button" onClick={() => setMode("season")} className={`rounded-full px-3 py-1.5 transition ${mode === "season" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>ทั้งฤดูกาล</button></div></div><div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#10253a] shadow-[0_18px_45px_rgba(0,0,0,0.18)]"><div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/45"><span>Rank · Player</span><span>Points</span></div><div className="divide-y divide-white/10">{entries.map((entry) => { const points = mode === "season" ? entry.seasonPoints : entry.gameweekPoints; return <button type="button" key={entry.id} onClick={() => onSelect(entry)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 focus-visible:bg-white/10"><span className={`w-5 text-center text-sm font-black ${entry.rank === 1 ? "text-[#d9ff58]" : "text-white/45"}`}>{String(entry.rank).padStart(2, "0")}</span><Avatar user={entry} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{entry.displayName}</p><div className="mt-1 flex items-center gap-1.5"><div className="flex gap-1">{entry.form.map((value, index) => <span key={`${entry.id}-${index}`} className={`size-1.5 rounded-full ${value >= 3 ? "bg-[#47d7a0]" : value === 0 ? "bg-white/20" : "bg-[#ffc857]"}`} />)}</div><span className={`text-[10px] font-bold ${entry.trend === "up" ? "text-[#47d7a0]" : entry.trend === "down" ? "text-[#ff8698]" : "text-white/40"}`}>{entry.trend === "up" ? "↑ ขึ้นมา" : entry.trend === "down" ? "↓ หล่นลง" : "— เท่าเดิม"}</span></div></div><div className="text-right"><p className="text-lg font-black">{points}</p><p className="text-[10px] font-bold text-white/40">คะแนน</p></div></button>; })}</div></div><button type="button" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">แชร์ตารางคะแนนเข้า LINE <Share2 size={15} /></button><p className="text-center text-[11px] text-white/40">กดที่ชื่อผู้เล่นเพื่อดูคำทายของเขาใน GW นี้</p></section>;
}

void LegacyLeaderboard;
void LegacyFixturePredictionCard;
void LegacyResults;
void LegacyPlayerDetail;
void LegacyFixtureDetail;

function Leaderboard({ entries, gameweek, onSelect }: { entries: LeaderboardEntry[]; gameweek: number; onSelect: (entry: LeaderboardEntry) => void }) {
  const [mode, setMode] = useState<"gameweek" | "season">("gameweek");
  const [shareMessage, setShareMessage] = useState("");
  const share = async () => {
    setShareMessage("");
    try {
      const message = buildStandingsShareFlex({ entries, gameweek, period: mode });
      const result = await shareFlexMessage({
        isApiAvailable: (apiName) => liff.isApiAvailable(apiName),
        shareTargetPicker: (messages, options) => liff.shareTargetPicker(messages as never, options),
      }, message);
      setShareMessage(result === "shared" ? "แชร์ตารางคะแนนเข้า LINE แล้ว" : "ยกเลิกการแชร์แล้ว");
    } catch (error) {
      setShareMessage(error instanceof Error && error.message === "SHARE_TARGET_PICKER_UNAVAILABLE"
        ? "กรุณาเปิดแอปผ่าน LINE WebView เพื่อแชร์เข้า LINE"
        : "แชร์ตารางคะแนนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };
  const onModeChange = setMode;
  const onShare = share;
  return <section className="space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ca6bd]">Leaderboard</p><h2 className="mt-1 text-2xl font-black tracking-tight">ตารางคะแนน</h2></div><div className="flex rounded-full bg-white/10 p-1 text-[11px] font-bold"><button type="button" onClick={() => onModeChange("gameweek")} className={`rounded-full px-3 py-1.5 transition ${mode === "gameweek" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>GW {gameweek}</button><button type="button" onClick={() => onModeChange("season")} className={`rounded-full px-3 py-1.5 transition ${mode === "season" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>ทั้งฤดูกาล</button></div></div><div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#10253a] shadow-[0_18px_45px_rgba(0,0,0,0.18)]"><div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/45"><span>Rank · Player</span><span>Points</span></div><div className="divide-y divide-white/10">{entries.map((entry) => { const points = mode === "season" ? entry.seasonPoints : entry.gameweekPoints; return <button type="button" key={entry.id} onClick={() => onSelect(entry)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 focus-visible:bg-white/10"><span className={`w-5 text-center text-sm font-black ${entry.rank === 1 ? "text-[#d9ff58]" : "text-white/45"}`}>{String(entry.rank).padStart(2, "0")}</span><Avatar user={entry} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{entry.displayName}</p><div className="mt-1 flex items-center gap-1.5"><div className="flex gap-1">{entry.form.map((value, index) => <span key={`${entry.id}-${index}`} className={`size-1.5 rounded-full ${value >= 3 ? "bg-[#47d7a0]" : value === 0 ? "bg-white/20" : "bg-[#ffc857]"}`} />)}</div><span className={`text-[10px] font-bold ${entry.trend === "up" ? "text-[#47d7a0]" : entry.trend === "down" ? "text-[#ff8698]" : "text-white/40"}`}>{entry.trend === "up" ? "↑ ขึ้นมา" : entry.trend === "down" ? "↓ หล่นลง" : "— เท่าเดิม"}</span></div></div><div className="text-right"><p className="text-lg font-black">{points}</p><p className="text-[10px] font-bold text-white/40">คะแนน</p></div></button>; })}</div></div><button type="button" onClick={onShare} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10">แชร์ตารางคะแนนเข้า LINE <Share2 size={15} /></button>{shareMessage && <p role="status" className="text-center text-[11px] font-bold text-[#d9ff58]">{shareMessage}</p>}<p className="text-center text-[11px] text-white/40">กดที่ชื่อผู้เล่นเพื่อดูคำทายของเขาใน GW นี้</p></section>;
}

function LegacyFixturePredictionCard({ fixture, choice, onChoose }: { fixture: Fixture; choice?: PredictionChoice; onChoose: (choice: PredictionChoice) => void }) {
  const choices: { id: PredictionChoice; label: string; sublabel: string }[] = [{ id: "home", label: "เหย้า", sublabel: fixture.homeTeam.shortName }, { id: "draw", label: "เสมอ", sublabel: "X" }, { id: "away", label: "เยือน", sublabel: fixture.awayTeam.shortName }];
  return <article className="rounded-[24px] border border-white/10 bg-[#10253a] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.12)]"><div className="mb-4 flex items-center justify-between"><p className="text-[11px] font-bold text-white/55">{fixture.dateLabel}</p><StatusPill fixture={fixture} /></div><div className="mb-4 flex items-center justify-center gap-4"><div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><TeamLogo team={fixture.homeTeam} /><p className="truncate text-xs font-extrabold">{fixture.homeTeam.name}</p></div><span className="text-xs font-black text-white/35">VS</span><div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><TeamLogo team={fixture.awayTeam} /><p className="truncate text-xs font-extrabold">{fixture.awayTeam.name}</p></div></div><div className="grid grid-cols-3 gap-2">{choices.map((item) => <button key={item.id} type="button" onClick={() => onChoose(item.id)} className={`rounded-2xl border py-2.5 transition ${choice === item.id ? `${choiceColors[item.id]} border-transparent shadow-lg` : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"}`}><span className="block text-xs font-black">{item.label}</span><span className="mt-0.5 block text-[10px] font-bold opacity-75">{item.sublabel}</span></button>)}</div></article>;
}

function FixturePredictionCard({ fixture, choice, onChoose }: { fixture: Fixture; choice?: PredictionChoice; onChoose: (choice: PredictionChoice) => void }) {
  const choices: { id: PredictionChoice; label: string; sublabel: string }[] = [{ id: "home", label: "เหย้า", sublabel: fixture.homeTeam.shortName }, { id: "draw", label: "เสมอ", sublabel: "X" }, { id: "away", label: "เยือน", sublabel: fixture.awayTeam.shortName }];
  return <article className="rounded-[24px] border border-white/10 bg-[#10253a] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.12)]"><div className="mb-4 flex items-center justify-between"><p className="text-[11px] font-bold text-white/55">{fixture.dateLabel}</p><StatusPill fixture={fixture} /></div><div className="mb-4 flex items-center justify-center gap-4"><div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><p className="truncate text-xs font-extrabold">{fixture.homeTeam.name}</p><TeamLogo team={fixture.homeTeam} /></div><span className="text-xs font-black text-white/35">VS</span><div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><TeamLogo team={fixture.awayTeam} /><p className="truncate text-xs font-extrabold">{fixture.awayTeam.name}</p></div></div><div className="grid grid-cols-3 gap-2">{choices.map((item) => <button key={item.id} type="button" onClick={() => onChoose(item.id)} className={`rounded-2xl border py-2.5 transition ${choice === item.id ? `${choiceColors[item.id]} border-transparent shadow-lg` : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"}`}><span className="block text-xs font-black">{item.label}</span><span className="mt-0.5 block text-[10px] font-bold opacity-75">{item.sublabel}</span></button>)}</div></article>;
}

function Predictions({ fixtures, predictions, onChoose, onConfirm }: { fixtures: Fixture[]; predictions: PredictionMap; onChoose: (fixtureId: string, choice: PredictionChoice) => void; onConfirm: () => void }) {
  const fixtureIds = fixtures.map((fixture) => fixture.id);
  const complete = isPredictionComplete(fixtureIds, predictions);
  const selected = fixtureIds.filter((fixtureId) => predictions[fixtureId]).length;
  return <section className="space-y-4"><div className="flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ca6bd]">Make your call</p><h2 className="mt-1 text-2xl font-black tracking-tight">ทายผลเกมวีคนี้</h2></div><span className="rounded-full bg-[#d9ff58] px-3 py-2 text-[11px] font-black text-[#071525]">{selected}/{fixtures.length} คู่</span></div><div className="rounded-2xl border border-[#d9ff58]/25 bg-[#d9ff58]/10 px-4 py-3 text-xs leading-5 text-[#d8eb96]">เลือกผลให้ครบทุกคู่ แล้วกดบันทึกด้านล่าง <span className="font-black text-[#d9ff58]">ผลถูกได้ 3 แต้ม</span></div><div className="space-y-3">{fixtures.map((fixture) => <FixturePredictionCard key={fixture.id} fixture={fixture} choice={predictions[fixture.id]} onChoose={(choice) => onChoose(fixture.id, choice)} />)}</div><button type="button" disabled={!complete} onClick={onConfirm} className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black transition ${complete ? "bg-[#d9ff58] text-[#071525] shadow-[0_12px_24px_rgba(217,255,88,0.15)] hover:bg-[#e7ff8c]" : "cursor-not-allowed bg-white/10 text-white/35"}`}>{complete ? "ยืนยันคำทายทั้งหมด" : `เลือกอีก ${fixtures.length - selected} คู่เพื่อยืนยัน`} <ArrowRight size={16} /></button></section>;
}

function PredictorLine({ predictor, choice }: { predictor: UserProfile; choice: PredictionChoice }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"><Avatar user={predictor} size={34} /><span className="min-w-0 flex-1 truncate text-sm font-bold">{predictor.displayName}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black ${choiceColors[choice]}`}>{choiceLabels[choice]}</span></div>;
}

function LegacyResults({ fixtures, gameweek, onSelectFixture }: { fixtures: Fixture[]; gameweek: number; onSelectFixture: (fixture: Fixture) => void }) {
  return <section className="space-y-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ca6bd]">Match insight</p><h2 className="mt-1 text-2xl font-black tracking-tight">ผลการแข่งขัน</h2></div><div className="space-y-3">{fixtures.map((fixture) => <button type="button" key={fixture.id} onClick={() => onSelectFixture(fixture)} className="w-full rounded-[24px] border border-white/10 bg-[#10253a] p-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:bg-[#15304a] focus-visible:bg-[#15304a]"><div className="mb-4 flex items-center justify-between"><p className="text-[11px] font-bold text-white/55">{fixture.dateLabel}</p><StatusPill fixture={fixture} /></div><div className="flex items-center justify-between gap-3"><div className="flex flex-1 items-center gap-2.5"><TeamLogo team={fixture.homeTeam} /><p className="text-sm font-extrabold">{fixture.homeTeam.name}</p></div><div className="text-center"><p className="text-xl font-black">{fixture.status === "finished" ? `${fixture.homeScore} - ${fixture.awayScore}` : "—"}</p><p className="text-[10px] font-bold text-white/40">{fixture.status === "finished" ? "FULL TIME" : "ยังไม่เริ่ม"}</p></div><div className="flex flex-1 items-center justify-end gap-2.5 text-right"><p className="text-sm font-extrabold">{fixture.awayTeam.name}</p><TeamLogo team={fixture.awayTeam} /></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">{(["home", "draw", "away"] as PredictionChoice[]).map((choice) => <div key={choice} className="rounded-xl bg-white/5 px-2 py-2"><div className="mb-1 flex items-center justify-between"><span className="font-black text-white/65">{choiceLabels[choice]}</span><span className="font-black text-white">{fixture.predictionPercentages[choice]}%</span></div><div className="h-1 rounded-full bg-white/10"><div className={`h-1 rounded-full ${choice === "home" ? "bg-[#ff647c]" : choice === "draw" ? "bg-[#47d7a0]" : "bg-[#6da9ff]"}`} style={{ width: `${fixture.predictionPercentages[choice]}%` }} /></div></div>)}</div><p className="mt-3 text-center text-[10px] font-bold text-[#d9ff58]">แตะเพื่อดูชื่อและคำทายแบบละเอียด · GW {gameweek}</p></button>)}</div></section>;
}

function Results({ fixtures, gameweek, onSelectFixture }: { fixtures: Fixture[]; gameweek: number; onSelectFixture: (fixture: Fixture) => void }) {
  return <section className="space-y-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ca6bd]">Match insight</p><h2 className="mt-1 text-2xl font-black tracking-tight">ผลการแข่งขัน</h2></div><div className="space-y-3">{fixtures.map((fixture) => <button type="button" key={fixture.id} onClick={() => onSelectFixture(fixture)} className="w-full rounded-[24px] border border-white/10 bg-[#10253a] p-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:bg-[#15304a] focus-visible:bg-[#15304a]"><div className="mb-4 flex items-center justify-between"><p className="text-[11px] font-bold text-white/55">{fixture.dateLabel}</p><StatusPill fixture={fixture} /></div><div className="flex items-center justify-between gap-3"><div className="flex flex-1 items-center gap-2.5"><p className="text-sm font-extrabold">{fixture.homeTeam.name}</p><TeamLogo team={fixture.homeTeam} /></div><div className="text-center"><p className="text-xl font-black">{fixture.status === "finished" ? `${fixture.homeScore} - ${fixture.awayScore}` : "—"}</p><p className="text-[10px] font-bold text-white/40">{fixture.status === "finished" ? "FULL TIME" : "ยังไม่เริ่ม"}</p></div><div className="flex flex-1 items-center justify-end gap-2.5 text-right"><TeamLogo team={fixture.awayTeam} /><p className="text-sm font-extrabold">{fixture.awayTeam.name}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-[10px]">{(["home", "draw", "away"] as PredictionChoice[]).map((choice) => <div key={choice} className="rounded-xl bg-white/5 px-2 py-2"><div className="mb-1 flex items-center justify-between"><span className="font-black text-white/65">{choiceLabels[choice]}</span><span className="font-black text-white">{fixture.predictionPercentages[choice]}%</span></div><div className="h-1 rounded-full bg-white/10"><div className={`h-1 rounded-full ${choice === "home" ? "bg-[#ff647c]" : choice === "draw" ? "bg-[#47d7a0]" : "bg-[#6da9ff]"}`} style={{ width: `${fixture.predictionPercentages[choice]}%` }} /></div></div>)}</div><p className="mt-3 text-center text-[10px] font-bold text-[#d9ff58]">แตะเพื่อดูชื่อและคำทายแบบละเอียด · GW {gameweek}</p></button>)}</div></section>;
}

function LegacyPlayerDetail({ player, fixtures, gameweek, predictionMap }: { player: LeaderboardEntry; fixtures: Fixture[]; gameweek: number; predictionMap: PredictionMap }) {
  const details = getUserPredictionDetails(fixtures.map((fixture) => ({ id: fixture.id, homeTeam: fixture.homeTeam.name, awayTeam: fixture.awayTeam.name })), predictionMap);
  return <div className="space-y-3"><div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><Avatar user={player} size={48} /><div><p className="font-black">{player.displayName}</p><p className="text-xs text-white/50">คำทายของ GW {gameweek}</p></div><span className="ml-auto text-xl font-black text-[#d9ff58]">{player.gameweekPoints} <span className="text-[10px] text-white/45">แต้ม</span></span></div>{details.length ? details.map((detail) => { const highlights = getPredictionTeamHighlights(detail.choice); return <div key={detail.fixtureId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold"><span className={highlights.home ? "rounded-lg bg-[#d9ff58]/15 px-1.5 py-1 text-[#d9ff58]" : "text-white/75"}>{detail.homeTeam}</span><span className="text-white/35">vs</span><span className={highlights.away ? "rounded-lg bg-[#d9ff58]/15 px-1.5 py-1 text-[#d9ff58]" : "text-white/75"}>{detail.awayTeam}</span></p></div><span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-black ${choiceColors[detail.choice]}`}>{choiceLabels[detail.choice]}</span></div>; }) : <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/55">ยังไม่มีคำทายในเกมวีคนี้</p>}</div>;
}

function PlayerDetail({ player, fixtures, gameweek, predictionMap }: { player: LeaderboardEntry; fixtures: Fixture[]; gameweek: number; predictionMap: PredictionMap }) {
  const details = getUserPredictionDetails(fixtures.map((fixture) => ({ id: fixture.id, homeTeam: fixture.homeTeam.name, awayTeam: fixture.awayTeam.name })), predictionMap);
  return <div className="space-y-3"><div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><Avatar user={player} size={48} /><div><p className="font-black">{player.displayName}</p><p className="text-xs text-white/50">คำทายของ GW {gameweek}</p></div><span className="ml-auto text-xl font-black text-[#d9ff58]">{player.gameweekPoints} <span className="text-[10px] text-white/45">แต้ม</span></span></div>{details.length ? details.map((detail) => { const highlights = getPredictionTeamHighlights(detail.choice); const fixture = fixtures.find((item) => item.id === detail.fixtureId); return <div key={detail.fixtureId} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><div className={`flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right ${highlights.home ? "rounded-xl bg-[#d9ff58]/15 px-2 py-1 text-[#d9ff58]" : "text-white/75"}`}><p className="truncate text-xs font-extrabold">{fixture?.homeTeam.name ?? detail.homeTeam}</p>{fixture && <TeamLogo team={fixture.homeTeam} />}</div><span className="shrink-0 text-[10px] font-black text-white/35">VS</span><div className={`flex min-w-0 flex-1 items-center gap-1.5 ${highlights.away ? "rounded-xl bg-[#d9ff58]/15 px-2 py-1 text-[#d9ff58]" : "text-white/75"}`}>{fixture && <TeamLogo team={fixture.awayTeam} />}<p className="truncate text-xs font-extrabold">{fixture?.awayTeam.name ?? detail.awayTeam}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-black ${choiceColors[detail.choice]}`}>{choiceLabels[detail.choice]}</span></div>; }) : <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/55">ยังไม่มีคำทายในเกมวีคนี้</p>}</div>;
}

function LegacyFixtureDetail({ fixture, entries, gameweek }: { fixture: Fixture; entries: LeaderboardEntry[]; gameweek: number }) {
  const predictors = entries.flatMap((entry) => { const choice = mockPredictionBookByGameweek[gameweek]?.[entry.id]?.[fixture.id]; return choice ? [{ name: entry.displayName, avatarUrl: entry.avatarUrl, choice }] : []; });
  const grouped = getFixturePredictionDetails(predictors);
  return <div className="space-y-3"><div className="flex items-center justify-center gap-3 rounded-2xl bg-white/5 p-3"><div className="text-center"><TeamLogo team={fixture.homeTeam} /><p className="mt-2 max-w-24 text-xs font-black">{fixture.homeTeam.name}</p></div><div className="text-center"><p className="text-xl font-black">{fixture.status === "finished" ? `${fixture.homeScore} - ${fixture.awayScore}` : "VS"}</p><p className="mt-1 text-[10px] text-white/45">{fixture.dateLabel}</p></div><div className="text-center"><TeamLogo team={fixture.awayTeam} /><p className="mt-2 max-w-24 text-xs font-black">{fixture.awayTeam.name}</p></div></div>{(["home", "draw", "away"] as PredictionChoice[]).map((choice) => <div key={choice} className="space-y-2"><div className="flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${choiceColors[choice]}`}>{choiceLabels[choice]}</span><span className="text-xs font-black text-white/55">{fixture.predictionPercentages[choice]}%</span></div>{grouped[choice].length ? grouped[choice].map((predictor) => <PredictorLine key={predictor.name} predictor={{ id: predictor.name, displayName: predictor.name, shortName: predictor.name.slice(0, 2), avatarUrl: predictor.avatarUrl }} choice={predictor.choice} />) : <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/35">ยังไม่มีคนเลือกฝั่งนี้</p>}</div>)}</div>;
}

function FixtureDetail({ fixture, entries, gameweek, predictionBook }: { fixture: Fixture; entries: LeaderboardEntry[]; gameweek: number; predictionBook?: Record<number, Record<string, PredictionMap>> }) {
  const activePredictionBook = predictionBook ?? predictionBookByEntries.get(entries) ?? mockPredictionBookByGameweek;
  const predictors = entries.flatMap((entry) => { const choice = activePredictionBook[gameweek]?.[entry.id]?.[fixture.id]; return choice ? [{ name: entry.displayName, avatarUrl: entry.avatarUrl, choice }] : []; });
  const grouped = getFixturePredictionDetails(predictors);
  return <div className="space-y-3"><div className="flex items-center justify-center gap-3 rounded-2xl bg-white/5 p-3"><div className="flex items-center gap-1.5 text-right"><p className="max-w-24 text-xs font-black">{fixture.homeTeam.name}</p><TeamLogo team={fixture.homeTeam} /></div><div className="text-center"><p className="text-xl font-black">{fixture.status === "finished" ? `${fixture.homeScore} - ${fixture.awayScore}` : "VS"}</p><p className="mt-1 text-[10px] text-white/45">{fixture.dateLabel}</p></div><div className="flex items-center gap-1.5"><TeamLogo team={fixture.awayTeam} /><p className="max-w-24 text-xs font-black">{fixture.awayTeam.name}</p></div></div>{(["home", "draw", "away"] as PredictionChoice[]).map((choice) => <div key={choice} className="space-y-2"><div className="flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${choiceColors[choice]}`}>{choiceLabels[choice]}</span><span className="text-xs font-black text-white/55">{fixture.predictionPercentages[choice]}%</span></div>{grouped[choice].length ? grouped[choice].map((predictor) => <PredictorLine key={predictor.name} predictor={{ id: predictor.name, displayName: predictor.name, shortName: predictor.name.slice(0, 2), avatarUrl: predictor.avatarUrl }} choice={predictor.choice} />) : <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/35">ยังไม่มีคนเลือกฝั่งนี้</p>}</div>)}</div>;
}

function SharePrompt({ gameweek, completionLabel, errorMessage, onClose, onShare }: { gameweek: number; completionLabel: string; errorMessage?: string; onClose: () => void; onShare: () => void }) {
  return <DetailModal eyebrow="Prediction saved" title="บันทึกคำทายแล้ว" onClose={onClose}><div className="space-y-4"><div className="flex items-center gap-3 rounded-2xl border border-[#47d7a0]/25 bg-[#47d7a0]/10 p-3"><span className="grid size-10 place-items-center rounded-full bg-[#47d7a0] text-[#06221a]"><Check size={20} /></span><p className="text-sm font-bold text-[#b7f5de]">บันทึกคำทาย {completionLabel} ใน GW {gameweek} แล้ว</p></div><p className="text-sm leading-6 text-white/65">อยากแชร์ผลทายลงกลุ่ม LINE ให้เพื่อนเห็นเลยไหม?</p>{errorMessage && <p role="alert" className="rounded-2xl border border-[#ff647c]/30 bg-[#ff647c]/10 px-3 py-2 text-xs leading-5 text-[#ffb0bc]">{errorMessage}</p>}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 py-3.5 text-sm font-black text-white/70 transition hover:bg-white/10">ไม่แชร์</button><button type="button" onClick={onShare} className="flex items-center justify-center gap-2 rounded-2xl bg-[#d9ff58] py-3.5 text-sm font-black text-[#071525] transition hover:bg-[#e7ff8c]"><Share2 size={16} />แชร์เข้า LINE</button></div></div></DetailModal>;
}

export default function PredictionApp({ currentUser, gameweeks, fixturesByGameweek, leaderboardByGameweek, initialPredictionsByGameweek, initialGameweek, predictionBookByGameweek: livePredictionBookByGameweek, onConfirmPredictions }: PredictionAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>("leaderboard");
  const [selectedGameweek, setSelectedGameweek] = useState(initialGameweek ?? gameweeks[0]?.id ?? 0);
  const [predictionsByGameweek, setPredictionsByGameweek] = useState<Record<number, PredictionMap>>(initialPredictionsByGameweek ?? {});
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [isSharePromptOpen, setIsSharePromptOpen] = useState(false);
  const [shareError, setShareError] = useState("");
  const [showSavedToast, setShowSavedToast] = useState(false);
  const fixtures = fixturesByGameweek[selectedGameweek] ?? [];
  const entries = leaderboardByGameweek[selectedGameweek] ?? [];
  const predictionBookByGameweek = livePredictionBookByGameweek ?? mockPredictionBookByGameweek;
  predictionBookByEntries.set(entries, predictionBookByGameweek);
  const predictions = predictionsByGameweek[selectedGameweek] ?? {};
  const selectedCount = Object.keys(predictions).length;
  const complete = isPredictionComplete(fixtures.map((fixture) => fixture.id), predictions);
  const completionLabel = useMemo(() => `${selectedCount}/${fixtures.length} คู่`, [fixtures.length, selectedCount]);
  const changeGameweek = (value: number) => { setSelectedGameweek(value); setSelectedPlayer(null); setSelectedFixture(null); setIsSharePromptOpen(false); setShareError(""); };
  const choosePrediction = (fixtureId: string, choice: PredictionChoice) => { setShowSavedToast(false); setPredictionsByGameweek((current) => ({ ...current, [selectedGameweek]: applyPrediction(current[selectedGameweek] ?? {}, fixtureId, choice) })); };
  const confirmPredictions = () => {
    if (!complete) return;
    if (onConfirmPredictions) {
      void onConfirmPredictions(selectedGameweek, predictions)
        .then(() => setIsSharePromptOpen(true))
        .catch(() => setShowSavedToast(false));
      return;
    }
    setIsSharePromptOpen(true);
  };
  const finishShareFlow = () => { setIsSharePromptOpen(false); setShareError(""); setShowSavedToast(true); };
  const sharePredictionResult = async () => {
    setShareError("");
    try {
      const message = buildPredictionShareFlex({
        currentUser,
        fixtures,
        gameweek: selectedGameweek,
        predictions,
      });
      const result = await shareFlexMessage({
        isApiAvailable: (apiName) => liff.isApiAvailable(apiName),
        shareTargetPicker: (messages, options) => liff.shareTargetPicker(messages as never, options),
      }, message);
      if (result === "cancelled") {
        setShareError("ยกเลิกการแชร์แล้ว ยังไม่ได้ส่งข้อความเข้า LINE");
        return;
      }
      finishShareFlow();
    } catch (error) {
      setShareError(error instanceof Error && error.message === "SHARE_TARGET_PICKER_UNAVAILABLE"
        ? "สภาพแวดล้อมนี้ยังไม่รองรับการแชร์เข้า LINE กรุณาเปิดแอปผ่าน LINE WebView"
        : error instanceof Error && error.message === "FLEX_MESSAGE_TOO_LARGE"
          ? "คำทายมีข้อมูลมากเกินไปสำหรับ LINE กรุณาลองแชร์ใหม่อีกครั้ง"
          : error instanceof Error && error.message === "FLEX_MESSAGE_INVALID"
            ? "รูปแบบผลทายไม่รองรับการแชร์เข้า LINE กรุณาลองใหม่อีกครั้ง"
        : "แชร์เข้า LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  return <main className="app-shell min-h-screen bg-[#071525] text-white"><div className="mx-auto min-h-screen w-full max-w-[520px] pb-28"><header className="bg-[#071525] px-5 pb-6 pt-7"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Avatar user={currentUser} size={42} /><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">สวัสดีตอนเย็น</p><p className="mt-0.5 text-base font-black">{currentUser.displayName} 👋</p></div></div><span className="rounded-full border border-[#d9ff58]/25 bg-[#d9ff58]/10 px-2.5 py-1.5 text-[10px] font-bold text-[#d9ff58]">Preview / LIFF</span></div><div className="mt-6 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8ca6bd]">This week&apos;s arena</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">เกมวีค {selectedGameweek}</h1></div><GameweekPicker gameweeks={gameweeks} value={selectedGameweek} onChange={changeGameweek} /></div></header><div className="px-4 pt-5">{activeTab === "leaderboard" && <Leaderboard entries={entries} gameweek={selectedGameweek} onSelect={setSelectedPlayer} />}{activeTab === "predictions" && <Predictions fixtures={fixtures} predictions={predictions} onChoose={choosePrediction} onConfirm={confirmPredictions} />}{activeTab === "results" && <Results fixtures={fixtures} gameweek={selectedGameweek} onSelectFixture={setSelectedFixture} />}</div><p className="px-4 pt-6 text-center text-[10px] font-bold text-white/35">ข้อมูลตัวอย่าง Phase 1 · เวลาแสดงประเทศไทย (ICT)</p></div><nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[520px] -translate-x-1/2 border-t border-white/10 bg-[#0b1d31]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl"><div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setShowSavedToast(false); }} className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black transition ${activeTab === tab.id ? "bg-[#d9ff58] text-[#071525] shadow-[0_6px_20px_rgba(217,255,88,0.15)]" : "text-white/55 hover:text-white"}`}><Icon aria-hidden="true" size={15} strokeWidth={2.4} />{tab.label}</button>; })}</div></nav>{selectedPlayer && <DetailModal eyebrow="Player picks" title={`คำทายของ ${selectedPlayer.displayName}`} onClose={() => setSelectedPlayer(null)}><PlayerDetail player={selectedPlayer} fixtures={fixtures} gameweek={selectedGameweek} predictionMap={predictionBookByGameweek[selectedGameweek]?.[selectedPlayer.id] ?? {}} /></DetailModal>}{selectedFixture && <DetailModal eyebrow="Match details" title={`${selectedFixture.homeTeam.name} vs ${selectedFixture.awayTeam.name}`} onClose={() => setSelectedFixture(null)}><FixtureDetail fixture={selectedFixture} entries={entries} gameweek={selectedGameweek} /></DetailModal>}{isSharePromptOpen && <SharePrompt gameweek={selectedGameweek} completionLabel={completionLabel} errorMessage={shareError} onClose={finishShareFlow} onShare={() => void sharePredictionResult()} />}{showSavedToast && <div className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-[488px] items-center gap-3 rounded-2xl border border-[#47d7a0]/30 bg-[#123d36] px-4 py-3 text-sm font-bold text-[#b7f5de] shadow-2xl"><span className="grid size-8 place-items-center rounded-full bg-[#47d7a0] text-[#06221a]"><CheckCircle2 size={17} /></span><span>บันทึกคำทาย {completionLabel} แล้ว</span><button type="button" onClick={() => setShowSavedToast(false)} aria-label="ปิดข้อความบันทึกสำเร็จ" className="ml-auto text-white/60"><X size={17} /></button></div>}</main>;
}
