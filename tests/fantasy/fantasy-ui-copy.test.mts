import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("leaderboard labels the team in the share-button lemon color", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");

  assert.match(source, /text-\[#d9ff58\][^>]*>ทีม : \{entry\.teamName\}/);
  assert.doesNotMatch(source, /text-\[#7cff8a\][^>]*>ชื่อทีม : \{entry\.teamName\}/);
});

test("leaderboard exposes the Top 5 and Bottom 5 share action", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /Top 5/);
  assert.match(source, /Bottom 5/);
  assert.match(source, /shareFantasyLeaderboardTopBottom/);
});

test("leaderboard warns that displayed scores exclude bench boost and triple captain", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");

  assert.match(source, /text-\[#d9ff58\][^>]*>คะแนนที่เห็น คือ ไม่รวม Bench boost และ Triple Captain/);
});

test("player stats exposes the original four and five new category labels", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");

  for (const label of [
    "เลือกติดทีมมากสุด",
    "ฟอร์มสูงสุด",
    "ย้ายเข้ามากสุด",
    "ย้ายออกมากสุด",
    "ค่าการป้องกัน(DC)",
    "% การได้โบนัส",
    "แต้มเฉลี่ยทั้งฤดูกาล",
    "โอกาส ยิง + แอสซิส",
    "คะแนน GW ล่าสุด",
  ]) assert.match(source, new RegExp(label.replace(/[()+%]/g, "\\$&")));
});
