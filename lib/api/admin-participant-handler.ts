export type ParticipantStatus = "active" | "excluded";

export type AdminParticipantDependencies = {
  requireAdmin: () => Promise<{ id: string }>;
  setParticipantStatus: (input: { userId: string; gameweekId: string; status: ParticipantStatus }) => Promise<void>;
  listOptions?: () => Promise<{
    users: Array<{ id: string; displayName: string; status: string }>;
    gameweeks: Array<{ id: string; label: string }>;
  }>;
};

export function createAdminParticipantHandler(dependencies: AdminParticipantDependencies) {
  return async function POST(request: Request): Promise<Response> {
    try {
      await dependencies.requireAdmin();
    } catch {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    if (request.method === "GET") {
      if (!dependencies.listOptions) return Response.json({ error: "Not implemented" }, { status: 500 });
      try {
        return Response.json(await dependencies.listOptions());
      } catch {
        return Response.json({ error: "Unable to load participant options" }, { status: 500 });
      }
    }
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
    if (typeof body !== "object" || body === null || !("userId" in body) || !("gameweekId" in body) || !("status" in body) || typeof body.userId !== "string" || typeof body.gameweekId !== "string" || (body.status !== "active" && body.status !== "excluded")) {
      return Response.json({ error: "userId, gameweekId, and status are required" }, { status: 400 });
    }
    try {
      await dependencies.setParticipantStatus({ userId: body.userId, gameweekId: body.gameweekId, status: body.status });
      return new Response(null, { status: 204 });
    } catch {
      return Response.json({ error: "Unable to update participant" }, { status: 500 });
    }
  };
}
