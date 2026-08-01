import test from "node:test";
import assert from "node:assert/strict";
import { buildLineMenuMessage, parseLineCommand } from "../../lib/line/commands.ts";

test("maps approved standings aliases exactly", () => {
  for (const text of ["ขอตาราง", " ตารางคะแนน ", "คะแนน", "อันดับ"]) {
    assert.equal(parseLineCommand(text), "standings");
  }
});

test("maps approved fixture and prediction aliases exactly", () => {
  for (const text of ["บอลวันนี้", "โปรแกรมบอล", "คู่วันนี้"]) {
    assert.equal(parseLineCommand(text), "todayFixtures");
  }
  for (const text of ["ผลทาย", "คำทาย"]) {
    assert.equal(parseLineCommand(text), "myPredictions");
  }
});

test("maps menu aliases and ignores ordinary text", () => {
  for (const text of ["เมนู", "ช่วย", "คำสั่ง"]) {
    assert.equal(parseLineCommand(text), "menu");
  }
  assert.equal(parseLineCommand("ขอตารางคะแนนของทุกคนหน่อยครับ"), null);
  assert.equal(parseLineCommand(""), null);
  assert.equal(parseLineCommand("   \n  "), null);
});

test("menu message lists the supported commands without configuration values", () => {
  const message = buildLineMenuMessage();
  assert.equal(message.type, "text");
  assert.match(message.text, /ขอตาราง/);
  assert.match(message.text, /บอลวันนี้/);
  assert.match(message.text, /ผลทาย/);
  assert.match(message.text, /เมนู/);
  assert.doesNotMatch(message.text, /SECRET|TOKEN|SUPABASE|session/i);
});
