import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeSession, encodeSession, type SessionPayload } from "../../lib/auth/session-codec.ts";
import { verifyLiffIdToken } from "../../lib/auth/liff.ts";

const secret = "session-secret-that-is-long-enough-for-hs256";
const payload: SessionPayload = {
  userId: "app-user-1",
  lineUserId: "U1234567890abcdef1234567890abcdef",
};

describe("session codec", () => {
  it("round-trips the minimum session identity payload", async () => {
    const token = await encodeSession(payload, secret, 3600, new Date("2026-08-01T00:00:00.000Z"));
    assert.deepEqual(
      await decodeSession(token, secret),
      payload,
    );
  });

  it("rejects tampered, expired, and wrong-secret sessions", async () => {
    const token = await encodeSession(payload, secret, 1, new Date("2026-08-01T00:00:00.000Z"));
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    assert.equal(await decodeSession(tampered, secret), null);
    assert.equal(await decodeSession(token, "different-secret-that-is-long-enough"), null);
    assert.equal(await decodeSession(token, secret, new Date("2026-08-01T00:00:02.000Z")), null);
  });
});

describe("LINE LIFF verification", () => {
  it("sends the LIFF ID token to LINE and returns only verified profile fields", async () => {
    let request: Request | undefined;
    const profile = await verifyLiffIdToken(
      "signed-liff-id-token",
      async (input, init) => {
        request = new Request(input, init);
        return Response.json({
          iss: "https://access.line.me",
          sub: payload.lineUserId,
          aud: "line-channel-1",
          exp: Math.floor(Date.now() / 1000) + 60,
          name: "เชยเชย",
          picture: "https://example.test/avatar.png",
        });
      },
      "line-channel-1",
    );

    assert.equal(request?.method, "POST");
    assert.equal(request?.headers.get("content-type"), "application/x-www-form-urlencoded");
    assert.match(await request!.text(), /id_token=signed-liff-id-token/);
    assert.deepEqual(profile, {
      lineUserId: payload.lineUserId,
      displayName: "เชยเชย",
      pictureUrl: "https://example.test/avatar.png",
    });
  });

  it("rejects an unverified LINE response", async () => {
    await assert.rejects(
      verifyLiffIdToken(
        "bad-token",
        async () => new Response("invalid", { status: 400 }),
        "line-channel-1",
      ),
      /LINE ID token verification failed/,
    );
  });
});
