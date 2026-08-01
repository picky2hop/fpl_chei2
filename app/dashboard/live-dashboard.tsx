"use client";

import { useEffect, useState } from "react";
import PredictionApp from "../components/prediction-app-final";
import { fixturesByGameweek as mockFixtures, gameweeks as mockGameweeks, leaderboardByGameweek as mockLeaderboard } from "@/lib/mock-data";
import type { Fixture, Gameweek, LeaderboardEntry, Team, UserProfile } from "@/lib/mock-data";
import type { PredictionMap } from "@/lib/predictions";
import type { DashboardPredictionBook } from "@/lib/data/dashboard-core";

type DashboardPayload = {
  gameweeks: Array<{ id: string; number: number; label: string; state: "current" | "past" | "future"; fixtureCount: number }>;
  fixtures: Array<{
    id: string; gameweekId: string; gameweekNumber: number; kickoffAt: string; status: string; homeScore: number | null; awayScore: number | null;
    homeTeam: { id: string; name: string; shortName: string; crest: string };
    awayTeam: { id: string; name: string; shortName: string; crest: string };
    predictionPercentages: { home: number; draw: number; away: number };
  }>;
  predictions: Array<{ fixtureId: string; choice: string; status: string }>;
  predictionBookByGameweek: DashboardPredictionBook;
  leaderboard: Array<{ id: string; displayName: string; avatarUrl: string; gameweekPoints: number; seasonPoints: number }>;
};

function team(value: DashboardPayload["fixtures"][number]["homeTeam"]): Team {
  return { id: value.id, name: value.name, shortName: value.shortName, accent: "#38bdf8", crest: value.crest || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='16' fill='%2310253a'/%3E%3C/svg%3E" };
}

function toFixture(value: DashboardPayload["fixtures"][number]): Fixture {
  const dateLabel = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value.kickoffAt));
  return { id: value.id, gameweek: value.gameweekNumber, kickoff: value.kickoffAt, dateLabel, status: value.status as Fixture["status"], homeTeam: team(value.homeTeam), awayTeam: team(value.awayTeam), homeScore: value.homeScore ?? undefined, awayScore: value.awayScore ?? undefined, predictionPercentages: value.predictionPercentages, predictors: { home: [], draw: [], away: [] } };
}

function buildLiveProps(payload: DashboardPayload, profile: UserProfile) {
  const fixtures = payload.fixtures.map(toFixture);
  const fixturesByGameweek = Object.fromEntries(payload.gameweeks.map((gameweek) => [gameweek.number, fixtures.filter((fixture) => fixture.gameweek === gameweek.number)]));
  const gameweeks: Gameweek[] = payload.gameweeks.map((gameweek) => ({ id: gameweek.number, label: gameweek.label, state: gameweek.state, fixtureCount: gameweek.fixtureCount }));
  const entries: LeaderboardEntry[] = payload.leaderboard.map((entry, index) => ({ ...entry, shortName: entry.displayName.slice(0, 2), rank: index + 1, trend: "same", form: [] }));
  const leaderboardByGameweek = Object.fromEntries(gameweeks.map((gameweek) => [gameweek.id, entries]));
  const gameweekNumberById = new Map(payload.gameweeks.map((gameweek) => [gameweek.id, gameweek.number]));
  const fixtureGameweek = new Map(fixtures.map((fixture) => [fixture.id, fixture.gameweek]));
  const initialPredictionsByGameweek: Record<number, PredictionMap> = {};
  for (const prediction of payload.predictions) {
    const gameweek = fixtureGameweek.get(prediction.fixtureId);
    if (gameweek && (prediction.choice === "home" || prediction.choice === "draw" || prediction.choice === "away")) {
      initialPredictionsByGameweek[gameweek] ??= {};
      initialPredictionsByGameweek[gameweek][prediction.fixtureId] = prediction.choice;
    }
  }
  const current = payload.gameweeks.find((gameweek) => gameweek.state === "current")?.number ?? gameweeks[0]?.id ?? 0;
  return { current, gameweeks, fixturesByGameweek, leaderboardByGameweek, initialPredictionsByGameweek, profile, gameweekNumberById };
}

export default function LiveDashboard({ profile }: { profile: UserProfile }) {
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/dashboard").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load live dashboard");
      setPayload(await response.json() as DashboardPayload);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load live dashboard"));
  }, []);

  if (!payload) {
    if (error && process.env.NEXT_PUBLIC_DEMO_MODE !== "false") return <PredictionApp currentUser={profile} gameweeks={mockGameweeks} fixturesByGameweek={mockFixtures} leaderboardByGameweek={mockLeaderboard} />;
    return <main className="flex min-h-screen items-center justify-center bg-[#071525] text-sm font-bold text-white/60">{error || "กำลังโหลดข้อมูลการแข่งขัน…"}</main>;
  }

  const props = buildLiveProps(payload, profile);
  return <PredictionApp currentUser={props.profile} gameweeks={props.gameweeks} fixturesByGameweek={props.fixturesByGameweek} leaderboardByGameweek={props.leaderboardByGameweek} initialPredictionsByGameweek={props.initialPredictionsByGameweek} initialGameweek={props.current} predictionBookByGameweek={payload.predictionBookByGameweek} onConfirmPredictions={async (gameweek, predictions) => {
    const gameweekId = payload.gameweeks.find((item) => item.number === gameweek)?.id;
    if (!gameweekId) throw new Error("Gameweek is unavailable");
    await Promise.all(Object.entries(predictions).map(async ([fixtureId, choice]) => {
      const response = await fetch("/api/predictions", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ fixtureId, choice }) });
      if (!response.ok) throw new Error("Unable to save predictions");
    }));
  }} />;
}
