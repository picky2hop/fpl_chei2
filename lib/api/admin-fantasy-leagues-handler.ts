import type { FantasyFplProvider } from "../fantasy/types.ts";
import type { FantasyLeagueRepository, FantasyRepository } from "../fantasy/repository.ts";

type AdminUser = { id: string };
type Dependencies = {
  requireAdmin: () => Promise<AdminUser>;
  repository: FantasyRepository & Pick<FantasyLeagueRepository, "listLeagues" | "createLeague" | "updateLeagueId" | "archiveLeague">;
  provider: Pick<FantasyFplProvider, "getLeague" | "getLeagueMembers">;
};

function validLeagueId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return null;
  try {
    const value: unknown = await request.json();
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function validateLeague(provider: Dependencies["provider"], fplLeagueId: number) {
  const [summary, members] = await Promise.all([provider.getLeague(fplLeagueId), provider.getLeagueMembers(fplLeagueId)]);
  if (summary.leagueId !== fplLeagueId || members.length === 0) throw new Error("Fantasy league validation failed");
  return summary;
}

export function createAdminFantasyLeaguesHandler(dependencies: Dependencies) {
  return async function handler(request: Request): Promise<Response> {
    try {
      await dependencies.requireAdmin();
    } catch {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const season = await dependencies.repository.getActiveSeason();
    if (request.method === "GET") {
      try {
        const leagues = await dependencies.repository.listLeagues(season.id, true);
        return Response.json({ season, leagues });
      } catch {
        return Response.json({ error: "ไม่สามารถโหลดลีก Fantasy ได้" }, { status: 500 });
      }
    }
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
    const value = await jsonBody(request);
    if (!value || !validLeagueId(value.fplLeagueId)) return Response.json({ error: "ต้องระบุ FPL League ID ที่ถูกต้อง" }, { status: 400 });
    try {
      const summary = await validateLeague(dependencies.provider, value.fplLeagueId);
      const league = await dependencies.repository.createLeague({ season_id: season.id, fpl_league_id: value.fplLeagueId, official_name: summary.officialName });
      return Response.json({ league }, { status: 201 });
    } catch {
      return Response.json({ error: "ไม่สามารถตรวจสอบหรือเพิ่ม FPL League ได้" }, { status: 409 });
    }
  };
}

export function createAdminFantasyLeaguePatchHandler(dependencies: Dependencies, leagueId: string) {
  return async function PATCH(request: Request): Promise<Response> {
    try {
      await dependencies.requireAdmin();
    } catch {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const value = await jsonBody(request);
    if (!value || !validLeagueId(value.fplLeagueId)) return Response.json({ error: "ต้องระบุ FPL League ID ที่ถูกต้อง" }, { status: 400 });
    try {
      const summary = await validateLeague(dependencies.provider, value.fplLeagueId);
      const league = await dependencies.repository.updateLeagueId(leagueId, { fpl_league_id: value.fplLeagueId, official_name: summary.officialName });
      return Response.json({ league });
    } catch {
      return Response.json({ error: "ไม่สามารถตรวจสอบหรือแก้ไข FPL League ได้" }, { status: 409 });
    }
  };
}

export function createAdminFantasyLeagueArchiveHandler(dependencies: Pick<Dependencies, "requireAdmin" | "repository">, leagueId: string) {
  return async function POST(): Promise<Response> {
    try {
      await dependencies.requireAdmin();
      await dependencies.repository.archiveLeague(leagueId);
      return new Response(null, { status: 204 });
    } catch {
      return Response.json({ error: "ไม่สามารถ archive Fantasy League ได้" }, { status: 500 });
    }
  };
}
