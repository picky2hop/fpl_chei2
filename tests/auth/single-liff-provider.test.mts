import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("the shared app layout owns the single LIFF provider", async () => {
  const layout = await source("app/layout.tsx");
  const gate = await source("app/components/liff-gate.tsx");
  const landing = await source("app/page.tsx");
  const dashboard = await source("app/dashboard/page.tsx");

  assert.match(layout, /LiffProvider/);
  assert.match(layout, /<LiffProvider>\{children\}<\/LiffProvider>/);
  assert.match(gate, /createContext/);
  assert.match(gate, /liffInitializationPromise/);
  assert.match(gate, /liff\.init\(\{ liffId \}\)/);
  assert.doesNotMatch(landing, /LiffGate/);
  assert.doesNotMatch(dashboard, /LiffGate/);
});

test("the shared provider leaves the independent admin route outside LIFF flow", async () => {
  const gate = await source("app/components/liff-gate.tsx");
  assert.match(gate, /usePathname/);
  assert.match(gate, /\/admin/);
});
