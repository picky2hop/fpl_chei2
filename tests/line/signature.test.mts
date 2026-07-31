import test from "node:test";
import assert from "node:assert/strict";
import { computeLineSignature, verifyLineSignature } from "../../lib/line/signature.ts";

test("computes the LINE HMAC-SHA256 signature as base64", () => {
  assert.equal(
    computeLineSignature("hello", "channel-secret"),
    "Shi6QMkHaorMtX1qnB247qQzuUGhVNyWmLzuIOnM7eE=",
  );
});

test("rejects missing, changed, or malformed webhook signatures", () => {
  const body = '{"destination":"test","events":[]}';
  const secret = "channel-secret";
  const valid = computeLineSignature(body, secret);

  assert.equal(verifyLineSignature(body, valid, secret), true);
  assert.equal(verifyLineSignature(body + " ", valid, secret), false);
  assert.equal(verifyLineSignature(body, undefined, secret), false);
  assert.equal(verifyLineSignature(body, "not-base64", secret), false);
});
