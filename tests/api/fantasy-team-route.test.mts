import assert from "node:assert/strict";
import test from "node:test";
import { createFantasyTeamHandler } from "../../lib/api/fantasy-team-handler.ts";

test("Fantasy team API loads the requested Entry current squad", async () => {
  let requested: { userId: string; leagueId: string; entryId: number } | undefined;
  const handler = createFantasyTeamHandler({
    requireUser: async () => ({ id: "user-1" }),
    getCurrentTeam: async (input) => {
      requested = input;
      return { entryId: 123, gameweekNumber: 3 };
    },
  });

  const response = await handler(new Request("https://example.test/api/fantasy/team?league=league-1&entry=123"));
  assert.equal(response.status, 200);
  assert.deepEqual(requested, { userId: "user-1", leagueId: "league-1", entryId: 123 });
  assert.deepEqual(await response.json(), { entryId: 123, gameweekNumber: 3 });
});

test("Fantasy team API rejects invalid Entry IDs before loading data", async () => {
  let loads = 0;
  const handler = createFantasyTeamHandler({
    requireUser: async () => ({ id: "user-1" }),
    getCurrentTeam: async () => { loads += 1; return {}; },
  });

  const response = await handler(new Request("https://example.test/api/fantasy/team?league=league-1&entry=0"));
  assert.equal(response.status, 400);
  assert.equal(loads, 0);
});

test("Fantasy team API keeps auth, membership, and database errors generic", async () => {
  const unauthenticated = createFantasyTeamHandler({
    requireUser: async () => { throw new Error("not authenticated"); },
    getCurrentTeam: async () => ({}),
  });
  assert.equal((await unauthenticated(new Request("https://example.test/api/fantasy/team?league=league-1&entry=123"))).status, 401);

  const failed = createFantasyTeamHandler({
    requireUser: async () => ({ id: "user-1" }),
    getCurrentTeam: async () => { throw new Error("secret membership detail"); },
  });
  const response = await failed(new Request("https://example.test/api/fantasy/team?league=league-1&entry=123"));
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /secret membership detail/);
});

test("Fantasy team API requires a league and Entry", async () => {
  const handler = createFantasyTeamHandler({ requireUser: async () => ({ id: "user-1" }), getCurrentTeam: async () => ({}) });
  assert.equal((await handler(new Request("https://example.test/api/fantasy/team?entry=123"))).status, 400);
  assert.equal((await handler(new Request("https://example.test/api/fantasy/team?league=league-1"))).status, 400);
});
