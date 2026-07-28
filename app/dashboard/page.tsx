"use client";

import PredictionApp from "../components/prediction-app-revised";
import LiffGate from "../components/liff-gate";
import {
  fixturesByGameweek,
  gameweeks,
  leaderboardByGameweek,
} from "@/lib/mock-data";

export default function DashboardPage() {
  return <LiffGate>{(profile) => <PredictionApp currentUser={profile} gameweeks={gameweeks} fixturesByGameweek={fixturesByGameweek} leaderboardByGameweek={leaderboardByGameweek} />}</LiffGate>;
}
