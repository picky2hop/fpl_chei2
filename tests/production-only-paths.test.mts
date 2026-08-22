import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("LIFF gate requires the production authentication path", async () => {
  const source = await readFile(new URL("../app/components/liff-gate.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("previewProfile"), false);
  assert.equal(source.includes("NEXT_PUBLIC_DEMO_MODE"), false);
  assert.equal(source.includes("liff.getIDToken()"), true);
});

test("dashboard never falls back to mock fixtures", async () => {
  const source = await readFile(new URL("../app/dashboard/live-dashboard.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("mockFixtures"), false);
  assert.equal(source.includes("NEXT_PUBLIC_DEMO_MODE"), false);
  assert.equal(source.includes("/api/dashboard"), true);
  assert.equal(source.includes("setInterval"), true);
  assert.equal(source.includes("cache: \"no-store\""), true);
});

test("landing copy does not advertise preview mode", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("Preview mode"), false);
});

test("prediction app preserves editable picks and exposes the fantasy switch", async () => {
  const source = await readFile(new URL("../app/components/prediction-app-final.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("getEditablePredictions"), true);
  assert.equal(source.includes("href=\"/fantasy\""), true);
  assert.equal(source.includes("setIsSharePromptOpen(true)"), true);
});
