"use client";

import { useEffect, useState } from "react";
import PredictionApp from "../components/prediction-app-final";
import { buildLiveProps, type DashboardPayload } from "@/lib/data/dashboard-view";
import type { UserProfile } from "@/lib/mock-data";

export default function LiveDashboard({ profile }: { profile: UserProfile }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => {
    let disposed = false;
    let requestSequence = 0;
    let activeController: AbortController | null = null;
    let hasLoaded = false;
    const load = async () => {
      const requestId = ++requestSequence;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      if (hasLoaded) setIsRefreshing(true);
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load live dashboard");
        const nextPayload = await response.json() as DashboardPayload;
        if (!disposed && requestId === requestSequence) {
          setPayload(nextPayload);
          setError("");
          hasLoaded = true;
        }
      } catch (reason: unknown) {
        if (!disposed && requestId === requestSequence && !(reason instanceof DOMException && reason.name === "AbortError")) setError("โหลดข้อมูลรอบล่าสุดไม่สำเร็จ");
      } finally {
        if (!disposed && requestId === requestSequence) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(interval);
    };
  }, [refreshVersion]);

  if (!payload) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#071525] text-sm font-bold text-white/60">{error || "กำลังโหลดข้อมูลการแข่งขัน…"}{!isLoading && error && <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-[#d9ff58] px-4 py-2 text-xs font-black text-[#071525]">ลองใหม่</button>}</main>;
  }

  const props = buildLiveProps(payload, profile);
  return <>{error && <div role="alert" className="border-b border-[#ffc857]/30 bg-[#ffc857]/10 px-4 py-3 text-center text-xs font-bold text-[#ffe0a0]">ข้อมูลอาจไม่ใช่ข้อมูลล่าสุด <button type="button" onClick={() => setRefreshVersion((version) => version + 1)} className="ml-2 rounded-full border border-[#ffc857]/40 px-3 py-1 font-black text-[#ffe0a0]">ลองใหม่</button></div>}{isRefreshing && <p role="status" className="sr-only">กำลังตรวจข้อมูลล่าสุด…</p>}<PredictionApp currentUser={props.profile} gameweeks={props.gameweeks} fixturesByGameweek={props.fixturesByGameweek} leaderboardByGameweek={props.leaderboardByGameweek} initialPredictionsByGameweek={props.initialPredictionsByGameweek} initialGameweek={props.current} initialPredictionGameweek={props.predictionDefaultGameweek} predictionBookByGameweek={payload.predictionBookByGameweek} onConfirmPredictions={async (_gameweek, predictions) => {
    const response = await fetch("/api/predictions", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ predictions: Object.entries(predictions).map(([fixtureId, choice]) => ({ fixtureId, choice })) }) });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error === "Prediction is locked" ? "มีคู่ที่เริ่มแข่งแล้ว กรุณาตรวจสอบคำทายอีกครั้ง" : "บันทึกคำทายไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  }} /></>;
}
