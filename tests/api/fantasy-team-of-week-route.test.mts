import assert from "node:assert/strict";
import test from "node:test";
import { createFantasyTeamOfWeekHandler } from "../../lib/api/fantasy-team-of-week-handler.ts";

test("Fantasy Team of the Week API loads an official weekly team", async () => {
  let requestedUserId = "";
  const handler = createFantasyTeamOfWeekHandler({
    requireUser: async () => ({ id: "user-1" }),
    getTeamOfWeek: async (input) => {
      requestedUserId = input.userId;
      return { state: "ready", value: { gameweek: 3, source: "FPL Official", players: [] } };
    },
  });

  const response = await handler(new Request("https://example.test/api/fantasy/team-of-week"));
  assert.equal(response.status, 200);
  assert.equal(requestedUserId, "user-1");
  assert.deepEqual(await response.json(), { state: "ready", value: { gameweek: 3, source: "FPL Official", players: [] } });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("Fantasy Team of the Week API keeps authentication and upstream errors generic", async () => {
  const unauthenticated = createFantasyTeamOfWeekHandler({
    requireUser: async () => { throw new Error("not authenticated"); },
    getTeamOfWeek: async () => ({}),
  });
  assert.equal((await unauthenticated(new Request("https://example.test/api/fantasy/team-of-week"))).status, 401);

  const failed = createFantasyTeamOfWeekHandler({
    requireUser: async () => ({ id: "user-1" }),
    getTeamOfWeek: async () => { throw new Error("secret FPL response body"); },
  });
  const response = await failed(new Request("https://example.test/api/fantasy/team-of-week"));
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /secret FPL response body/);
});
