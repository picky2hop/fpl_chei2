import assert from "node:assert/strict";
import test from "node:test";
import { createFantasyHandler } from "../../lib/api/fantasy-handler.ts";

test("Fantasy API returns the requested historical gameweek for authenticated users", async () => {
  let requested: { userId: string; gameweekNumber?: number } | undefined;
  const handler = createFantasyHandler({
    requireUser: async () => ({ id: "user-1" }),
    getDashboard: async (input) => {
      requested = input;
      return { currentGameweek: 2, selectedLeaderboardGameweek: 1 };
    },
  });

  const response = await handler(new Request("https://example.test/api/fantasy?leagueId=league-1&gameweek=1"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(requested, { userId: "user-1", leagueId: "league-1", gameweekNumber: 1, mode: "gameweek" });
});

test("Fantasy API rejects invalid gameweek before loading data", async () => {
  let loads = 0;
  const handler = createFantasyHandler({
    requireUser: async () => ({ id: "user-1" }),
    getDashboard: async () => { loads += 1; return {}; },
  });
  const response = await handler(new Request("https://example.test/api/fantasy?leagueId=league-1&gameweek=39"));
  assert.equal(response.status, 400);
  assert.equal(loads, 0);
});

test("Fantasy API keeps auth and database errors generic", async () => {
  const unauthenticated = createFantasyHandler({
    requireUser: async () => { throw new Error("not authenticated"); },
    getDashboard: async () => ({}),
  });
  assert.equal((await unauthenticated(new Request("https://example.test/api/fantasy?leagueId=league-1"))).status, 401);

  const failed = createFantasyHandler({
    requireUser: async () => ({ id: "user-1" }),
    getDashboard: async () => { throw new Error("secret database detail"); },
  });
  const response = await failed(new Request("https://example.test/api/fantasy?leagueId=league-1"));
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /secret database detail/);
});

test("Fantasy API requires a league and rejects an unsupported mode", async () => {
  const handler = createFantasyHandler({ requireUser: async () => ({ id: "user-1" }), getDashboard: async () => ({}) });
  assert.equal((await handler(new Request("https://example.test/api/fantasy"))).status, 400);
  assert.equal((await handler(new Request("https://example.test/api/fantasy?leagueId=league-1&mode=bad"))).status, 400);
});
