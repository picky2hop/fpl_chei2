"use client";

import { useEffect, useState } from "react";
import { AdminConfirmationModal } from "./admin-confirmation-modal";
import { AdminAwardsConfirmationModal } from "./admin-awards-confirmation-modal";
import { AdminFeedbackModal } from "./admin-feedback-modal";
import { archiveEndpoint, type ArchiveTarget } from "@/lib/admin/archive-confirmation";
import { feedbackFromAction, type AdminFeedback } from "@/lib/admin/feedback";

type League = { id: string; fpl_league_id: number; official_name: string; status: "active" | "archived" };
type EntryOption = { fpl_entry_id: number; fpl_team_name: string; fpl_manager_name: string; leagues: Array<{ id: string; official_name: string }> };
type Mapping = { id: string; app_user_id: string; fpl_entry_id: number; fpl_team_name: string; fpl_manager_name: string; mapping_status: "active" | "archived"; last_validation_status: "valid" | "error"; last_error_message: string | null };
type AdminData = { mappings: Mapping[]; users: Array<{ id: string; displayName: string; status: string }>; gameweeks: Array<{ id: string; number: number; name: string | null; is_current: boolean }>; leagues: League[]; unmappedEntries: EntryOption[]; leagueEntries: EntryOption[]; leagueEntriesByGameweek: Record<string, EntryOption[]> };
type FantasySyncAction = "scores" | "players" | "recalculate";
type AwardSaveInput = { leagueId: string; gameweekId: string; championEntryIds: number[]; woodenSpoonEntryIds: number[]; leagueName: string; gameweekNumber: number | null };

function AwardEntrySelector({ id, label, colorClass, entries, selectedIds, onAdd, onRemove }: { id: string; label: string; colorClass: string; entries: EntryOption[]; selectedIds: number[]; onAdd: (entryId: number) => void; onRemove: (entryId: number) => void }) {
  const availableEntries = entries.filter((entry) => !selectedIds.includes(entry.fpl_entry_id));
  return <div>
    <p className={`text-xs font-black ${colorClass}`}>{label}</p>
    <label htmlFor={id} className="sr-only">เลือก{label}</label>
    <select id={id} value="" onChange={(event) => { const entryId = Number(event.target.value); if (Number.isSafeInteger(entryId) && entryId > 0) onAdd(entryId); }} disabled={availableEntries.length === 0} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-xs font-bold text-white disabled:opacity-50">
      <option value="">{availableEntries.length > 0 ? `เลือก${label}` : "ไม่มีทีมในลีกที่เลือก"}</option>
      {availableEntries.map((entry) => <option key={entry.fpl_entry_id} value={entry.fpl_entry_id}>{entry.fpl_team_name} · {entry.fpl_manager_name} · FPL {entry.fpl_entry_id}</option>)}
    </select>
    <div className="mt-2 space-y-1.5">
      {selectedIds.map((entryId) => {
        const entry = entries.find((item) => item.fpl_entry_id === entryId);
        if (!entry) return null;
        return <div key={`${id}-${entryId}`} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-bold text-white/75"><span className="min-w-0 flex-1 truncate">{entry.fpl_team_name} · FPL {entry.fpl_entry_id}</span><button type="button" onClick={() => onRemove(entryId)} className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] font-black text-white/60 hover:text-white">ลบ</button></div>;
      })}
    </div>
  </div>;
}

export default function FantasyAdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [entryId, setEntryId] = useState("");
  const [userId, setUserId] = useState("");
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [newLeagueId, setNewLeagueId] = useState("");
  const [replaceLeagueId, setReplaceLeagueId] = useState<Record<string, string>>({});
  const [awardLeagueId, setAwardLeagueId] = useState("");
  const [gameweekId, setGameweekId] = useState("");
  const [champions, setChampions] = useState<number[]>([]);
  const [woodenSpoons, setWoodenSpoons] = useState<number[]>([]);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [syncAction, setSyncAction] = useState<FantasySyncAction | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
  const [awardConfirmation, setAwardConfirmation] = useState<AwardSaveInput | null>(null);

  function applyData(value: AdminData) {
    setData(value);
    setUserId((current) => current || value.users.find((user) => user.status === "active")?.id || "");
    setEntryId((current) => current || String(value.unmappedEntries[0]?.fpl_entry_id ?? ""));
    setSelectedMappingId((current) => current && value.mappings.some((mapping) => mapping.id === current) ? current : value.mappings[0]?.id ?? "");
    setAwardLeagueId((current) => current || value.leagues.find((league) => league.status === "active")?.id || value.leagues[0]?.id || "");
    setGameweekId((current) => current || value.gameweeks.find((gameweek) => gameweek.is_current)?.id || value.gameweeks[0]?.id || "");
  }

  async function load(): Promise<AdminData> {
    const response = await fetch("/api/admin/fantasy/mappings");
    if (!response.ok) throw new Error("โหลด Fantasy admin ไม่สำเร็จ");
    return await response.json() as AdminData;
  }

  useEffect(() => { void load().then(applyData).catch((error: unknown) => setFeedback(feedbackFromAction({ ok: false, successMessage: "โหลดข้อมูลสำเร็จ", errorMessage: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" }))); }, []);

  async function action(request: Promise<Response>, success: string, useServerFeedback = false) {
    setState("running");
    setFeedback(null);
    try {
      const response = await request;
      const value = await response.json().catch(() => ({})) as { error?: string; reason?: string; message?: string };
      if (!response.ok) throw new Error(useServerFeedback ? value.message ?? value.reason ?? value.error ?? "ดำเนินการไม่สำเร็จ" : value.error ?? "ดำเนินการไม่สำเร็จ");
      setState("done");
      setFeedback(feedbackFromAction({ ok: true, successMessage: useServerFeedback ? value.message ?? success : success }));
      applyData(await load());
    } catch (error) {
      setState("error");
      setFeedback(feedbackFromAction({ ok: false, successMessage: success, errorMessage: error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ" }));
    }
  }

  async function saveAwards(confirmReplace = false, confirmedInput?: AwardSaveInput) {
    const league = data?.leagues.find((item) => item.id === (confirmedInput?.leagueId ?? awardLeagueId));
    const gameweek = data?.gameweeks.find((item) => item.id === (confirmedInput?.gameweekId ?? gameweekId));
    const input = confirmedInput ?? {
      leagueId: awardLeagueId,
      gameweekId,
      championEntryIds: champions,
      woodenSpoonEntryIds: woodenSpoons,
      leagueName: league?.official_name ?? "ลีกที่เลือก",
      gameweekNumber: gameweek?.number ?? null,
    };

    setState("running");
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/fantasy/awards", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueId: input.leagueId, gameweekId: input.gameweekId, championEntryIds: input.championEntryIds, woodenSpoonEntryIds: input.woodenSpoonEntryIds, confirmReplace }),
      });
      const value = await response.json().catch(() => ({})) as { code?: string; error?: string; message?: string };
      if (response.status === 409 && value.code === "FANTASY_AWARDS_EXIST" && !confirmReplace) {
        setAwardConfirmation(input);
        setState("idle");
        return;
      }
      if (!response.ok) throw new Error(value.message ?? value.error ?? "บันทึก awards ไม่สำเร็จ");
      setAwardConfirmation(null);
      setState("done");
      setFeedback(feedbackFromAction({ ok: true, successMessage: value.message ?? "บันทึก awards แล้ว" }));
      applyData(await load());
    } catch (error) {
      setState("error");
      setFeedback(feedbackFromAction({ ok: false, successMessage: "บันทึก awards แล้ว", errorMessage: error instanceof Error ? error.message : "บันทึก awards ไม่สำเร็จ" }));
    }
  }

  async function runSyncAction(endpoint: string, actionName: FantasySyncAction, success: string) {
    setSyncAction(actionName);
    setFeedback(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const value = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(value.message ?? value.error ?? "ดำเนินการไม่สำเร็จ");
      setFeedback(feedbackFromAction({ ok: true, successMessage: value.message ?? success }));
      applyData(await load());
    } catch (error) {
      setFeedback(feedbackFromAction({ ok: false, successMessage: success, errorMessage: error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ" }));
    } finally {
      setSyncAction(null);
    }
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    void action(fetch(archiveEndpoint(target), { method: "POST" }), target.kind === "league" ? "เก็บลีกไว้ดูประวัติแล้ว" : "เก็บ mapping ไว้ดูประวัติแล้ว");
  }

  const selectedMapping = data?.mappings.find((mapping) => mapping.id === selectedMappingId);
  const awardEntries = (data?.leagueEntriesByGameweek?.[gameweekId] ?? data?.leagueEntries ?? []).filter((entry) => entry.leagues.some((league) => league.id === awardLeagueId));

  return <section className="mt-4 rounded-3xl border border-[#6da9ff]/25 bg-[#10253a] p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6da9ff]">Fantasy analytics</p><h2 className="mt-1 text-lg font-black">จัดการ Fantasy</h2></div><div className="grid grid-cols-1 gap-2 sm:min-w-[220px]"><button type="button" onClick={() => void runSyncAction("/api/admin/fantasy/sync", "scores", "ซิงก์ Fantasy Scores สำเร็จแล้ว")} disabled={syncAction !== null} className="rounded-xl bg-[#6da9ff] px-3 py-2 text-xs font-black text-[#071525] disabled:opacity-50">{syncAction === "scores" ? "กำลังซิงก์คะแนน…" : "Sync Fantasy Scores"}</button><button type="button" onClick={() => void runSyncAction("/api/admin/fantasy/player-stats-sync", "players", "ซิงก์ Player Statistics สำเร็จแล้ว")} disabled={syncAction !== null} className="rounded-xl bg-[#d9ff58] px-3 py-2 text-xs font-black text-[#071525] disabled:opacity-50">{syncAction === "players" ? "กำลังซิงก์สถิติ…" : "Sync Player Statistics"}</button><button type="button" onClick={() => void runSyncAction("/api/admin/fantasy/recalculate-scores", "recalculate", "Recalculate Fantasy Scores สำเร็จแล้ว")} disabled={syncAction !== null} className="rounded-xl border border-[#d9ff58]/40 bg-[#d9ff58]/10 px-3 py-2 text-xs font-black text-[#d9ff58] disabled:opacity-50">{syncAction === "recalculate" ? "กำลังคำนวณใหม่…" : "Recalculate Fantasy Scores"}</button></div></div>
    <p className="mt-2 text-sm leading-6 text-white/60">จัดการลีก, ผูก LINE user กับสมาชิกลีก และเลือกแชมป์/บ๊วยจาก FPL Entry ID</p>

    <div className="mt-5 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">Fantasy Leagues</h3><div className="mt-3 flex gap-2"><input value={newLeagueId} onChange={(event) => setNewLeagueId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="FPL League ID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white" /><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/leagues", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fplLeagueId: Number(newLeagueId) }) }), "เพิ่มลีกและตรวจสอบชื่อทางการแล้ว")} disabled={!newLeagueId || state === "running"} className="rounded-xl bg-[#d9ff58] px-3 py-2 text-xs font-black text-[#071525] disabled:opacity-40">เพิ่มลีก</button></div><div className="mt-3 space-y-2">{data?.leagues.map((league) => <div key={league.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{league.official_name}</p><p className="text-[10px] font-bold text-white/45">FPL League {league.fpl_league_id} · {league.status === "active" ? "ใช้งาน" : "เก็บประวัติ"}</p></div>{league.status === "active" && <button type="button" onClick={() => setArchiveTarget({ kind: "league", id: league.id, label: league.official_name })} className="rounded-lg border border-[#ff647c]/30 px-2 py-1 text-[10px] font-black text-[#ff8698]">Archive</button>}</div>{league.status === "active" && <div className="mt-2 flex gap-2"><input value={replaceLeagueId[league.id] ?? ""} onChange={(event) => setReplaceLeagueId((current) => ({ ...current, [league.id]: event.target.value.replace(/\D/g, "") }))} inputMode="numeric" placeholder="เปลี่ยน League ID" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#071525] px-2 py-2 text-xs font-bold text-white" /><button type="button" onClick={() => void action(fetch(`/api/admin/fantasy/leagues/${league.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fplLeagueId: Number(replaceLeagueId[league.id]) }) }), "ตรวจสอบและเปลี่ยนลีกแล้ว")} disabled={!replaceLeagueId[league.id] || state === "running"} className="rounded-lg border border-[#6da9ff]/30 px-2 py-1 text-[10px] font-black text-[#b8d4ff] disabled:opacity-40">เปลี่ยน</button></div>}</div>)}</div></div>

    <div className="mt-4 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">Mapping จากสมาชิกลีก</h3><label className="mt-3 block text-xs font-bold text-white/60">LINE user<select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white"><option value="">เลือกผู้ใช้</option>{data?.users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.status}</option>)}</select></label><label className="mt-3 block text-xs font-bold text-white/60">สมาชิกที่ยังไม่ได้ mapping<select value={entryId} onChange={(event) => setEntryId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white"><option value="">เลือกสมาชิกลีก</option>{data?.unmappedEntries.map((entry) => <option key={entry.fpl_entry_id} value={entry.fpl_entry_id}>{entry.fpl_team_name} · {entry.fpl_manager_name} · FPL {entry.fpl_entry_id} · {entry.leagues.map((league) => league.official_name).join(" + ")}</option>)}</select></label><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appUserId: userId, fplEntryId: Number(entryId) }) }), "ตรวจสอบและบันทึก mapping แล้ว")} disabled={!userId || !entryId || state === "running"} className="mt-3 rounded-xl bg-[#d9ff58] px-4 py-3 text-xs font-black text-[#071525] disabled:opacity-40">บันทึก Mapping</button></div>

     <div className="mt-4 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">ประวัติ Mapping</h3>{data?.mappings.length ? <><label className="mt-3 block text-xs font-bold text-white/60">เลือก Mapping<select value={selectedMappingId} onChange={(event) => setSelectedMappingId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white"><option value="">เลือกประวัติ Mapping</option>{data.mappings.map((mapping) => <option key={mapping.id} value={mapping.id}>{mapping.fpl_team_name} · FPL {mapping.fpl_entry_id} · {mapping.mapping_status}</option>)}</select></label>{selectedMapping && <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{selectedMapping.fpl_team_name} · FPL {selectedMapping.fpl_entry_id}</p><p className="text-xs font-bold text-white/45">{selectedMapping.fpl_manager_name} · {selectedMapping.mapping_status}{selectedMapping.last_validation_status === "error" ? " · ต้องตรวจสอบใหม่" : ""}</p></div>{selectedMapping.mapping_status === "active" && <button type="button" onClick={() => setArchiveTarget({ kind: "mapping", id: selectedMapping.id, label: `${selectedMapping.fpl_team_name} · FPL ${selectedMapping.fpl_entry_id}` })} className="rounded-lg border border-[#ff647c]/30 px-2 py-1 text-[10px] font-black text-[#ff8698]">Archive</button>}</div></div>}</> : <p className="mt-3 text-xs font-bold text-white/45">ยังไม่มีประวัติ Mapping</p>}</div>

     <div className="mt-5 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">Awards รายลีก / ราย GW</h3><label className="mt-3 block text-xs font-bold text-white/60">ลีก<select value={awardLeagueId} onChange={(event) => { setAwardLeagueId(event.target.value); setChampions([]); setWoodenSpoons([]); }} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white">{data?.leagues.map((league) => <option key={league.id} value={league.id}>{league.official_name} · {league.status}</option>)}</select></label><label className="mt-3 block text-xs font-bold text-white/60">Gameweek<select value={gameweekId} onChange={(event) => { setGameweekId(event.target.value); setChampions([]); setWoodenSpoons([]); }} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white">{data?.gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.id}>GW {gameweek.number} · {gameweek.name ?? ""}</option>)}</select></label><p className="mt-3 text-[11px] font-bold text-white/45">แสดงทีมทั้งหมดในลีกของ Gameweek ที่เลือก ไม่จำเป็นต้อง Mapping</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><AwardEntrySelector id="champion-entry" label="Champion" colorClass="text-[#d9ff58]" entries={awardEntries} selectedIds={champions} onAdd={(entryId) => setChampions((current) => current.includes(entryId) ? current : [...current, entryId])} onRemove={(entryId) => setChampions((current) => current.filter((id) => id !== entryId))} /><AwardEntrySelector id="wooden-spoon-entry" label="Wooden spoon" colorClass="text-[#ff8698]" entries={awardEntries} selectedIds={woodenSpoons} onAdd={(entryId) => setWoodenSpoons((current) => current.includes(entryId) ? current : [...current, entryId])} onRemove={(entryId) => setWoodenSpoons((current) => current.filter((id) => id !== entryId))} /></div><button type="button" onClick={() => void saveAwards()} disabled={!awardLeagueId || !gameweekId || state === "running"} className="mt-4 rounded-xl border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-4 py-3 text-xs font-black text-[#d9ff58] disabled:opacity-40">บันทึก Awards</button></div>

    <AdminConfirmationModal target={archiveTarget} onCancel={() => setArchiveTarget(null)} onConfirm={confirmArchive} />
    <AdminAwardsConfirmationModal open={awardConfirmation !== null} leagueName={awardConfirmation?.leagueName ?? "ลีกที่เลือก"} gameweekNumber={awardConfirmation?.gameweekNumber ?? null} onCancel={() => setAwardConfirmation(null)} onConfirm={() => { const input = awardConfirmation; if (input) void saveAwards(true, input); }} />
    <AdminFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
  </section>;
}
