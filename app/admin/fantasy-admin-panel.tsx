"use client";

import { useEffect, useState } from "react";

type Mapping = { id: string; app_user_id: string; fpl_entry_id: number; fpl_team_name: string; fpl_manager_name: string; mapping_status: "active" | "archived"; last_validation_status: "valid" | "error"; last_error_message: string | null };
type AdminData = { mappings: Mapping[]; users: Array<{ id: string; displayName: string; status: string }>; gameweeks: Array<{ id: string; number: number; name: string | null; is_current: boolean }> };

export default function FantasyAdminPanel() {
  const [data, setData] = useState<AdminData | null>(null);
  const [entryId, setEntryId] = useState("");
  const [userId, setUserId] = useState("");
  const [replaceEntry, setReplaceEntry] = useState<Record<string, string>>({});
  const [gameweekId, setGameweekId] = useState("");
  const [champions, setChampions] = useState<string[]>([]);
  const [woodenSpoons, setWoodenSpoons] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  function applyData(value: AdminData) {
    setData(value);
    setUserId((current) => current || value.users.find((user) => user.status === "active")?.id || "");
    setGameweekId((current) => current || value.gameweeks.find((gameweek) => gameweek.is_current)?.id || value.gameweeks[0]?.id || "");
  }

  async function load(): Promise<AdminData> {
    const response = await fetch("/api/admin/fantasy/mappings");
    if (!response.ok) throw new Error("โหลด Fantasy admin ไม่สำเร็จ");
    const value = await response.json() as AdminData;
    return value;
  }

  useEffect(() => { void load().then(applyData).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ")); }, []);

  async function action(request: Promise<Response>, success: string) {
    setState("running");
    setMessage("");
    try {
      const response = await request;
      const value = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(value.error ?? "ดำเนินการไม่สำเร็จ");
      setState("done");
      setMessage(success);
      applyData(await load());
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  const toggle = (setter: (value: string[]) => void, values: string[], id: string) => setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  return <section className="mt-4 rounded-3xl border border-[#6da9ff]/25 bg-[#10253a] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6da9ff]">Fantasy analytics</p><h2 className="mt-1 text-lg font-black">จัดการ Fantasy</h2></div><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/sync", { method: "POST" }), "ซิงก์ Fantasy สำเร็จแล้ว")} disabled={state === "running"} className="rounded-xl bg-[#6da9ff] px-3 py-2 text-xs font-black text-[#071525] disabled:opacity-50">{state === "running" ? "กำลังซิงก์…" : "Manual sync"}</button></div><p className="mt-2 text-sm leading-6 text-white/60">ผูก LINE user กับ FPL Entry, เปลี่ยนหรือ archive mapping และเลือกแชมป์/บ๊วยราย GW</p><div className="mt-5 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">เพิ่ม mapping</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-white/60">LINE user<select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white"><option value="">เลือกผู้ใช้</option>{data?.users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.status}</option>)}</select></label><label className="text-xs font-bold text-white/60">FPL Entry ID<input value={entryId} onChange={(event) => setEntryId(event.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white" placeholder="เช่น 123456" /></label></div><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appUserId: userId, fplEntryId: Number(entryId) }) }), "ตรวจสอบและเพิ่ม mapping แล้ว")} disabled={!userId || !entryId || state === "running"} className="mt-3 rounded-xl bg-[#d9ff58] px-4 py-3 text-xs font-black text-[#071525] disabled:opacity-40">ตรวจสอบ Entry และบันทึก</button></div><div className="mt-4 space-y-2">{data?.mappings.map((mapping) => <div key={mapping.id} className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{mapping.fpl_team_name} · FPL {mapping.fpl_entry_id}</p><p className="text-xs font-bold text-white/45">{mapping.fpl_manager_name} · {mapping.mapping_status}{mapping.last_validation_status === "error" ? " · ต้องตรวจสอบใหม่" : ""}</p></div>{mapping.mapping_status === "active" && <button type="button" onClick={() => void action(fetch(`/api/admin/fantasy/mappings/${mapping.id}/archive`, { method: "POST" }), "archive mapping แล้ว")} className="rounded-lg border border-[#ff647c]/30 px-2 py-1 text-[10px] font-black text-[#ff8698]">Archive</button>}</div>{mapping.mapping_status === "active" && <div className="mt-3 flex gap-2"><input value={replaceEntry[mapping.id] ?? ""} onChange={(event) => setReplaceEntry((current) => ({ ...current, [mapping.id]: event.target.value.replace(/\D/g, "") }))} inputMode="numeric" placeholder="Entry ใหม่" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#071525] px-2 py-2 text-xs font-bold text-white" /><button type="button" onClick={() => void action(fetch(`/api/admin/fantasy/mappings/${mapping.id}/replace`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fplEntryId: Number(replaceEntry[mapping.id]) }) }), "เปลี่ยน Entry และ archive ของเดิมแล้ว")} disabled={!replaceEntry[mapping.id] || state === "running"} className="rounded-lg border border-[#6da9ff]/30 px-2 py-1 text-[10px] font-black text-[#b8d4ff] disabled:opacity-40">Replace</button></div>}</div>)}</div><div className="mt-5 rounded-2xl border border-white/10 bg-[#071525]/50 p-4"><h3 className="text-sm font-black">Awards ราย GW</h3><select value={gameweekId} onChange={(event) => setGameweekId(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white">{data?.gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.id}>GW {gameweek.number} · {gameweek.name ?? ""}</option>)}</select><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-black text-[#d9ff58]">Champion</p>{data?.mappings.map((mapping) => <label key={`c-${mapping.id}`} className="mt-2 flex items-center gap-2 text-xs font-bold text-white/70"><input type="checkbox" checked={champions.includes(mapping.id)} onChange={() => toggle(setChampions, champions, mapping.id)} />{mapping.fpl_team_name}</label>)}</div><div><p className="text-xs font-black text-[#ff8698]">Wooden spoon</p>{data?.mappings.map((mapping) => <label key={`w-${mapping.id}`} className="mt-2 flex items-center gap-2 text-xs font-bold text-white/70"><input type="checkbox" checked={woodenSpoons.includes(mapping.id)} onChange={() => toggle(setWoodenSpoons, woodenSpoons, mapping.id)} />{mapping.fpl_team_name}</label>)}</div></div><button type="button" onClick={() => void action(fetch("/api/admin/fantasy/awards", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ gameweekId, championMappingIds: champions, woodenSpoonMappingIds: woodenSpoons }) }), "บันทึก awards แล้ว")} disabled={!gameweekId || state === "running"} className="mt-4 rounded-xl border border-[#d9ff58]/30 bg-[#d9ff58]/10 px-4 py-3 text-xs font-black text-[#d9ff58] disabled:opacity-40">บันทึก Awards</button></div>{message && <p role="status" className={`mt-4 text-sm ${state === "error" ? "text-[#ff8698]" : "text-[#b7f5de]"}`}>{message}</p>}</section>;
}
