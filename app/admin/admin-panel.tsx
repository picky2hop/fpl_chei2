"use client";

import { useEffect, useState } from "react";
import FantasyAdminPanel from "./fantasy-admin-panel";
import { AdminFeedbackModal } from "./admin-feedback-modal";
import { feedbackFromAction, type AdminFeedback } from "@/lib/admin/feedback";

type ParticipantOptions = {
  users: Array<{ id: string; displayName: string; status: string }>;
  gameweeks: Array<{ id: string; label: string }>;
};

export default function AdminPanel() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [options, setOptions] = useState<ParticipantOptions | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedGameweekId, setSelectedGameweekId] = useState("");

  useEffect(() => {
    void fetch("/api/admin/participants").then(async (response) => {
      if (!response.ok) throw new Error("โหลดรายชื่อผู้เล่นไม่สำเร็จ");
      const value = await response.json() as ParticipantOptions;
      setOptions(value);
      setSelectedUserId(value.users[0]?.id ?? "");
      setSelectedGameweekId(value.gameweeks[0]?.id ?? "");
    }).catch((error: unknown) => setFeedback(feedbackFromAction({ ok: false, successMessage: "โหลดข้อมูลสำเร็จ", errorMessage: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" })));
  }, []);

  async function runSync() {
    setState("running");
    setFeedback(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const body = await response.json() as { fixturesUpserted?: number; message?: string; reason?: string; error?: string };
      if (!response.ok) throw new Error(body.reason ?? body.error ?? "ซิงก์ข้อมูลไม่สำเร็จ");
      setState("done");
      setFeedback(feedbackFromAction({ ok: true, successMessage: body.message ?? `อัปเดต fixtures ${body.fixturesUpserted ?? 0} รายการแล้ว` }));
    } catch (error) {
      setState("error");
      setFeedback(feedbackFromAction({ ok: false, successMessage: "ซิงก์สำเร็จแล้ว", errorMessage: error instanceof Error ? error.message : "ซิงก์ข้อมูลไม่สำเร็จ" }));
    }
  }

  async function updateParticipation(status: "active" | "excluded") {
    if (!selectedUserId || !selectedGameweekId) return;
    setState("running");
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, gameweekId: selectedGameweekId, status }),
      });
      if (!response.ok) throw new Error("อัปเดตสถานะผู้เล่นไม่สำเร็จ");
      setState("done");
      setFeedback(feedbackFromAction({ ok: true, successMessage: status === "excluded" ? "Exclude ผู้เล่นใน gameweek นี้แล้ว" : "คืนสถานะผู้เล่นใน gameweek นี้แล้ว" }));
    } catch (error) {
      setState("error");
      setFeedback(feedbackFromAction({ ok: false, successMessage: "อัปเดตสำเร็จแล้ว", errorMessage: error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ" }));
    }
  }

  return (
    <main className="min-h-screen bg-[#071525] px-5 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8ca6bd]">FPL CHEI CHEI</p>
        <h1 className="mt-2 text-3xl font-black">Admin</h1>
        <section className="mt-8 rounded-3xl border border-white/10 bg-[#10253a] p-5">
          <h2 className="text-lg font-black">ซิงก์ข้อมูล FPL</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">ดึงโปรแกรมแข่งและผลล่าสุดจาก FPL แล้วคำนวณ GW ที่ได้รับผลกระทบใหม่</p>
          <button type="button" onClick={() => void runSync()} disabled={state === "running"} className="mt-5 rounded-2xl bg-[#d9ff58] px-5 py-3 text-sm font-black text-[#071525] disabled:cursor-wait disabled:opacity-50">
            {state === "running" ? "กำลังซิงก์…" : "Manual sync"}
          </button>
        </section>
        <section className="mt-4 rounded-3xl border border-white/10 bg-[#10253a] p-5">
          <h2 className="text-lg font-black">จัดการ participation ราย GW</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">Exclude เฉพาะ gameweek โดยไม่ลบ user, prediction history หรือข้อมูลฤดูกาล</p>
          <div className="mt-5 space-y-3">
            <label className="block text-xs font-bold text-white/60">ผู้เล่น<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} disabled={!options || state === "running"} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white outline-none"><option value="">เลือกผู้เล่น</option>{options?.users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.status}</option>)}</select></label>
            <label className="block text-xs font-bold text-white/60">Gameweek<select value={selectedGameweekId} onChange={(event) => setSelectedGameweekId(event.target.value)} disabled={!options || state === "running"} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071525] px-3 py-3 text-sm font-bold text-white outline-none"><option value="">เลือก gameweek</option>{options?.gameweeks.map((gameweek) => <option key={gameweek.id} value={gameweek.id}>{gameweek.label}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-2 pt-2"><button type="button" onClick={() => void updateParticipation("excluded")} disabled={!selectedUserId || !selectedGameweekId || state === "running"} className="rounded-xl border border-[#ff647c]/30 bg-[#ff647c]/10 py-3 text-sm font-black text-[#ff8698] disabled:opacity-40">Exclude</button><button type="button" onClick={() => void updateParticipation("active")} disabled={!selectedUserId || !selectedGameweekId || state === "running"} className="rounded-xl border border-[#47d7a0]/30 bg-[#47d7a0]/10 py-3 text-sm font-black text-[#b7f5de] disabled:opacity-40">Restore</button></div>
          </div>
        </section>
        <FantasyAdminPanel />
        <AdminFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} />
      </div>
    </main>
  );
}
