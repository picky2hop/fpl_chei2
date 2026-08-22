export type FantasyTeamHandlerDependencies = {
  requireUser: () => Promise<{ id: string }>;
  getCurrentTeam: (input: {
    userId: string;
    leagueId: string;
    entryId: number;
  }) => Promise<unknown>;
};

function authStatus(error: unknown): 401 | 403 {
  if (typeof error === "object" && error !== null && "status" in error && error.status === 403) return 403;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("forbidden") || message.includes("admin") ? 403 : 401;
}

export function createFantasyTeamHandler(dependencies: FantasyTeamHandlerDependencies) {
  return async function GET(request: Request): Promise<Response> {
    let user: { id: string };
    try {
      user = await dependencies.requireUser();
    } catch (error) {
      return Response.json({ error: "Unauthorized" }, { status: authStatus(error) });
    }

    const url = new URL(request.url);
    const leagueId = url.searchParams.get("league")?.trim()
      ?? url.searchParams.get("leagueId")?.trim()
      ?? "";
    const rawEntryId = url.searchParams.get("entry")?.trim()
      ?? url.searchParams.get("entryId")?.trim()
      ?? "";
    const entryId = Number(rawEntryId);

    if (!leagueId || !Number.isInteger(entryId) || entryId < 1) {
      return Response.json({ error: "Invalid Fantasy team request" }, { status: 400 });
    }

    try {
      const team = await dependencies.getCurrentTeam({
        userId: user.id,
        leagueId,
        entryId,
      });
      return Response.json(team);
    } catch {
      return Response.json({ error: "Unable to load Fantasy team" }, { status: 500 });
    }
  };
}
