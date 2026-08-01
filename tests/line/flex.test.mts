import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPredictionResultFlex,
  buildStandingsFlex,
  buildTodayFixturesFlex,
} from "../../lib/line/flex.ts";

test("prediction Flex payload contains the selected gameweek and picks", () => {
  const message = buildPredictionResultFlex({
    displayName: "Picky",
    avatarUrl: "https://example.test/picky.png",
    gameweek: 1,
    fixtures: [
      {
        homeTeam: { name: "Arsenal", logoUrl: "https://example.test/arsenal.png" },
        awayTeam: { name: "Chelsea", logoUrl: "https://example.test/chelsea.png" },
        choice: "home",
      },
      {
        homeTeam: { name: "Liverpool", logoUrl: "https://example.test/liverpool.png" },
        awayTeam: { name: "Spurs", logoUrl: "https://example.test/spurs.png" },
        choice: "draw",
      },
    ],
  });

  assert.equal(message.type, "flex");
  assert.match(message.altText, /GW1/);
  assert.match(message.altText, /Picky/);

  const serialized = JSON.stringify(message);
  assert.doesNotMatch(serialized, /"justifyContent":"(?:end|start)"/);
  assert.match(serialized, /https:\/\/example\.test\/picky\.png/);
  assert.match(serialized, /https:\/\/example\.test\/arsenal\.png/);
  assert.match(serialized, /https:\/\/example\.test\/chelsea\.png/);
  assert.ok(serialized.indexOf("Arsenal") < serialized.indexOf("arsenal.png"));
  assert.ok(serialized.indexOf("chelsea.png") < serialized.indexOf("Chelsea"));
  assert.match(serialized, /#D9FF58/);
  assert.match(serialized, /https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/);
  assert.match(serialized, /"size":"giga"/);
  assert.match(serialized, /"cornerRadius":"xxl"/);
  assert.doesNotMatch(serialized, /\{"type":"image"[^}]*"cornerRadius":"xxl"/);
  assert.doesNotMatch(serialized, /"0px"/);
  assert.doesNotMatch(serialized, /"paddingAll":"none"/);
  assert.doesNotMatch(serialized, /\.svg/);
  assert.doesNotMatch(serialized, /undefined/);

  const bubble = message.contents as Record<string, unknown>;
  const footer = bubble.footer as Record<string, unknown>;
  const footerContents = footer.contents as Array<Record<string, unknown>>;
  const appButton = footerContents[0];
  const appButtonContents = appButton.contents as Array<Record<string, unknown>>;
  assert.equal(appButton.height, "56px");
  assert.equal(appButton.justifyContent, "center");
  assert.equal(appButton.alignItems, "center");
  assert.equal(appButtonContents[0]?.align, "center");
});

test("standings Flex payload contains rank, player, points, avatar, and app action", () => {
  const message = buildStandingsFlex({
    period: "gameweek",
    gameweek: 1,
    updatedAtLabel: "1 Aug 2026 18:46",
    rows: [
      { rank: 1, displayName: "Picky", avatarUrl: "https://example.test/picky.png", points: 6 },
      { rank: 2, displayName: "Chei", avatarUrl: "", points: 3 },
    ],
  });

  assert.equal(message.type, "flex");
  const serialized = JSON.stringify(message);
  assert.match(serialized, /Picky/);
  assert.match(serialized, /6/);
  assert.match(serialized, /Chei/);
  assert.match(serialized, /https:\/\/example\.test\/picky\.png/);
  assert.match(serialized, /เกมทายผลพรีเมียร์ลีก/);
  assert.match(serialized, /https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/);
  assert.match(serialized, /"text":"เปิดแอป FPL Chei Chei"/);
  assert.match(serialized, /"color":"#071525"/);
  assert.match(serialized, /"cornerRadius":"xxl"/);
  assert.match(serialized, /อัปเดต 1 Aug 2026 18:46/);
});

test("prediction Flex is a single app-style bubble with all picks and choice highlights", () => {
  const fixtures = Array.from({ length: 6 }, (_, index) => ({
    homeTeam: { name: `Home ${index + 1}`, logoUrl: `https://example.test/home-${index + 1}.png` },
    awayTeam: { name: `Away ${index + 1}`, logoUrl: `https://example.test/away-${index + 1}.png` },
    choice: (["home", "draw", "away"] as const)[index % 3],
  }));
  const message = buildPredictionResultFlex({
    displayName: "Picky",
    avatarUrl: "https://example.test/picky.png",
    gameweek: 1,
    fixtures,
  });

  assert.equal(message.contents.type, "bubble");
  const serialized = JSON.stringify(message);
  assert.doesNotMatch(serialized, /PLAYER PICKS/);
  assert.match(serialized, /คำทาย GW1 ของ Picky/);
  assert.match(serialized, /คำทายของ GW 1/);
  for (const index of [1, 2, 3, 4, 5, 6]) {
    assert.match(serialized, new RegExp(`Home ${index}`));
    assert.match(serialized, new RegExp(`Away ${index}`));
  }
  assert.match(serialized, /#ff647c/);
  assert.match(serialized, /#47d7a0/);
  assert.match(serialized, /#6da9ff/);
  assert.match(serialized, /https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/);
});

test("prediction Flex matches the app detail row treatment", () => {
  const message = buildPredictionResultFlex({
    displayName: "Picky",
    avatarUrl: "https://example.test/picky.png",
    gameweek: 1,
    fixtures: [{
      homeTeam: { name: "Arsenal", logoUrl: "https://example.test/arsenal.png" },
      awayTeam: { name: "Chelsea", logoUrl: "https://example.test/chelsea.png" },
      choice: "home",
    }],
  });
  const bubble = message.contents as Record<string, unknown>;
  const body = bubble.body as Record<string, unknown>;
  const bodyContents = body.contents as Array<Record<string, unknown>>;
  const fixtureRow = bodyContents[1];
  const rowContents = fixtureRow.contents as Array<Record<string, unknown>>;
  const homeSide = rowContents[0];
  const vs = rowContents[1];
  const awaySide = rowContents[2];

  assert.doesNotMatch(JSON.stringify(body), /PLAYER PICKS/);
  assert.equal(fixtureRow.layout, "horizontal");
  assert.equal(fixtureRow.backgroundColor, "#071525");
  assert.equal(fixtureRow.cornerRadius, undefined);
  assert.equal(homeSide.justifyContent, "center");
  assert.equal(awaySide.justifyContent, "center");
  assert.equal(homeSide.backgroundColor, "#d9ff5815");
  assert.equal(homeSide.paddingAll, "8px");
  assert.equal(vs.align, "center");
  assert.equal(rowContents.at(-1)?.width, "48px");
  assert.equal(rowContents.at(-1)?.flex, 0);
});

test("standings Flex uses a carousel for a long table without dropping rows", () => {
  const message = buildStandingsFlex({
    period: "gameweek",
    gameweek: 1,
    rows: Array.from({ length: 18 }, (_, index) => ({
      rank: index + 1,
      displayName: `Player ${index + 1}`,
      avatarUrl: "",
      points: index,
    })),
  });

  const serialized = JSON.stringify(message);
  assert.equal(message.contents.type, "carousel");
  for (let index = 1; index <= 18; index += 1) {
    assert.match(serialized, new RegExp(`Player ${index}`));
  }
  assert.ok((serialized.match(/https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/g) ?? []).length >= 2);
});

test("today fixtures Flex shows time and ordered team logos", () => {
  const message = buildTodayFixturesFlex({
    dateLabel: "วันเสาร์ 1 ส.ค.",
    fixtures: [{
      kickoffLabel: "19:30",
      statusLabel: "เริ่มแข่ง",
      homeTeam: { name: "Arsenal", logoUrl: "https://example.test/arsenal.png" },
      awayTeam: { name: "Chelsea", logoUrl: "https://example.test/chelsea.png" },
    }],
  });

  const serialized = JSON.stringify(message);
  assert.match(serialized, /19:30/);
  assert.ok(serialized.indexOf("Arsenal") < serialized.indexOf("arsenal.png"));
  assert.ok(serialized.indexOf("chelsea.png") < serialized.indexOf("Chelsea"));
  assert.match(serialized, /https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/);
});
