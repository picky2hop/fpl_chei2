export type FantasyTeamOfWeekHandlerDependencies = {
  requireUser: () => Promise<{ id: string }>;
  getTeamOfWeek: (input: { userId: string }) => Promise<unknown>;
};

function authStatus(error: unknown): 401 | 403 {
  if (typeof error === "object" && error !== null && "status" in error && error.status === 403) return 403;
  return 401;
}

export function createFantasyTeamOfWeekHandler(dependencies: FantasyTeamOfWeekHandlerDependencies) {
  return async function GET(): Promise<Response> {
    let user: { id: string };
    try {
      user = await dependencies.requireUser();
    } catch (error) {
      return Response.json({ error: "Authentication required" }, { status: authStatus(error) });
    }

    try {
      const result = await dependencies.getTeamOfWeek({ userId: user.id });
      return Response.json(result, { headers: { "cache-control": "no-store" } });
    } catch {
      return Response.json({ error: "Unable to load Fantasy Team of the Week" }, { status: 500 });
    }
  };
}
