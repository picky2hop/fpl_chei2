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
  assert.equal(source.includes("AbortController"), true);
  assert.equal(source.includes("ข้อมูลอาจไม่ใช่ข้อมูลล่าสุด"), true);
  assert.equal(source.includes("setRefreshVersion"), true);
  assert.equal(source.includes("initialPredictionGameweek={props.predictionDefaultGameweek}"), true);
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
  assert.equal(source.includes("Preview / LIFF"), false);
  assert.equal(source.includes("href=\"/\""), true);
  assert.equal(source.includes(">หน้าหลัก</Link>"), true);
  assert.equal(source.includes("ข้อมูลตัวอย่าง Phase 1"), false);
  assert.equal(source.includes("ข้อมูลจาก Production"), true);
  assert.equal(source.includes('String(entry.rank).padStart(2, "0")'), false);
  assert.equal(source.includes("bg-[#d9ff58] text-[#071525]"), true);
});

test("prediction app opens the requested prediction tab from a LIFF deep link", async () => {
  const source = await readFile(new URL("../app/components/prediction-app-final.tsx", import.meta.url), "utf8");

  assert.match(source, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /get\("tab"\)/);
  assert.match(source, /tab === "predictions"/);
});

test("prediction default is isolated from the leaderboard and results selection", async () => {
  const source = await readFile(new URL("../app/components/prediction-app-final.tsx", import.meta.url), "utf8");

  assert.match(source, /initialPredictionGameweek\?: number/);
  assert.match(source, /selectedPredictionGameweek/);
  assert.match(source, /activeTab === "predictions" \? selectedPredictionGameweek : selectedGameweek/);
});

test("detail modal manages focus and body scroll for keyboard users", async () => {
  const source = await readFile(new URL("../app/components/detail-modal.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("document.activeElement"), true);
  assert.equal(source.includes("document.body.style.overflow"), true);
  assert.equal(source.includes('event.key !== "Tab"'), true);
  assert.equal(source.includes("requestAnimationFrame"), true);
  assert.equal(source.includes("useId"), true);
});
