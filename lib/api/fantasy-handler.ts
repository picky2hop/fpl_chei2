export type FantasyHandlerDependencies = {
  requireUser: () => Promise<{ id: string }>;
  getDashboard: (input: { userId: string; leagueId: string; gameweekNumber?: number; mode: "gameweek" | "season" }) => Promise<unknown>;
};

function authStatus(error: unknown): 401 | 403 {
  if (typeof error === "object" && error !== null && "status" in error && error.status === 403) return 403;
  return 401;
}

export function createFantasyHandler(dependencies: FantasyHandlerDependencies) {
  return async function GET(request: Request): Promise<Response> {
    let user: { id: string };
    try {
      user = await dependencies.requireUser();
    } catch (error) {
      const status = authStatus(error);
      return Response.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
    }

    const url = new URL(request.url);
    const leagueId = url.searchParams.get("league")?.trim() ?? url.searchParams.get("leagueId")?.trim() ?? "";
    if (!leagueId) return Response.json({ error: "ต้องเลือกลีก Fantasy ก่อนดูอันดับ" }, { status: 400 });
    const rawGameweek = url.searchParams.get("gameweek");
    let gameweekNumber: number | undefined;
    if (rawGameweek !== null) {
      gameweekNumber = Number(rawGameweek);
      if (!Number.isInteger(gameweekNumber) || gameweekNumber < 1 || gameweekNumber > 38) {
        return Response.json({ error: "Invalid gameweek" }, { status: 400 });
      }
    }
    const rawMode = url.searchParams.get("mode");
    const mode = rawMode === null || rawMode === "gameweek" || rawMode === "season" ? (rawMode ?? "gameweek") : null;
    if (!mode) return Response.json({ error: "Invalid Fantasy mode" }, { status: 400 });

    try {
      return Response.json(await dependencies.getDashboard({ userId: user.id, leagueId, gameweekNumber, mode }));
    } catch {
      return Response.json({ error: "Unable to load Fantasy" }, { status: 500 });
    }
  };
}
