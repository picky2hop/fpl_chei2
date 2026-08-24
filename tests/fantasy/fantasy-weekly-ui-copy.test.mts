import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the approved weekly feature labels without a retry action", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /Player of the Week/);
  assert.match(source, /Team of the Week/);
  assert.doesNotMatch(source, /ลองใหม่|retry/i);
});

test("renders the Player of the Week cards vertically", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /flex-col/);
  assert.match(source, /playerOfWeek/);
});
