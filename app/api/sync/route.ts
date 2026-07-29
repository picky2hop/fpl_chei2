import { requireAdmin } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/env";
import { syncFplData, type SyncMode } from "@/lib/sync/sync-service";

function hasSchedulerToken(request: Request): boolean {
  return request.headers.get("x-fpl-sync-token") === getServerEnv().syncToken;
}

export async function POST(request: Request): Promise<Response> {
  const scheduled = hasSchedulerToken(request);
  if (!scheduled) {
    try {
      await requireAdmin();
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error && (error.status === 401 || error.status === 403) ? error.status : 500;
      return Response.json({ error: status === 403 ? "Admin access required" : "Authentication required" }, { status });
    }
  }

  let mode: SyncMode = scheduled ? "scheduled" : "manual";
  try {
    const body = await request.json() as { mode?: unknown };
    if (!scheduled && body.mode === "scheduled") mode = "manual";
  } catch {
    // Empty request bodies are valid for both scheduler and manual calls.
  }

  try {
    return Response.json(await syncFplData(mode));
  } catch {
    return Response.json({ error: "Sync failed" }, { status: 502 });
  }
}
