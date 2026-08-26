import test from "node:test";
import assert from "node:assert/strict";
import { buildLineMenuMessage, parseLineCommand } from "../../lib/line/commands.ts";
import { validateFlexMessage } from "../../lib/line/flex.ts";

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

test("menu Flex uses two columns, grouped game labels, and the Top/Bottom command", () => {
  const message = buildLineMenuMessage();
  assert.equal(message.type, "flex");
  if (message.type !== "flex") return;

  const serialized = JSON.stringify(message);
  const commands = [
    { label: "ขอตารางทายผล", text: "ขอตาราง" },
    { label: "ผลทายของฉัน", text: "ผลทาย" },
    { label: "บอลวันนี้", text: "บอลวันนี้" },
    { label: "แชมป์บ๊วยทายผล", text: "แชมป์บ๊วยทายผล" },
    { label: "แชมป์บ๊วยเชย", text: "แชมป์บ๊วยเชย" },
    { label: "แชมป์บ๊วยเขาค้อ", text: "แชมป์บ๊วยเขาค้อ" },
    { label: "Top 5 + บ๊วย 5", text: "Top 5 + บ๊วย 5" },
  ];
  for (const command of commands) {
    assert.ok(serialized.includes(`"label":"${command.label}","text":"${command.text}"`));
  }
  assert.equal((serialized.match(/"type":"message"/g) ?? []).length, commands.length);
  assert.doesNotMatch(serialized, /"type":"message","label":"เมนู","text":"เมนู"/);
  assert.equal((serialized.match(/"backgroundColor":"#E53935"/g) ?? []).length, commands.length);
  assert.ok((serialized.match(/"color":"#FFFFFF"/g) ?? []).length >= commands.length);
  assert.doesNotMatch(serialized, /SECRET|TOKEN|SUPABASE|session/i);
  assert.match(serialized, /เกมทายผลพรีเมียร์ลีก/);
  assert.match(serialized, /เกมแฟนตาซี/);
  assert.match(serialized, /"color":"#D9FF58"/);
  assert.equal((serialized.match(/"type":"message"/g) ?? []).length, 7);
  assert.doesNotMatch(serialized, /"label":"เมนู","text":"เมนู"/);
  assert.doesNotThrow(() => validateFlexMessage(message));

  const bubble = message.contents as { body: { contents: Array<{ type?: string; text?: string; layout?: string; contents?: unknown[] }> } };
  const bodyContents = bubble.body.contents;
  assert.equal(bodyContents[1]?.text, "เกมทายผลพรีเมียร์ลีก");
  assert.equal(bodyContents[2]?.layout, "horizontal");
  assert.equal(bodyContents[2]?.contents?.length, 2);
  assert.equal(bodyContents[3]?.layout, "horizontal");
  assert.equal(bodyContents[3]?.contents?.length, 2);
  assert.equal(bodyContents[4]?.text, "เกมแฟนตาซี");
  assert.equal(bodyContents[5]?.layout, "horizontal");
  assert.equal(bodyContents[5]?.contents?.length, 2);
  assert.equal(bodyContents[6]?.layout, "horizontal");
  assert.equal(bodyContents[6]?.contents?.length, 1);
});
