import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Fantasy dashboard requests fresh dashboard data after a sync", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");

  assert.match(source, /fetch\(`\/api\/fantasy\?\$\{query\}`, \{ cache: "no-store" \}\)/);
});
