import test from "node:test";
import assert from "node:assert/strict";
import { createAdminParticipantHandler } from "../../lib/api/admin-participant-handler.ts";

test("admin participant API excludes a user for one gameweek", async () => {
  let input: unknown;
  const handler = createAdminParticipantHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    setParticipantStatus: async (value) => { input = value; },
  });
  const response = await handler(new Request("https://example.test/api/admin/participants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "user-1", gameweekId: "gw-1", status: "excluded" }),
  }));
  assert.equal(response.status, 204);
  assert.deepEqual(input, { userId: "user-1", gameweekId: "gw-1", status: "excluded" });
});

test("admin participant API rejects non-admin access", async () => {
  const handler = createAdminParticipantHandler({
    requireAdmin: async () => { throw new Error("forbidden"); },
    setParticipantStatus: async () => { throw new Error("must not run"); },
  });
  const response = await handler(new Request("https://example.test/api/admin/participants", { method: "POST" }));
  assert.equal(response.status, 403);
});

test("admin participant API returns users and gameweeks for the management form", async () => {
  const handler = createAdminParticipantHandler({
    requireAdmin: async () => ({ id: "admin-1" }),
    setParticipantStatus: async () => {},
    listOptions: async () => ({
      users: [{ id: "user-1", displayName: "Chei", status: "active" }],
      gameweeks: [{ id: "gw-1", label: "Gameweek 1" }],
    }),
  });
  const response = await handler(new Request("https://example.test/api/admin/participants"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    users: [{ id: "user-1", displayName: "Chei", status: "active" }],
    gameweeks: [{ id: "gw-1", label: "Gameweek 1" }],
  });
});
