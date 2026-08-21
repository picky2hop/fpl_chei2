type User = { id: string };

export function createFantasyLeaguesHandler(dependencies: {
  requireUser: () => Promise<User>;
  getLeagues: (input: { userId: string }) => Promise<unknown>;
}) {
  return async function GET(_request: Request): Promise<Response> {
    void _request;
    let user: User;
    try {
      user = await dependencies.requireUser();
    } catch {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    try {
      return Response.json(await dependencies.getLeagues({ userId: user.id }));
    } catch {
      return Response.json({ error: "Unable to load Fantasy leagues" }, { status: 500 });
    }
  };
}
