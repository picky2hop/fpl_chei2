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
  for (const text of ["ผลทาย", "คำทาย", "ทายผล"]) {
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

test("menu Flex exposes three red command actions without configuration values", () => {
  const message = buildLineMenuMessage();
  assert.equal(message.type, "flex");
  if (message.type !== "flex") return;

  const serialized = JSON.stringify(message);
  const commands = ["ขอตาราง", "บอลวันนี้", "ผลทาย"];
  for (const command of commands) {
    assert.match(serialized, new RegExp(`"type":"message","label":"${command}","text":"${command}"`));
  }
  assert.equal((serialized.match(/"type":"message"/g) ?? []).length, commands.length);
  assert.doesNotMatch(serialized, /"type":"message","label":"เมนู","text":"เมนู"/);
  assert.equal((serialized.match(/"backgroundColor":"#E53935"/g) ?? []).length, commands.length);
  assert.ok((serialized.match(/"color":"#FFFFFF"/g) ?? []).length >= commands.length);
  assert.doesNotMatch(serialized, /SECRET|TOKEN|SUPABASE|session/i);
});
