import assert from "node:assert/strict";
import test from "node:test";
import { createFantasyLeaguesHandler } from "../../lib/api/fantasy-leagues-handler.ts";

test("Fantasy leagues endpoint returns active and archived league choices after auth", async () => {
  const handler = createFantasyLeaguesHandler({
    requireUser: async () => ({ id: "user-1" }),
    getLeagues: async () => ({ leagues: [{ id: "l1", official_name: "Cup", status: "active" }, { id: "l2", official_name: "Old", status: "archived" }] }),
  });
  const response = await handler(new Request("https://example.test/api/fantasy/leagues"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).leagues.length, 2);
});

test("Fantasy leagues endpoint keeps authentication errors generic", async () => {
  const handler = createFantasyLeaguesHandler({ requireUser: async () => { throw new Error("secret"); }, getLeagues: async () => ({ leagues: [] }) });
  assert.equal((await handler(new Request("https://example.test/api/fantasy/leagues"))).status, 401);
});
