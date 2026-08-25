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
  assert.equal(parseLineCommand("แชมป์บ๊วยทายผล"), "predictionAwards");
  assert.equal(parseLineCommand("แชมป์บ๊วยเชย"), "fantasyAwardsChei");
  assert.equal(parseLineCommand("แชมป์บ๊วยเขาค้อ"), "fantasyAwardsKhao");
});

test("maps menu aliases and ignores ordinary text", () => {
  for (const text of ["เมนู", "ช่วย", "คำสั่ง"]) {
    assert.equal(parseLineCommand(text), "menu");
  }
  assert.equal(parseLineCommand("ขอตารางคะแนนของทุกคนหน่อยครับ"), null);
  assert.equal(parseLineCommand(""), null);
  assert.equal(parseLineCommand("   \n  "), null);
});

test("menu Flex exposes the Chei Fantasy award command without exposing Khao as a menu action", () => {
  const message = buildLineMenuMessage();
  assert.equal(message.type, "flex");
  if (message.type !== "flex") return;

  const serialized = JSON.stringify(message);
  const commands = [
    { label: "ขอตาราง", text: "ขอตาราง" },
    { label: "บอลวันนี้", text: "บอลวันนี้" },
    { label: "ผลทายของฉัน", text: "ผลทาย" },
    { label: "แชมป์บ๊วยทายผล", text: "แชมป์บ๊วยทายผล" },
    { label: "แชมป์บ๊วยเชย", text: "แชมป์บ๊วยเชย" },
  ];
  for (const command of commands) {
    assert.match(serialized, new RegExp(`"type":"message","label":"${command.label}","text":"${command.text}"`));
  }
  assert.equal((serialized.match(/"type":"message"/g) ?? []).length, commands.length);
  assert.doesNotMatch(serialized, /"type":"message","label":"เมนู","text":"เมนู"/);
  assert.equal((serialized.match(/"backgroundColor":"#E53935"/g) ?? []).length, commands.length);
  assert.ok((serialized.match(/"color":"#FFFFFF"/g) ?? []).length >= commands.length);
  assert.doesNotMatch(serialized, /SECRET|TOKEN|SUPABASE|session/i);
  assert.doesNotMatch(serialized, /"label":"แชมป์บ๊วยเขาค้อ"/);
});
