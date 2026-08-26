import { getServerEnv } from "../env.ts";
import { validateFplSnapshot, type FplSnapshot } from "./fpl-core.ts";
import { SyncFailure } from "./sync-errors.ts";

export type FetchFplSnapshotOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  expectedFixtureCount?: number;
};

async function fetchJson(url: string, fetchImpl: typeof fetch, signal: AbortSignal): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json", "user-agent": "fpl-chei-phase-3a-sync" },
    signal,
  });
  if (!response.ok) {
    const code = response.status === 403
      ? "FPL_HTTP_403"
      : response.status === 502
        ? "FPL_HTTP_502"
        : "FPL_HTTP_ERROR";
    throw new SyncFailure(code, "FPL source request failed", { providerStatus: response.status });
  }
  try {
    return await response.json();
  } catch {
    throw new SyncFailure("FPL_INVALID_SNAPSHOT", "FPL source snapshot is invalid", { reason: "invalid_json" });
  }
}

export async function fetchFplSnapshot(options: FetchFplSnapshotOptions = {}): Promise<FplSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? getServerEnv().fplApiBaseUrl).replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const [bootstrap, fixtures] = await Promise.all([
      fetchJson(`${baseUrl}/api/bootstrap-static/`, fetchImpl, controller.signal),
      fetchJson(`${baseUrl}/api/fixtures/`, fetchImpl, controller.signal),
    ]);
    if (typeof bootstrap !== "object" || bootstrap === null) {
      throw new SyncFailure("FPL_INVALID_SNAPSHOT", "FPL source snapshot is invalid", { reason: "invalid_bootstrap" });
    }
    return validateFplSnapshot({
      teams: "teams" in bootstrap ? bootstrap.teams : undefined,
      events: "events" in bootstrap ? bootstrap.events : undefined,
      fixtures,
    }, { expectedFixtureCount: options.expectedFixtureCount ?? 380 });
  } catch (error) {
    controller.abort();
    if (error instanceof SyncFailure) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SyncFailure("FPL_TIMEOUT", "FPL source request timed out");
    }
    throw new SyncFailure("FPL_UNAVAILABLE", "FPL source is unavailable");
  } finally {
    clearTimeout(timeout);
  }
}
