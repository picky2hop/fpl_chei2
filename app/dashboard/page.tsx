"use client";

import { useLiffAuth } from "../components/liff-gate";
import LiveDashboard from "./live-dashboard";

export default function DashboardPage() {
  const { profile } = useLiffAuth();
  return profile ? <LiveDashboard profile={profile} /> : null;
}
