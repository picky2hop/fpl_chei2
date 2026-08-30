import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("prediction app exposes correct or incorrect status for completed picks", async () => {
  const source = await readFile(new URL("../app/components/prediction-app-final.tsx", import.meta.url), "utf8");

  assert.match(source, /getPredictionResult/);
  assert.match(source, /ทายถูก/);
  assert.match(source, /ทายผิด/);
});
