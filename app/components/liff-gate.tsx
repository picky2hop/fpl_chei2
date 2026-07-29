"use client";

import liff from "@line/liff";
import { useEffect, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/mock-data";

type LiffGateProps = {
  children: (profile: UserProfile) => ReactNode;
};

type GateState = "loading" | "ready" | "error";

const previewProfile: UserProfile = {
  id: "line-demo-user",
  displayName: "คุณเชยเชย",
  shortName: "ชย",
  avatarUrl: "https://i.pravatar.cc/120?img=12",
};

function initials(displayName: string) {
  return displayName.trim().slice(0, 2) || "LINE";
}

export default function LiffGate({ children }: LiffGateProps) {
  const [state, setState] = useState<GateState>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const initialize = async () => {
    setState("loading");
    setErrorMessage("");

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

    if (!liffId) {
      if (isDemoMode) {
        setProfile(previewProfile);
        setState("ready");
      } else {
        setErrorMessage("ยังไม่ได้ตั้งค่า LIFF ID สำหรับแอปนี้");
        setState("error");
      }
      return;
    }

    try {
      await liff.init({ liffId });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      const idToken = liff.getIDToken();
      if (!idToken) throw new Error("LIFF ID token is unavailable");

      const authResponse = await fetch("/api/auth/liff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!authResponse.ok) throw new Error("Server authentication failed");

      const authResult: {
        user?: { id: string; displayName: string; avatarUrl: string | null };
      } = await authResponse.json();
      if (!authResult.user) throw new Error("Server authentication returned no user");

      const lineProfile = authResult.user;
      setProfile({
        id: lineProfile.id,
        displayName: lineProfile.displayName,
        shortName: initials(lineProfile.displayName),
        avatarUrl: lineProfile.avatarUrl ?? "",
      });
      setState("ready");
    } catch {
      setErrorMessage("เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setState("error");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (state === "ready" && profile) return <>{children(profile)}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071525] px-5 text-white">
      <div className="w-full max-w-sm text-center">
        {state === "loading" ? (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#d9ff58] text-xl font-black text-[#071525] shadow-[0_0_0_10px_rgba(217,255,88,0.08)]">90′</div>
            <div className="mx-auto mt-8 h-2 w-32 overflow-hidden rounded-full bg-white/10"><div className="loading-bar h-full w-1/2 rounded-full bg-[#d9ff58]" /></div>
            <p className="mt-4 text-sm font-bold text-[#a9bbca]">กำลังเชื่อมต่อ LINE…</p>
          </>
        ) : (
          <>
            <div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#ff647c]/10 text-2xl text-[#ff647c]">!</div>
            <h1 className="mt-6 text-2xl font-black">เข้าใช้งานไม่ได้</h1>
            <p className="mt-2 text-sm leading-6 text-[#a9bbca]">{errorMessage}</p>
            <button type="button" onClick={() => void initialize()} className="mt-6 rounded-2xl bg-[#d9ff58] px-5 py-3 text-sm font-black text-[#071525]">ลองใหม่</button>
          </>
        )}
      </div>
    </main>
  );
}
