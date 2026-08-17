"use client";

import { useLiffAuth } from "../components/liff-gate";
import FantasyApp from "./fantasy-app";

export default function FantasyPage() {
  const { profile } = useLiffAuth();
  return profile ? <FantasyApp profile={profile} /> : null;
}
