import test from "node:test";
import assert from "node:assert/strict";
import { hasAvatarImage } from "../lib/avatar.ts";

test("treats a non-empty avatar URL as an image", () => {
  assert.equal(hasAvatarImage("https://example.com/avatar.jpg"), true);
});

test("does not render initials when the avatar URL is missing or blank", () => {
  assert.equal(hasAvatarImage(undefined), false);
  assert.equal(hasAvatarImage(""), false);
  assert.equal(hasAvatarImage("   "), false);
});
