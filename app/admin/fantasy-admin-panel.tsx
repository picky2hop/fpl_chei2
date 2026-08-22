"use client";

import { useEffect, useState } from "react";
import { AdminFeedbackModal } from "./admin-feedback-modal";
import { feedbackFromAction, type AdminFeedback } from "@/lib/admin/feedback";

type League = { id: string; fpl_league_id: number; official_name: string; status: "active" | "archived" };
type EntryOption = { fpl_entry_id: number; fpl_team_name: string; fpl_manager_name: string; leagues: Array<{ id: string; official_name: string }> };
type Mapping = { id: string; app_user_id: string; fpl_entry_id: number; fpl_team_name: string; fpl_manager_name: string; mapping_status: "active" | "archived"; last_validation_status: "valid" | "error"; last_error_message: string | null };
type AdminData = { mappings: Mapping[]; users: Array<{ id: string; displayName: string; status: string }>; gameweeks: Array<{ id: string; number: number; name: string | null; is_current: boolean }>; leagues: League[]; unmappedEntries: EntryOption[]; leagueEntries: EntryOption[] };

export default function FantasyAdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [entryId, setEntryId] = useState("");
  const [userId, setUserId] = useState("");
  const [newLeagueId, setNewLeagueId] = useState("");
  const [replaceLeagueId, setReplaceLeagueId] = useState<Record<string, string>>({});
  const [awardLeagueId, setAwardLeagueId] = useState("");
  const [gameweekId, setGameweekId] = useState("");
  const [champions, setChampions] = useState<number[]>([]);
  const [woodenSpoons, setWoodenSpoons] = useState<number[]>([]);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);

  function applyData(value: AdminData) {
    setData(value);
    setUserId((current) => current || value.users.find((user) => user.status === "active")?.id || "");
    setEntryId((current) => current || String(value.unmappedEntries[0]?.fpl_entry_id ?? ""));
    setAwardLeagueId((current) => current || value.leagues.find((league) => league.status === "active")?.id || value.leagues[0]?.id || "");
    setGameweekId((current) => current || value.gameweeks.find((gameweek) => gameweek.is_current)?.id || value.gameweeks[0]?.id || "");
  }

  async function load(): Promise<AdminData> {
    const response = await fetch("/api/admin/fantasy/mappings");
    if (!response.ok) throw new Error("โหลด Fantasy admin ไม่สำเร็จ");
    return await response.json() as AdminData;
  }

  useEffect(() => { void load().then(applyData).catch((error: unknown) => setFeedback(feedbackFromAction({ ok: false, successMessage: "โหลดข้อมูลสำเร็จ", errorMessage: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" }))); }, []);

  async function action(request: Promise<Response>, success: string) {
    setState("running");
    setFeedback(null);
    try {
      const response = await request;
      const value = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(value.error ?? "ดำเนินการไม่สำเร็จ");
      setState("done");
      setFeedback(feedbackFromAction({ ok: true, successMessage: success }));
      applyData(await load());
    } catch (error) {
      setState("error");
      setFeedback(feedbackFromAction({ ok: false, successMessage: success, errorMessage: error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ" }));
    }
  }

  function toggle(setter: (value: number[]) => void, values: number[], id: number) { setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]); }
  const awardEntries = data?.leagueEntries.filter((entry) => entry.leagues.some((league) => league.id === awardLeagueId)) ?? [];

  return <section className="mt-4 rounded-3xl border border-[#6da9ff]/25 bg-[#10253a] p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6da9ff]">Fantasy analytics</p><h2 className="mt-1 text-lg font-black">จัดการ Fantasy</h2></div><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/sync", { method: "POST" }), "ซิงก์ Fantasy สำเร็จแล้ว")} disabled={state === "running"} className="rounded-xl bg-[#6da9ff] px-3 py-2 text-xs font-black text-[#071525] disabled:opacity-50">{state === "running" ? "กำลังซิงก์…" : "Sync Fantasy"}</button></div>
    <p className="mt-2 text-sm leading-6 text-white/60">จัดการลีก, ผูก LINE user กับสมาชิกลีก และเลือกแชมป์/บ๊วยจาก FPL Entry ID</p>

    <div className="mt-5 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">Fantasy Leagues</h3><div className="mt-3 flex gap-2"><input value={newLeagueId} onChange={(event) => setNewLeagueId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="FPL League ID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white" /><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/leagues", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fplLeagueId: Number(newLeagueId) }) }), "เพิ่มลีกและตรวจสอบชื่อทางการแล้ว")} disabled={!newLeagueId || state === "running"} className="rounded-xl bg-[#d9ff58] px-3 py-2 text-xs font-black text-[#071525] disabled:opacity-40">เพิ่มลีก</button></div><div className="mt-3 space-y-2">{data?.leagues.map((league) => <div key={league.id} className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{league.official_name}</p><p className="text-[10px] font-bold text-white/45">FPL League {league.fpl_league_id} · {league.status === "active" ? "ใช้งาน" : "เก็บประวัติ"}</p></div>{league.status === "active" && <button type="button" onClick={() => void action(fetch(`/api/admin/fantasy/leagues/${league.id}/archive`, { method: "POST" }), "เก็บลีกไว้ดูประวัติแล้ว")} className="rounded-lg border border-[#ff647c]/30 px-2 py-1 text-[10px] font-black text-[#ff8698]">Archive</button>}</div>{league.status === "active" && <div className="mt-2 flex gap-2"><input value={replaceLeagueId[league.id] ?? ""} onChange={(event) => setReplaceLeagueId((current) => ({ ...current, [league.id]: event.target.value.replace(/\D/g, "") }))} inputMode="numeric" placeholder="เปลี่ยน League ID" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#071525] px-2 py-2 text-xs font-bold text-white" /><button type="button" onClick={() => void action(fetch(`/api/admin/fantasy/leagues/${league.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fplLeagueId: Number(replaceLeagueId[league.id]) }) }), "ตรวจสอบและเปลี่ยนลีกแล้ว")} disabled={!replaceLeagueId[league.id] || state === "running"} className="rounded-lg border border-[#6da9ff]/30 px-2 py-1 text-[10px] font-black text-[#b8d4ff] disabled:opacity-40">เปลี่ยน</button></div>}</div>)}</div></div>

    <div className="mt-4 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">Mapping จากสมาชิกลีก</h3><label className="mt-3 block text-xs font-bold text-white/60">LINE user<select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white"><option value="">เลือกผู้ใช้</option>{data?.users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.status}</option>)}</select></label><label className="mt-3 block text-xs font-bold text-white/60">สมาชิกที่ยังไม่ได้ mapping<select value={entryId} onChange={(event) => setEntryId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white"><option value="">เลือกสมาชิกลีก</option>{data?.unmappedEntries.map((entry) => <option key={entry.fpl_entry_id} value={entry.fpl_entry_id}>{entry.fpl_team_name} · {entry.fpl_manager_name} · FPL {entry.fpl_entry_id} · {entry.leagues.map((league) => league.official_name).join(" + ")}</option>)}</select></label><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appUserId: userId, fplEntryId: Number(entryId) }) }), "ตรวจสอบและบันทึก mapping แล้ว")} disabled={!userId || !entryId || state === "running"} className="mt-3 rounded-xl bg-[#d9ff58] px-4 py-3 text-xs font-black text-[#071525] disabled:opacity-40">บันทึก Mapping</button></div>

    <div className="mt-4 space-y-2">{data?.mappings.map((mapping) => <div key={mapping.id} className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{mapping.fpl_team_name} · FPL {mapping.fpl_entry_id}</p><p className="text-xs font-bold text-white/45">{mapping.fpl_manager_name} · {mapping.mapping_status}{mapping.last_validation_status === "error" ? " · ต้องตรวจสอบใหม่" : ""}</p></div>{mapping.mapping_status === "active" && <button type="button" onClick={() => void action(fetch(`/api/admin/fantasy/mappings/${mapping.id}/archive`, { method: "POST" }), "archive mapping แล้ว")} className="rounded-lg border border-[#ff647c]/30 px-2 py-1 text-[10px] font-black text-[#ff8698]">Archive</button>}</div></div>)}</div>

    <div className="mt-5 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">Awards รายลีก / ราย GW</h3><label className="mt-3 block text-xs font-bold text-white/60">ลีก<select value={awardLeagueId} onChange={(event) => { setAwardLeagueId(event.target.value); setChampions([]); setWoodenSpoons([]); }} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white">{data?.leagues.map((league) => <option key={league.id} value={league.id}>{league.official_name} · {league.status}</option>)}</select></label><select value={gameweekId} onChange={(event) => setGameweekId(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white">{data?.gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.id}>GW {gameweek.number} · {gameweek.name ?? ""}</option>)}</select><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-black text-[#d9ff58]">Champion</p>{awardEntries.map((entry) => <label key={`c-${entry.fpl_entry_id}`} className="mt-2 flex items-center gap-2 text-xs font-bold text-white/70"><input type="checkbox" checked={champions.includes(entry.fpl_entry_id)} onChange={() => toggle(setChampions, champions, entry.fpl_entry_id)} />{entry.fpl_team_name} · {entry.fpl_entry_id}</label>)}</div><div><p className="text-xs font-black text-[#ff8698]">Wooden spoon</p>{awardEntries.map((entry) => <label key={`w-${entry.fpl_entry_id}`} className="mt-2 flex items-center gap-2 text-xs font-bold text-white/70"><input type="checkbox" checked={woodenSpoons.includes(entry.fpl_entry_id)} onChange={() => toggle(setWoodenSpoons, woodenSpoons, entry.fpl_entry_id)} />{entry.fpl_team_name} · {entry.fpl_entry_id}</label>)}</div></div><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/awards", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ leagueId: awardLeagueId, gameweekId, championEntryIds: champions, woodenSpoonEntryIds: woodenSpoons }) }), "บันทึก awards แล้ว")} disabled={!awardLeagueId || !gameweekId || state === "running"} className="mt-4 rounded-xl border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-4 py-3 text-xs font-black text-[#d9ff58] disabled:opacity-40">บันทึก Awards</button></div>

    <AdminFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
  </section>;
}
