import type { FantasyRepository } from "@/lib/fantasy/repository";
import type { FantasyFplProvider } from "@/lib/fantasy/types";

type AdminUser = { id: string };

type AdminFantasyDependencies = {
  requireAdmin: () => Promise<AdminUser>;
  repository: FantasyRepository;
  provider: Pick<FantasyFplProvider, "getEntrySummary">;
  listUsers?: () => Promise<Array<{ id: string; displayName: string; status: string }>>;
};

function jsonRequest(request: Request): boolean {
  return request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  if (!jsonRequest(request)) return null;
  try {
    const value: unknown = await request.json();
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function validEntryId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function createAdminFantasyMappingsHandler(dependencies: AdminFantasyDependencies) {
  return async function handler(request: Request): Promise<Response> {
    try {
      await dependencies.requireAdmin();
    } catch {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const season = await dependencies.repository.getActiveSeason();
    if (request.method === "GET") {
      try {
        const [mappings, users, dashboard] = await Promise.all([
          dependencies.repository.listMappings(season.id),
          dependencies.listUsers?.() ?? Promise.resolve([]),
          dependencies.repository.getDashboard({ seasonId: season.id }),
        ]);
        return Response.json({ season, mappings, users, gameweeks: dashboard.gameweeks });
      } catch {
        return Response.json({ error: "Unable to load Fantasy mappings" }, { status: 500 });
      }
    }
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
    const value = await body(request);
    if (!value || typeof value.appUserId !== "string" || !value.appUserId || !validEntryId(value.fplEntryId)) {
      return Response.json({ error: "appUserId and a valid fplEntryId are required" }, { status: 400 });
    }
    try {
      const entry = await dependencies.provider.getEntrySummary(value.fplEntryId);
      const mapping = await dependencies.repository.createMapping({
        season_id: season.id,
        app_user_id: value.appUserId,
        fpl_entry_id: entry.entryId,
        fpl_team_name: entry.teamName,
        fpl_manager_name: entry.managerName,
      });
      return Response.json({ mapping }, { status: 201 });
    } catch {
      return Response.json({ error: "ไม่สามารถตรวจสอบหรือบันทึก FPL Entry ได้" }, { status: 409 });
    }
  };
}

export function createAdminFantasyReplaceHandler(dependencies: AdminFantasyDependencies, mappingId: string) {
  return async function POST(request: Request): Promise<Response> {
    try {
      await dependencies.requireAdmin();
    } catch {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const value = await body(request);
    if (!value || !validEntryId(value.fplEntryId)) return Response.json({ error: "A valid fplEntryId is required" }, { status: 400 });
    try {
      const season = await dependencies.repository.getActiveSeason();
      const oldMapping = (await dependencies.repository.listMappings(season.id)).find((mapping) => mapping.id === mappingId);
      if (!oldMapping) return Response.json({ error: "Mapping not found" }, { status: 404 });
      const entry = await dependencies.provider.getEntrySummary(value.fplEntryId);
      const mapping = await dependencies.repository.replaceMapping(mappingId, {
        season_id: season.id,
        app_user_id: oldMapping.app_user_id,
        fpl_entry_id: entry.entryId,
        fpl_team_name: entry.teamName,
        fpl_manager_name: entry.managerName,
      });
      return Response.json({ mapping });
    } catch {
      return Response.json({ error: "ไม่สามารถตรวจสอบหรือเปลี่ยน FPL Entry ได้" }, { status: 409 });
    }
  };
}

export function createAdminFantasyArchiveHandler(dependencies: Pick<AdminFantasyDependencies, "requireAdmin" | "repository">, mappingId: string) {
  return async function POST(): Promise<Response> {
    try {
      await dependencies.requireAdmin();
      await dependencies.repository.archiveMapping(mappingId);
      return new Response(null, { status: 204 });
    } catch {
      return Response.json({ error: "ไม่สามารถ archive Fantasy mapping ได้" }, { status: 500 });
    }
  };
}

export function createAdminFantasyAwardsHandler(dependencies: Pick<AdminFantasyDependencies, "requireAdmin" | "repository">) {
  return async function PUT(request: Request): Promise<Response> {
    let admin: AdminUser;
    try {
      admin = await dependencies.requireAdmin();
    } catch {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const value = await body(request);
    if (!value || typeof value.gameweekId !== "string" || !Array.isArray(value.championMappingIds) || !Array.isArray(value.woodenSpoonMappingIds)
      || !value.championMappingIds.every((id) => typeof id === "string") || !value.woodenSpoonMappingIds.every((id) => typeof id === "string")) {
      return Response.json({ error: "Invalid awards request" }, { status: 400 });
    }
    try {
      const season = await dependencies.repository.getActiveSeason();
      const dashboard = await dependencies.repository.getDashboard({ seasonId: season.id });
      const mappings = new Set(dashboard.mappings.map((mapping) => mapping.id));
      if (!dashboard.gameweeks.some((gameweek) => gameweek.id === value.gameweekId)
        || [...value.championMappingIds, ...value.woodenSpoonMappingIds].some((id) => !mappings.has(id))) {
        return Response.json({ error: "Invalid Fantasy award target" }, { status: 400 });
      }
      const awards = [
        ...value.championMappingIds.map((mappingId) => ({ mappingId, award: "champion" as const })),
        ...value.woodenSpoonMappingIds.map((mappingId) => ({ mappingId, award: "wooden_spoon" as const })),
      ];
      await dependencies.repository.replaceAwards({ seasonId: season.id, gameweekId: value.gameweekId, selectedBy: admin.id, awards });
      return Response.json({ ok: true });
    } catch {
      return Response.json({ error: "Unable to update Fantasy awards" }, { status: 500 });
    }
  };
}
