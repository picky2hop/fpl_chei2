"use client";

import Link from "next/link";
import Image from "next/image";
import liff from "@line/liff";
import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { UserProfile } from "@/lib/mock-data";
import type { FantasyLeagueDashboardResponse } from "@/lib/fantasy/league-dashboard";
import { selectDefaultFantasyLeague } from "@/lib/fantasy/league-selection";
import type { FantasyEntryCurrentSquad, FantasySquadPlayer, FantasyTeamOfWeek } from "@/lib/fantasy/types";
import { fantasyPlayersTotalPoints, fantasySquadTotalPoints, playerDisplayPoints, playerHighlight, playerPresentation } from "@/lib/fantasy/player-presentation";
import { rankVisiblePlayerStats, type PlayerStatsCategory, type PlayerStatsPositionFilter } from "@/lib/fantasy/player-stats-view";
import { squadRows } from "@/lib/fantasy/squad-layout";
import { shareFantasyLeaderboard, shareFantasyLeaderboardTopBottom, shareFantasyPlayerStats, shareFantasySquad, shareFantasyTeamOfWeek, type FantasyShareStatus } from "@/lib/fantasy/fantasy-share-actions";
import { selectBottomLeaderboardRows, selectTopLeaderboardRows } from "@/lib/fantasy/leaderboard-share-selection";
import type { ShareTargetPickerApi } from "@/lib/line/share";
import { PlayerPhoto } from "./player-photo";

type League = { id: string; official_name: string; fpl_league_id: number; status: "active" | "archived" };
type LeagueList = { season: { id: string; name: string }; leagues: League[] };
type ViewTab = "leaderboard" | "players";

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) { return avatarUrl ? <Image src={avatarUrl} alt="" width={40} height={40} unoptimized className="size-10 rounded-full object-cover" /> : <span className="grid size-10 place-items-center rounded-full bg-[#29435d] text-xs font-black text-white/80">{name.slice(0, 2)}</span>; }

type CurrentSquadResponse = {
  entryId: number;
  squad: FantasyEntryCurrentSquad;
  cached: boolean;
  sourceSyncedAt: string;
  highlightPlayerIds?: number[];
};

type SelectedEntry = { entryId: number; managerName: string; teamName: string; avatarUrl: string | null };

function liffShareApi(): ShareTargetPickerApi {
  return {
    isApiAvailable: (apiName) => liff.isApiAvailable(apiName),
    shareTargetPicker: (messages, options) => liff.shareTargetPicker(messages as never, options),
  };
}

function SquadPlayerCard({ player, bench, highlightPlayerIds }: { player: FantasySquadPlayer; bench: boolean; highlightPlayerIds: ReadonlySet<number> }) {
  const presentation = playerPresentation(player.position, bench);
  const points = playerDisplayPoints(player);
  const highlight = playerHighlight(player.playerId, highlightPlayerIds);
  return <div className={`w-28 shrink-0 rounded-2xl border px-2.5 py-3 text-center ${presentation.className} ${highlight.className}`}><PlayerPhoto playerName={player.playerName} photoUrl={player.photoUrl} className="mx-auto size-18" /><p className="mt-2 truncate text-xs font-black">{player.playerName}</p><p className="truncate text-[10px] font-bold opacity-65">{player.clubName}</p><p className="mt-1 text-[10px] font-black">{points.label} คะแนน</p>{player.isCaptain && <p className="text-[9px] font-black text-[#d9ff58]">กัปตัน ×2</p>}{player.isViceCaptain && <p className="text-[9px] font-black text-[#d9ff58]">รองกัปตัน</p>}{highlight.label && <p className="text-[9px] font-black text-[#d9ff58]">{highlight.label}</p>}</div>;
}

function SquadPositionRow({ label, players, bench, highlightPlayerIds = new Set<number>() }: { label: string; players: FantasySquadPlayer[]; bench: boolean; highlightPlayerIds?: ReadonlySet<number> }) {
  return <div><h3 className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-white/45">{label} · {players.length} คน</h3>{players.length ? <div className="flex gap-3 overflow-x-auto pb-2">{players.map((player) => <SquadPlayerCard key={player.pickPosition} player={player} bench={bench} highlightPlayerIds={highlightPlayerIds} />)}</div> : <p className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-center text-xs font-bold text-white/35">ไม่มีข้อมูล</p>}</div>;
}

function CurrentSquadModal({ entry, loading, response, error, onClose, onShare, isSharing, shareStatus, highlightPlayerIds = new Set<number>() }: { entry: SelectedEntry; loading: boolean; response: CurrentSquadResponse | null; error: string; onClose: () => void; onShare: () => void; isSharing: boolean; shareStatus: FantasyShareStatus | null; highlightPlayerIds?: ReadonlySet<number> }) {
  if (response?.highlightPlayerIds?.length) highlightPlayerIds = new Set(response.highlightPlayerIds);
  const totalPoints = response ? fantasySquadTotalPoints(response.squad) : null;
  return <div className="fixed inset-0 z-50 grid place-items-end bg-[#020914]/80 p-3 sm:place-items-center" role="presentation" onClick={onClose}><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-white/15 bg-[#10253a] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="fantasy-current-squad-title" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><Avatar name={entry.managerName} avatarUrl={entry.avatarUrl} /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8ca6bd]">Current FPL squad</p><h2 id="fantasy-current-squad-title" className="mt-1 truncate text-xl font-black">ทีมของ {entry.managerName}</h2><p className="mt-1 truncate text-xs font-bold text-white/45">{entry.teamName} · FPL {entry.entryId}</p></div></div><button type="button" onClick={onClose} aria-label="ปิดทีม Fantasy" className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-xl text-white/70">×</button></div>{loading && <p className="mt-8 py-8 text-center text-sm font-bold text-white/55">กำลังโหลดทีม GW ปัจจุบัน…</p>}{!loading && error && <p className="mt-6 rounded-2xl border border-[#ff647c]/30 bg-[#ff647c]/10 px-4 py-4 text-sm font-bold leading-6 text-[#ff9aaa]">{error}</p>}{!loading && !error && response && <div className="mt-5 space-y-5"><div className="flex flex-wrap gap-2"><span className="rounded-full border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-3 py-2 text-xs font-black text-[#d9ff58]">GW {response.squad.gameweekNumber}</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/65">แผน {response.squad.formation}</span><span className="rounded-full border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-3 py-2 text-xs font-black text-[#d9ff58]">คะแนนรวม {totalPoints ?? "—"}</span></div>{squadRows(response.squad).map((row) => <SquadPositionRow key={row.key} label={row.label} players={row.players} bench={row.key === "BENCH"} highlightPlayerIds={highlightPlayerIds} />)}<button type="button" onClick={onShare} disabled={isSharing} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d9ff58] py-3.5 text-sm font-black text-[#071525] transition hover:bg-[#e7ff8c] disabled:cursor-wait disabled:opacity-60"><Share2 size={16} />{isSharing ? "กำลังเปิด LINE…" : "แชร์ทีมนี้เข้า LINE"}</button>{shareStatus?.message && <p role={shareStatus.state === "error" ? "alert" : "status"} className={`text-center text-xs font-bold ${shareStatus.state === "error" ? "text-[#ff9aaa]" : shareStatus.state === "cancelled" ? "text-[#ffc857]" : "text-[#b7f5de]"}`}>{shareStatus.message}</p>}<p className="text-[10px] font-bold leading-5 text-white/35">แสดงเฉพาะทีมของ GW ปัจจุบัน และระบบจะเขียนทับ snapshot เดิมเมื่อขึ้น GW ใหม่</p></div>}</section></div>;
}

function TeamOfWeekModal({ team, loading, error, onClose, onShare, isSharing, shareStatus, highlightPlayerIds }: { team: FantasyTeamOfWeek | null; loading: boolean; error: string; onClose: () => void; onShare: () => void; isSharing: boolean; shareStatus: FantasyShareStatus | null; highlightPlayerIds: ReadonlySet<number> }) {
  const rows: Array<{ key: FantasySquadPlayer["position"]; label: string }> = [{ key: "GK", label: "GK" }, { key: "DEF", label: "กองหลัง" }, { key: "MID", label: "กองกลาง" }, { key: "FWD", label: "กองหน้า" }];
  const totalPoints = team ? fantasyPlayersTotalPoints(team.players) : null;
  return <div className="fixed inset-0 z-50 grid place-items-end bg-[#020914]/80 p-3 sm:place-items-center" role="presentation" onClick={onClose}><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-white/15 bg-[#10253a] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="fantasy-team-of-week-title" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d9ff58]">FPL Official</p><h2 id="fantasy-team-of-week-title" className="mt-1 text-xl font-black">Team of the Week</h2><p className="mt-1 text-xs font-bold text-white/45">ทีมอย่างเป็นทางการ · {team ? "GW " + team.gameweek : "กำลังโหลด"}</p></div><button type="button" onClick={onClose} aria-label="ปิด Team of the Week" className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-xl text-white/70">×</button></div>{loading && <p className="mt-8 py-8 text-center text-sm font-bold text-white/55">กำลังโหลด Team of the Week…</p>}{!loading && error && <p role="alert" className="mt-6 rounded-2xl border border-[#ff647c]/30 bg-[#ff647c]/10 px-4 py-4 text-sm font-bold leading-6 text-[#ff9aaa]">{error}</p>}{!loading && !error && team && <div className="mt-5 space-y-5"><div className="flex flex-wrap gap-2"><span className="rounded-full border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-3 py-2 text-xs font-black text-[#d9ff58]">GW {team.gameweek}</span><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/65">FPL Official</span><span className="rounded-full border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-3 py-2 text-xs font-black text-[#d9ff58]">คะแนนรวม {totalPoints ?? "—"}</span></div>{rows.map((row) => <SquadPositionRow key={row.key} label={row.label} players={team.players.filter((player) => player.position === row.key)} bench={false} highlightPlayerIds={highlightPlayerIds} />)}<button type="button" onClick={onShare} disabled={isSharing} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d9ff58] py-3.5 text-sm font-black text-[#071525] transition hover:bg-[#e7ff8c] disabled:cursor-wait disabled:opacity-60"><Share2 size={16} />{isSharing ? "กำลังเปิด LINE…" : "แชร์ Team of the Week เข้า LINE"}</button>{shareStatus?.message && <p role={shareStatus.state === "error" ? "alert" : "status"} className={`text-center text-xs font-bold ${shareStatus.state === "error" ? "text-[#ff9aaa]" : shareStatus.state === "cancelled" ? "text-[#ffc857]" : "text-[#b7f5de]"}`}>{shareStatus.message}</p>}</div>}</section></div>;
}

function LegacyLeaderboard({ data, leagueName, gameweek, onSelectEntry, mode, setMode }: { data: FantasyLeagueDashboardResponse; leagueName: string; gameweek: number; onSelectEntry: (entry: SelectedEntry) => void; mode: "gameweek" | "season"; setMode: (mode: "gameweek" | "season") => void }) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<FantasyShareStatus | null>(null);
  const entries = mode === "gameweek" ? data.leaderboard.gameweek : data.leaderboard.season;

  async function shareLeaderboard() {
    setIsSharing(true);
    setShareStatus(null);
    const result = await shareFantasyLeaderboard(liffShareApi(), {
      leagueName,
      gameweek,
      period: mode,
      rows: entries.map((entry) => ({
        rank: entry.rank,
        managerName: entry.mapped ? entry.displayName : entry.managerName,
        teamName: entry.teamName,
        points: entry.points,
        avatarUrl: entry.avatarUrl,
      })),
    });
    setShareStatus(result);
    setIsSharing(false);
  }


  return <section className="space-y-4"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ca6bd]">Leaderboard</p><h2 className="mt-1 text-2xl font-black">ตารางคะแนน Fantasy</h2></div><div className="flex flex-wrap justify-end gap-2"><div className="flex rounded-full bg-white/10 p-1 text-[11px] font-bold"><button type="button" onClick={() => setMode("gameweek")} className={`rounded-full px-3 py-1.5 ${mode === "gameweek" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>GW {gameweek}</button><button type="button" onClick={() => setMode("season")} className={`rounded-full px-3 py-1.5 ${mode === "season" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>ทั้งฤดูกาล</button></div><button type="button" onClick={() => void shareLeaderboard()} disabled={isSharing} className="flex items-center gap-1.5 rounded-full border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-3 py-2 text-[10px] font-black text-[#d9ff58] disabled:cursor-wait disabled:opacity-60"><Share2 size={14} />{isSharing ? "กำลังแชร์…" : "แชร์ตารางคะแนน"}</button></div></div>{shareStatus?.message && <p role={shareStatus.state === "error" ? "alert" : "status"} className={`text-right text-xs font-bold ${shareStatus.state === "error" ? "text-[#ff9aaa]" : shareStatus.state === "cancelled" ? "text-[#ffc857]" : "text-[#b7f5de]"}`}>{shareStatus.message}</p>}<p className="text-right text-[10px] font-bold leading-5 text-[#d9ff58]">คะแนนที่เห็น คือ ไม่รวม Bench boost และ Triple Captain</p><div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#10253a]"><div className="flex justify-between border-b border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/45"><span>Rank · Manager</span><span>Points</span></div>{entries.length ? <div className="divide-y divide-white/10">{entries.map((entry) => <button key={entry.fplEntryId} type="button" onClick={() => onSelectEntry({ entryId: entry.fplEntryId, managerName: entry.mapped ? entry.displayName : entry.managerName, teamName: entry.teamName, avatarUrl: entry.avatarUrl })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#d9ff58]"><span className={`w-5 text-center text-sm font-black ${entry.rank === 1 ? "text-[#d9ff58]" : "text-white/45"}`}>{entry.rank}</span><Avatar name={entry.mapped ? entry.displayName : entry.managerName} avatarUrl={entry.avatarUrl} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{entry.mapped ? entry.displayName : entry.managerName}</p><p className="truncate text-sm font-black text-[#d9ff58]">ทีม : {entry.teamName}</p></div><div className="text-right"><p className="text-lg font-black">{entry.points}</p><p className="text-[10px] font-bold text-white/40">คะแนน</p></div></button>)}</div> : <p className="px-4 py-10 text-center text-sm font-bold text-white/45">ยังไม่มีสมาชิกใน snapshot ของ GW นี้</p>}</div><div className="grid grid-cols-2 gap-3 text-center text-xs font-bold"><div className="rounded-2xl border border-[#d9ff58]/20 bg-[#d9ff58]/10 px-3 py-3 text-[#d9ff58]">แชมป์ GW: {data.awards.champions.length} คน</div><div className="rounded-2xl border border-[#ff647c]/20 bg-[#ff647c]/10 px-3 py-3 text-[#ff8698]">บ๊วย GW: {data.awards.woodenSpoons.length} คน</div></div></section>;
}

function Leaderboard({ data, leagueName, gameweek, onSelectEntry }: { data: FantasyLeagueDashboardResponse; leagueName: string; gameweek: number; onSelectEntry: (entry: SelectedEntry) => void }) {
  const [mode, setMode] = useState<"gameweek" | "season">("gameweek");
  const [isRangeSharing, setIsRangeSharing] = useState(false);
  const [rangeShareStatus, setRangeShareStatus] = useState<FantasyShareStatus | null>(null);
  const entries = mode === "gameweek" ? data.leaderboard.gameweek : data.leaderboard.season;

  async function shareLeaderboardTopBottom() {
    setIsRangeSharing(true);
    setRangeShareStatus(null);
    const rows = entries.map((entry) => ({ rank: entry.rank, managerName: entry.mapped ? entry.displayName : entry.managerName, teamName: entry.teamName, points: entry.points, avatarUrl: entry.avatarUrl }));
    const result = await shareFantasyLeaderboardTopBottom(liffShareApi(), { leagueName, gameweek, period: mode, topRows: selectTopLeaderboardRows(rows), bottomRows: selectBottomLeaderboardRows(rows) });
    setRangeShareStatus(result);
    setIsRangeSharing(false);
  }

  return <><LegacyLeaderboard data={data} leagueName={leagueName} gameweek={gameweek} onSelectEntry={onSelectEntry} mode={mode} setMode={setMode} /><section className="mt-3 space-y-2"><button type="button" onClick={() => void shareLeaderboardTopBottom()} disabled={isRangeSharing} className="flex w-full items-center justify-center rounded-2xl bg-[#d9ff58] px-4 py-3 text-sm font-black text-[#071525] disabled:cursor-wait disabled:opacity-60">{isRangeSharing ? "กำลังแชร์…" : "แชร์ Top 5 / Bottom 5"}</button>{rangeShareStatus?.message && <p role={rangeShareStatus.state === "error" ? "alert" : "status"} className={`text-center text-xs font-bold ${rangeShareStatus.state === "error" ? "text-[#ff9aaa]" : "text-[#b7f5de]"}`}>{rangeShareStatus.message}</p>}</section></>;
}

function LegacyPlayerStats({ data, onOpenTeamOfWeek }: { data: FantasyLeagueDashboardResponse; onOpenTeamOfWeek: () => void }) {
  const [category, setCategory] = useState<PlayerStatsCategory>("selected");
  const [position, setPosition] = useState<PlayerStatsPositionFilter>("ALL");
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<FantasyShareStatus | null>(null);
  const categories: Array<{ key: PlayerStatsCategory; label: string; description: string }> = [
    { key: "selected", label: "เลือกติดทีมมากสุด", description: "เลือกติดทีมมากสุด" },
    { key: "form", label: "ฟอร์มสูงสุด", description: "ฟอร์มสูงสุด" },
    { key: "transfersIn", label: "ย้ายเข้ามากสุด", description: "ย้ายเข้ามากสุด" },
    { key: "transfersOut", label: "ย้ายออกมากสุด", description: "ย้ายออกมากสุด" },
    { key: "defensiveContribution", label: "ค่าการป้องกัน(DC)", description: "ค่าการป้องกัน(DC) GW ล่าสุด" },
    { key: "bps", label: "% การได้โบนัส", description: "% ที่นักเตะจะได้คะแนนโบนัส(BPS) ใน Match ล่าสุด" },
    { key: "pointsPerGame", label: "แต้มเฉลี่ยทั้งฤดูกาล", description: "แต้มเฉลี่ยทั้งฤดูกาล" },
    { key: "expectedGoalInvolvementsPer90", label: "โอกาส ยิง + แอสซิส", description: "โอกาส ยิง+แอสซิส ใน 90 นาที (xGI90)" },
    { key: "latestGameweekPoints", label: "คะแนน GW ล่าสุด", description: "คะแนนสัปดาห์ที่แล้ว" },
  ];
  const positions: Array<{ key: PlayerStatsPositionFilter; label: string }> = [{ key: "ALL", label: "ทั้งหมด" }, { key: "GK", label: "GK" }, { key: "DEF", label: "กองหลัง" }, { key: "MID", label: "กองกลาง" }, { key: "FWD", label: "กองหน้า" }];
  const visible = rankVisiblePlayerStats(data.playerStats, category, position);
  const popular: Array<{ label: string; entry: NonNullable<typeof data.playerStats.globalCaptain> | null }> = [{ label: "กัปตันยอดนิยม", entry: data.playerStats.globalCaptain }, { label: "รองกัปตันยอดนิยม", entry: data.playerStats.globalViceCaptain }];
  if (data.playerOfWeek.state === "ready") {
    const playerOfWeek = data.playerOfWeek.value;
    popular.push(...playerOfWeek.players.map((player) => ({ label: "Player of the Week · GW " + playerOfWeek.gameweek, entry: { playerId: player.playerId, playerName: player.playerName, position: player.position, clubId: 0, clubName: player.clubName, status: "a", metricValue: player.points ?? 0, photoUrl: player.photoUrl } })));
  } else {
    popular.push({ label: "Player of the Week", entry: null });
  }

  async function shareStats() {
    setIsSharing(true);
    setShareStatus(null);
    const selectedCategory = categories.find((item) => item.key === category);
    const result = await shareFantasyPlayerStats(liffShareApi(), {
      gameweek: category === "latestGameweekPoints" ? data.latestFinishedGameweek ?? data.currentGameweek : data.currentGameweek,
      categoryLabel: selectedCategory?.label ?? category,
      categoryDescription: selectedCategory?.description,
      positionLabel: positions.find((item) => item.key === position)?.label ?? position,
      rows: visible.map(({ player, rank }) => ({
        rank,
        position: player.position,
        playerName: player.playerName,
        clubName: player.clubName,
        metricValue: player.metricValue,
        photoUrl: player.photoUrl,
      })),
    });
    setShareStatus(result);
    setIsSharing(false);
  }

  return <section className="space-y-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8ca6bd]">Global FPL player stats</p><h2 className="mt-1 text-2xl font-black">สถิตินักเตะ GW {data.currentGameweek}</h2></div><div className="rounded-2xl border border-[#6da9ff]/20 bg-[#6da9ff]/10 px-4 py-3 text-sm leading-6 text-[#b8d4ff]">ข้อมูลนักเตะรวมจาก FPL ไม่เปลี่ยนตามลีกที่เลือก และเก็บ snapshot นักเตะทั้งหมด</div><div className="grid gap-3 sm:grid-cols-2">{popular.map((item) => <div key={item.label} className="rounded-2xl border border-[#d9ff58]/20 bg-[#d9ff58]/10 p-4">{item.entry ? <div className="flex items-center gap-3"><PlayerPhoto playerName={item.entry.playerName} photoUrl={item.entry.photoUrl} className="size-16" /><div className="min-w-0"><p className="text-sm font-black text-[#d9ff58]">{item.label}</p><p className="truncate text-base font-black">{item.entry.playerName}</p><p className="truncate text-xs font-bold text-white/60">{item.entry.clubName} · เลือก {item.entry.metricValue}%</p></div></div> : <p className="text-sm font-bold text-white/55">ยังไม่มีข้อมูล {item.label}</p>}</div>)}</div><WeeklyFeatureCards data={data} onOpenTeamOfWeek={onOpenTeamOfWeek} /><div className="rounded-[24px] border border-white/10 bg-[#10253a] p-4"><h3 className="text-base font-black">ค้นหาสถิตินักเตะ</h3><p className="mt-1 text-xs font-bold leading-5 text-white/55">เลือกหมวดหมู่และตำแหน่งเพื่อค้นข้อมูลได้ง่ายขึ้น</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-white/55">หมวดหมู่<select aria-label="เลือกหมวดหมู่สถิตินักเตะ" value={category} onChange={(event) => setCategory(event.target.value as PlayerStatsCategory)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#071525] px-3 py-3 text-sm font-black text-white outline-none focus:border-[#d9ff58]">{categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="text-xs font-black text-white/55">ตำแหน่ง<select aria-label="เลือกตำแหน่งนักเตะ" value={position} onChange={(event) => setPosition(event.target.value as PlayerStatsPositionFilter)} className="mt-1 w-full rounded-xl border border-white/15 bg-[#10253a] px-3 py-3 text-sm font-black text-white outline-none focus:border-[#6da9ff]">{positions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div><div className="mt-4 space-y-2">{visible.map(({ player, rank }) => <div key={player.playerId} className={playerPresentation(player.position, false).className + " flex items-center gap-3 rounded-2xl border px-3 py-3"}><span className="w-5 text-center text-sm font-black text-white/45">{rank}</span><PlayerPhoto playerName={player.playerName} photoUrl={player.photoUrl} className="size-16" /><div className="min-w-0 flex-1"><p className="truncate text-base font-black">{player.playerName}</p><p className="truncate text-xs font-bold text-white/60">{player.clubName} · {player.position}</p></div><span className="text-base font-black text-[#d9ff58]">{player.metricValue}</span></div>)}{visible.length === 0 && <p className="py-5 text-center text-sm font-bold text-white/40">ยังไม่มีข้อมูล</p>}</div><button type="button" onClick={() => void shareStats()} disabled={isSharing} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d9ff58] py-3.5 text-sm font-black text-[#071525] disabled:cursor-wait disabled:opacity-60"><Share2 size={16} />{isSharing ? "กำลังเปิด LINE…" : "แชร์สถิตินักเตะเข้า LINE"}</button>{shareStatus?.message && <p role={shareStatus.state === "error" ? "alert" : "status"} className={`text-center text-xs font-bold ${shareStatus.state === "error" ? "text-[#ff9aaa]" : shareStatus.state === "cancelled" ? "text-[#ffc857]" : "text-[#b7f5de]"}`}>{shareStatus.message}</p>}</div><p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold leading-5 text-white/50">หมายเหตุ: กัปตันและรองกัปตันยอดนิยมคือจำนวนการเลือกของ GW {data.currentGameweek} หลังเริ่ม GW/ปิดรับการจัดทีมแล้ว ไม่ใช่คะแนนของ GW ที่แล้ว; หากยังไม่มี GW ปัจจุบัน ระบบใช้ GW ล่าสุดที่จบแล้ว</p></section>;
}

function WeeklyFeatureCards({ data, onOpenTeamOfWeek }: { data: FantasyLeagueDashboardResponse; onOpenTeamOfWeek: () => void }) {
  const playerOfWeek = data.playerOfWeek;
  return <section className="mt-4 flex flex-col gap-3"><p className="text-xs font-bold text-white/45">{playerOfWeek.state === "ready" ? `Team of the Week ใช้ GW ปัจจุบันและจะแสดงผลเมื่อกดปุ่ม` : playerOfWeek.message}</p><button type="button" onClick={onOpenTeamOfWeek} className="flex w-full items-center justify-center rounded-2xl border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-4 py-3 text-sm font-black text-[#d9ff58]">Team of the Week · GW {data.currentGameweek}</button></section>;
}

function PlayerStats({ data }: { data: FantasyLeagueDashboardResponse }) {
  const [teamOfWeekLoading, setTeamOfWeekLoading] = useState(false);
  const [teamOfWeek, setTeamOfWeek] = useState<FantasyTeamOfWeek | null>(null);
  const [teamOfWeekError, setTeamOfWeekError] = useState("");
  const [teamOfWeekOpen, setTeamOfWeekOpen] = useState(false);
  const [isTeamSharing, setIsTeamSharing] = useState(false);
  const [teamShareStatus, setTeamShareStatus] = useState<FantasyShareStatus | null>(null);

  async function openTeamOfWeek() {
    setTeamOfWeekOpen(true);
    setTeamOfWeekLoading(true);
    setTeamOfWeek(null);
    setTeamOfWeekError("");
    try {
      const response = await fetch("/api/fantasy/team-of-week", { cache: "no-store" });
      const body = await response.json() as { state?: "ready" | "unavailable"; value?: FantasyTeamOfWeek; message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "ไม่สามารถโหลด Team of the Week ได้ในขณะนี้");
      if (body.state !== "ready" || !body.value) throw new Error(body.message ?? "ไม่สามารถโหลด Team of the Week ได้ในขณะนี้");
      setTeamOfWeek(body.value);
    } catch (reason: unknown) {
      setTeamOfWeekError(reason instanceof Error ? reason.message : "ไม่สามารถโหลด Team of the Week ได้ในขณะนี้");
    } finally {
      setTeamOfWeekLoading(false);
    }
  }

  async function shareTeamOfWeek() {
    if (!teamOfWeek) return;
    setIsTeamSharing(true);
    setTeamShareStatus(null);
    const result = await shareFantasyTeamOfWeek(liffShareApi(), {
      gameweek: teamOfWeek.gameweek,
      players: teamOfWeek.players,
      highlightPlayerIds,
    });
    setTeamShareStatus(result);
    setIsTeamSharing(false);
  }

  const highlightPlayerIds = data.playerOfWeek.state === "ready" ? new Set(data.playerOfWeek.value.players.map((player) => player.playerId)) : new Set<number>();
  return <><LegacyPlayerStats data={data} onOpenTeamOfWeek={() => void openTeamOfWeek()} />{teamOfWeekOpen && <TeamOfWeekModal team={teamOfWeek} loading={teamOfWeekLoading} error={teamOfWeekError} highlightPlayerIds={highlightPlayerIds} onClose={() => { setTeamOfWeekOpen(false); setTeamOfWeek(null); setTeamOfWeekError(""); setTeamShareStatus(null); }} onShare={() => void shareTeamOfWeek()} isSharing={isTeamSharing} shareStatus={teamShareStatus} />}</>;
}

export default function FantasyApp({ profile }: { profile: UserProfile }) {
  const [leagues, setLeagues] = useState<LeagueList | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [data, setData] = useState<FantasyLeagueDashboardResponse | null>(null);
  const [selectedGameweek, setSelectedGameweek] = useState<number | null>(null);
  const [tab, setTab] = useState<ViewTab>("leaderboard");
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<SelectedEntry | null>(null);
  const [squadResponse, setSquadResponse] = useState<CurrentSquadResponse | null>(null);
  const [squadLoading, setSquadLoading] = useState(false);
  const [squadError, setSquadError] = useState("");
  const [isSquadSharing, setIsSquadSharing] = useState(false);
  const [squadShareStatus, setSquadShareStatus] = useState<FantasyShareStatus | null>(null);

  useEffect(() => { void fetch("/api/fantasy/leagues").then(async (response) => { const body = await response.json() as LeagueList & { error?: string }; if (!response.ok) throw new Error(body.error ?? "โหลดลีกไม่สำเร็จ"); setLeagues(body); setSelectedLeagueId(selectDefaultFantasyLeague(body.leagues) ?? ""); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "โหลดลีกไม่สำเร็จ")); }, []);
  useEffect(() => { if (!selectedLeagueId) return; const query = new URLSearchParams({ league: selectedLeagueId }); if (selectedGameweek) query.set("gameweek", String(selectedGameweek)); void fetch(`/api/fantasy?${query}`, { cache: "no-store" }).then(async (response) => { const body = await response.json() as FantasyLeagueDashboardResponse & { error?: string }; if (!response.ok) throw new Error(body.error ?? "โหลด Fantasy ไม่สำเร็จ"); setData(body); setError(""); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "โหลด Fantasy ไม่สำเร็จ")); }, [selectedLeagueId, selectedGameweek]);

  function openSquad(entry: SelectedEntry) {
    setSelectedEntry(entry);
    setSquadResponse(null);
    setSquadError("");
    setSquadShareStatus(null);
    setSquadLoading(true);
    const query = new URLSearchParams({ league: selectedLeagueId, entry: String(entry.entryId) });
    void fetch(`/api/fantasy/team?${query}`).then(async (response) => {
      const body = await response.json() as CurrentSquadResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "โหลดทีม Fantasy ไม่สำเร็จ");
      const highlightPlayerIds = data?.playerOfWeek.state === "ready" ? data.playerOfWeek.value.players.map((player) => player.playerId) : [];
      setSquadResponse({ ...body, highlightPlayerIds });
    }).catch((reason: unknown) => setSquadError(reason instanceof Error ? reason.message : "โหลดทีม Fantasy ไม่สำเร็จ")).finally(() => setSquadLoading(false));
  }

  async function shareSquad() {
    if (!selectedEntry || !squadResponse) return;
    setIsSquadSharing(true);
    setSquadShareStatus(null);
    const result = await shareFantasySquad(liffShareApi(), {
      managerName: selectedEntry.managerName,
      managerAvatarUrl: selectedEntry.avatarUrl,
      teamName: selectedEntry.teamName,
      squad: squadResponse.squad,
      highlightPlayerIds: squadResponse.highlightPlayerIds ?? [],
    });
    setSquadShareStatus(result);
    setIsSquadSharing(false);
  }

  if (!leagues) return <main className="flex min-h-screen items-center justify-center bg-[#071525] px-5 text-sm font-bold text-white/60">{error || "กำลังโหลดรายชื่อลีก…"}</main>;
  if (!selectedLeagueId) return <main className="flex min-h-screen items-center justify-center bg-[#071525] px-5 text-sm font-bold text-white/60">{error || "ไม่พบลีก Fantasy ที่ใช้งานอยู่"}</main>;
  if (!data) return <main className="flex min-h-screen items-center justify-center bg-[#071525] px-5 text-sm font-bold text-white/60">{error || "กำลังโหลดข้อมูล Fantasy…"}</main>;
  return <main className="min-h-screen bg-[#071525] px-5 py-7 text-white"><div className="mx-auto max-w-xl"><header className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8ca6bd]">FPL CHEI CHEI</p><h1 className="mt-1 text-3xl font-black">แฟนตาซีเชยเชย</h1><p className="mt-1 text-xs font-bold text-white/45">{profile.displayName} · {data.season.name}</p></div><Avatar name={profile.displayName} avatarUrl={profile.avatarUrl} /></header>{data.sync.stale && <div className="mt-5 rounded-2xl border border-[#ffc857]/30 bg-[#ffc857]/10 px-4 py-3 text-xs font-bold leading-5 text-[#ffe0a0]">ข้อมูลอาจยังไม่ใช่รอบล่าสุด · {data.sync.message}</div>}<div className="mt-6 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><Link href="/" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70">หน้าแรก</Link><Link href="/dashboard" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70">ไปแอปทายผล</Link></div></div><label className="mt-4 block text-xs font-bold text-white/60">ลีกที่กำลังดู<select aria-label="เลือกลีก Fantasy" value={selectedLeagueId} onChange={(event) => { setSelectedLeagueId(event.target.value); setData(null); setSelectedGameweek(null); }} className="mt-1 w-full rounded-xl border border-white/15 bg-[#10253a] px-3 py-3 text-sm font-black text-white">{leagues.leagues.map((league) => <option key={league.id} value={league.id}>{league.official_name} · {league.status === "active" ? "ใช้งาน" : "เก็บประวัติ"}</option>)}</select></label><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setSelectedGameweek(null)} disabled={selectedGameweek === null} className="rounded-full border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-3 py-2 text-[10px] font-black text-[#d9ff58] disabled:opacity-45">GW ปัจจุบัน: GW {data.currentGameweek}</button><select aria-label="เลือกเกมวีค" value={selectedGameweek ?? data.selectedLeaderboardGameweek} onChange={(event) => setSelectedGameweek(Number(event.target.value))} className="rounded-full border border-white/15 bg-[#10253a] px-3 py-2 text-xs font-black text-white outline-none"><option value={data.currentGameweek}>GW {data.currentGameweek}</option>{Array.from({ length: data.currentGameweek - 1 }, (_, index) => index + 1).map((gameweek) => <option key={gameweek} value={gameweek}>GW {gameweek}</option>)}</select></div><div className="mt-6 flex rounded-2xl border border-white/10 bg-[#10253a] p-1"><button type="button" onClick={() => setTab("leaderboard")} className={`flex-1 rounded-xl py-3 text-sm font-black ${tab === "leaderboard" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>ตารางคะแนน</button><button type="button" onClick={() => setTab("players")} className={`flex-1 rounded-xl py-3 text-sm font-black ${tab === "players" ? "bg-[#d9ff58] text-[#071525]" : "text-white/55"}`}>สถิตินักเตะ</button></div><div className="mt-6">{tab === "leaderboard" ? <Leaderboard data={data} leagueName={data.leagues.find((league) => league.id === data.selectedLeagueId)?.official_name ?? "Fantasy League"} gameweek={data.selectedLeaderboardGameweek} onSelectEntry={openSquad} /> : <PlayerStats data={data} />}</div></div>{selectedEntry && <CurrentSquadModal entry={selectedEntry} loading={squadLoading} response={squadResponse} error={squadError} onShare={() => void shareSquad()} isSharing={isSquadSharing} shareStatus={squadShareStatus} onClose={() => { setSelectedEntry(null); setSquadResponse(null); setSquadError(""); setSquadShareStatus(null); }} />}</main>;
}
