export type FantasyHandlerDependencies = {
  requireUser: () => Promise<{ id: string }>;
  getDashboard: (input: { userId: string; gameweekNumber?: number }) => Promise<unknown>;
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
    const rawGameweek = url.searchParams.get("gameweek");
    let gameweekNumber: number | undefined;
    if (rawGameweek !== null) {
      gameweekNumber = Number(rawGameweek);
      if (!Number.isInteger(gameweekNumber) || gameweekNumber < 1 || gameweekNumber > 38) {
        return Response.json({ error: "Invalid gameweek" }, { status: 400 });
      }
    }

    try {
      return Response.json(await dependencies.getDashboard({ userId: user.id, gameweekNumber }));
    } catch {
      return Response.json({ error: "Unable to load Fantasy" }, { status: 500 });
    }
  };
}
