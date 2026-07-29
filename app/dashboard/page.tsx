"use client";

import LiffGate from "../components/liff-gate";
import LiveDashboard from "./live-dashboard";

export default function DashboardPage() {
  return <LiffGate>{(profile) => <LiveDashboard profile={profile} />}</LiffGate>;
}
