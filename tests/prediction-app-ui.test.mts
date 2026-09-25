import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prediction app exposes icon status for completed friend picks", async () => {
  const source = await readFile(new URL("../app/components/prediction-app-final.tsx", import.meta.url), "utf8");

  assert.match(source, /getPredictionResult/);
  assert.match(source, /PredictionResultIcon/);
  assert.match(source, /<Check/);
  assert.match(source, /<X/);
});
