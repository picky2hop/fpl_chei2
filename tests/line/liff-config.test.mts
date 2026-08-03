import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("LINE share buttons use the current Production LIFF application", async () => {
  const source = await readFile(new URL("../../lib/line/flex.ts", import.meta.url), "utf8");

  assert.equal(source.includes("https://liff.line.me/2010604800-Y9eFejTF"), true);
  assert.equal(source.includes("2010404316-S8xX5pVG"), false);
});
