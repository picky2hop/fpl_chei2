import { getServerEnv } from "@/lib/env";
import { normalizeFplFixture, type FplFixturePayload } from "./fpl-core";

type FplTeamPayload = {
  id: number;
  name: string;
  short_name: string;
  code: number;
};

type FplEventPayload = {
  id: number;
  name: string;
  is_current: boolean;
};

export type FplSnapshot = {
  teams: FplTeamPayload[];
  events: FplEventPayload[];
  fixtures: FplFixturePayload[];
};

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "fpl-chei-phase-2-sync" } });
  if (!response.ok) throw new Error(`FPL source returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function fetchFplSnapshot(fetchImpl: typeof fetch = fetch): Promise<FplSnapshot> {
  const baseUrl = getServerEnv().fplApiBaseUrl.replace(/\/$/, "");
  const [bootstrap, fixtures] = await Promise.all([
    fetchJson<{ teams: FplTeamPayload[]; events: FplEventPayload[] }>(`${baseUrl}/api/bootstrap-static/`, fetchImpl),
    fetchJson<FplFixturePayload[]>(`${baseUrl}/api/fixtures/`, fetchImpl),
  ]);
  if (!Array.isArray(bootstrap.teams) || !Array.isArray(bootstrap.events) || !Array.isArray(fixtures)) {
    throw new Error("FPL source payload is invalid");
  }
  for (const fixture of fixtures) normalizeFplFixture(fixture);
  return { teams: bootstrap.teams, events: bootstrap.events, fixtures };
}
