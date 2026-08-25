import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("player photo renders a football fallback when the URL is missing or fails", async () => {
  const source = await readFile(new URL("../../app/fantasy/player-photo.tsx", import.meta.url), "utf8");

  assert.match(source, /⚽/);
  assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(source, /รูป \$\{playerName\} โหลดไม่ได้/);
});
