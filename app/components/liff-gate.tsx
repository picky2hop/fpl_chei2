"use client";

import liff from "@line/liff";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserProfile } from "@/lib/mock-data";

type GateState = "loading" | "ready" | "error";

type LiffAuthContextValue = {
  state: GateState;
  profile: UserProfile | null;
  errorMessage: string;
  retry: () => void;
};

type AuthResponse = {
  user?: { id: string; displayName: string; avatarUrl: string | null };
};

const LiffAuthContext = createContext<LiffAuthContextValue | null>(null);
let liffInitializationPromise: Promise<UserProfile> | null = null;

class LiffLoginRedirectStarted extends Error {
  constructor() {
    super("LINE login redirect started");
    this.name = "LiffLoginRedirectStarted";
  }
}

function initials(displayName: string) {
  return displayName.trim().slice(0, 2) || "LINE";
}

async function initializeLiff(): Promise<UserProfile> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) throw new Error("LIFF ID is not configured");

  await liff.init({ liffId });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    throw new LiffLoginRedirectStarted();
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("LIFF ID token is unavailable");

  const authResponse = await fetch("/api/auth/liff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!authResponse.ok) throw new Error("Server authentication failed");

  const authResult = await authResponse.json() as AuthResponse;
  if (!authResult.user) throw new Error("Server authentication returned no user");

  return {
    id: authResult.user.id,
    displayName: authResult.user.displayName,
    shortName: initials(authResult.user.displayName),
    avatarUrl: authResult.user.avatarUrl ?? "",
  };
}

function startLiffInitialization(): Promise<UserProfile> {
  if (!liffInitializationPromise) {
    liffInitializationPromise = initializeLiff().catch((error: unknown) => {
      liffInitializationPromise = null;
      throw error;
    });
  }
  return liffInitializationPromise;
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function LiffLoadingScreen({ state, errorMessage, retry }: Pick<LiffAuthContextValue, "state" | "errorMessage" | "retry">) {
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
            <button type="button" onClick={retry} className="mt-6 rounded-2xl bg-[#d9ff58] px-5 py-3 text-sm font-black text-[#071525]">ลองใหม่</button>
          </>
        )}
      </div>
    </main>
  );
}

export function useLiffAuth(): LiffAuthContextValue {
  const context = useContext(LiffAuthContext);
  if (!context) throw new Error("useLiffAuth must be used inside LiffProvider");
  return context;
}

export default function LiffProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const adminRoute = isAdminPath(pathname);
  const [state, setState] = useState<GateState>(adminRoute ? "ready" : "loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const initialize = useCallback(() => {
    if (adminRoute) return;
    setState("loading");
    setErrorMessage("");
    void startLiffInitialization()
      .then((nextProfile) => {
        setProfile(nextProfile);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof LiffLoginRedirectStarted) return;
        setErrorMessage("เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setState("error");
      });
  }, [adminRoute]);

  useEffect(() => {
    if (adminRoute) return;
    const timer = window.setTimeout(initialize, 0);
    return () => window.clearTimeout(timer);
  }, [adminRoute, initialize]);

  const value = useMemo(() => ({ state, profile, errorMessage, retry: initialize }), [errorMessage, initialize, profile, state]);
  if (!adminRoute && (state !== "ready" || !profile)) return <LiffLoadingScreen state={state} errorMessage={errorMessage} retry={initialize} />;

  return <LiffAuthContext.Provider value={value}>{children}</LiffAuthContext.Provider>;
}
