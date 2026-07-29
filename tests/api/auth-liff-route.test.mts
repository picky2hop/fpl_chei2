import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLiffAuthHandler } from "../../lib/auth/liff-handler.ts";

describe("LIFF auth Route Handler", () => {
  it("verifies the token, upserts the user, creates a session, and returns a safe DTO", async () => {
    const calls: string[] = [];
    const handler = createLiffAuthHandler({
      verifyIdToken: async (token) => {
        calls.push(`verify:${token}`);
        return {
          lineUserId: "U1234567890abcdef1234567890abcdef",
          displayName: "เชยเชย",
          pictureUrl: "https://example.test/avatar.png",
        };
      },
      upsertUserAndJoinSeason: async (profile) => {
        calls.push(`upsert:${profile.lineUserId}`);
        return {
          appUserId: "app-user-1",
          displayName: profile.displayName,
          avatarUrl: profile.pictureUrl,
          seasonId: "season-1",
          seasonName: "2026/27",
        };
      },
      createSession: async (session) => {
        calls.push(`session:${session.userId}:${session.lineUserId}`);
      },
    });

    const response = await handler(new Request("https://example.test/api/auth/liff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: "signed-token" }),
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: {
        id: "app-user-1",
        displayName: "เชยเชย",
        avatarUrl: "https://example.test/avatar.png",
      },
      season: { id: "season-1", name: "2026/27" },
    });
    assert.deepEqual(calls, [
      "verify:signed-token",
      "upsert:U1234567890abcdef1234567890abcdef",
      "session:app-user-1:U1234567890abcdef1234567890abcdef",
    ]);
  });

  it("rejects malformed input before calling the verifier", async () => {
    let verified = false;
    const handler = createLiffAuthHandler({
      verifyIdToken: async () => {
        verified = true;
        throw new Error("must not run");
      },
      upsertUserAndJoinSeason: async () => {
        throw new Error("must not run");
      },
      createSession: async () => {
        throw new Error("must not run");
      },
    });

    const response = await handler(new Request("https://example.test/api/auth/liff", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "signed-token",
    }));

    assert.equal(response.status, 400);
    assert.equal(verified, false);
  });
});
