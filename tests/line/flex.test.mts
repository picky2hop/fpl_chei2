import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFixturePredictionFlex,
  buildPredictionResultFlex,
  buildStandingsFlex,
  buildTodayFixturesFlex,
  validateFlexMessage,
} from "../../lib/line/flex.ts";

function textComponentsWithWidth(value: unknown, result: Array<Record<string, unknown>> = []) {
  if (Array.isArray(value)) {
    for (const item of value) textComponentsWithWidth(item, result);
    return result;
  }
  if (!value || typeof value !== "object") return result;
  const component = value as Record<string, unknown>;
  if (component.type === "text" && "width" in component) result.push(component);
  for (const child of Object.values(component)) textComponentsWithWidth(child, result);
  return result;
}

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
  const dateGroup = bodyContents[1];
  const fixtureRow = (dateGroup.contents as Array<Record<string, unknown>>)[2];
  const rowContents = fixtureRow.contents as Array<Record<string, unknown>>;
  const homeSide = rowContents[0];
  const vs = rowContents[1];
  const vsText = (vs.contents as Array<Record<string, unknown>>)[0];
  const awaySide = rowContents[2];
  const homeLogo = (homeSide.contents as Array<Record<string, unknown>>)[1];
  const awayLogo = (awaySide.contents as Array<Record<string, unknown>>)[0];

  assert.doesNotMatch(JSON.stringify(body), /PLAYER PICKS/);
  assert.equal(fixtureRow.layout, "horizontal");
  assert.equal(fixtureRow.backgroundColor, "#071525");
  assert.equal(fixtureRow.cornerRadius, undefined);
  assert.equal(homeSide.justifyContent, "center");
  assert.equal(awaySide.justifyContent, "center");
  assert.equal(homeSide.backgroundColor, "#d9ff5815");
  assert.equal(homeSide.paddingAll, "8px");
  assert.equal(homeLogo.type, "image");
  assert.equal(homeLogo.aspectMode, "fit");
  assert.equal(homeLogo.size, "36px");
  assert.equal(awayLogo.type, "image");
  assert.equal(awayLogo.aspectMode, "fit");
  assert.equal(awayLogo.size, "36px");
  assert.doesNotMatch(JSON.stringify(message), /"aspectMode":"contain"/);
  assert.equal(vs.layout, "vertical");
  assert.equal(vs.width, "24px");
  assert.equal(vs.flex, 0);
  assert.equal(vs.justifyContent, "center");
  assert.equal(vs.alignItems, "center");
  assert.equal(vsText.align, "center");
  assert.equal(rowContents.at(-1)?.width, "48px");
  assert.equal(rowContents.at(-1)?.flex, 0);
});

test("prediction Flex groups fixtures under Thai weekday/date headings", () => {
  const fixtures = Array.from({ length: 10 }, (_, index) => ({
    homeTeam: { name: `Home ${index + 1}` },
    awayTeam: { name: `Away ${index + 1}` },
    kickoffAt: index < 5 ? "2026-08-01T12:00:00.000Z" : "2026-08-02T12:00:00.000Z",
    choice: "home" as const,
  }));
  const message = buildPredictionResultFlex({ displayName: "Picky", gameweek: 1, fixtures });
  const bubble = message.contents as Record<string, unknown>;
  const body = bubble.body as Record<string, unknown>;
  const bodyContents = body.contents as Array<Record<string, unknown>>;
  const groups = bodyContents.slice(1);

  assert.equal(groups.length, 2);
  assert.match(JSON.stringify(message), /วันเสาร์ที่ 1 สิงหาคม 2569 — 5 คู่/);
  assert.match(JSON.stringify(message), /วันอาทิตย์ที่ 2 สิงหาคม 2569 — 5 คู่/);
  assert.equal((groups[0]?.contents as Array<Record<string, unknown>>).length, 7);
  assert.equal((groups[1]?.contents as Array<Record<string, unknown>>).length, 7);
});

test("prediction Flex groups fixtures by Bangkok date and kickoff time", () => {
  const fixtures = [
    { homeTeam: { name: "Home 1" }, awayTeam: { name: "Away 1" }, kickoffAt: "2026-08-01T12:00:00.000Z", choice: "home" as const },
    { homeTeam: { name: "Home 2" }, awayTeam: { name: "Away 2" }, kickoffAt: "2026-08-01T12:00:00.000Z", choice: "draw" as const },
    { homeTeam: { name: "Home 3" }, awayTeam: { name: "Away 3" }, kickoffAt: "2026-08-01T13:30:00.000Z", choice: "away" as const },
    { homeTeam: { name: "Home 4" }, awayTeam: { name: "Away 4" }, kickoffAt: "2026-08-02T12:00:00.000Z", choice: "home" as const },
  ];
  const message = buildPredictionResultFlex({ displayName: "Picky", gameweek: 1, fixtures });
  const body = (message.contents as Record<string, unknown>).body as Record<string, unknown>;
  const dateGroups = (body.contents as Array<Record<string, unknown>>).slice(1);
  const firstDateContents = dateGroups[0]?.contents as Array<Record<string, unknown>>;
  const secondDateContents = dateGroups[1]?.contents as Array<Record<string, unknown>>;

  assert.equal(dateGroups.length, 2);
  assert.equal(firstDateContents[1]?.text, "19:00 · 2 คู่");
  assert.equal(firstDateContents[4]?.text, "20:30 · 1 คู่");
  assert.equal(secondDateContents[1]?.text, "19:00 · 1 คู่");
  assert.equal(firstDateContents.filter((item) => item.type === "text").length, 3);
});

test("prediction Flex keeps width properties on Box components only", () => {
  const message = buildPredictionResultFlex({
    displayName: "Picky",
    gameweek: 1,
    fixtures: [{
      homeTeam: { name: "Arsenal" },
      awayTeam: { name: "Chelsea" },
      choice: "home",
    }],
  });

  assert.deepEqual(textComponentsWithWidth(message), []);
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

test("fixture prediction Flex mirrors the app detail and groups predictors", () => {
  const message = buildFixturePredictionFlex({
    gameweek: 1,
    dateLabel: "เสาร์ 22 ส.ค.",
    kickoffAt: "2026-08-22T19:00:00.000Z",
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    homeTeam: { name: "Arsenal", logoUrl: "https://resources.premierleague.com/premierleague25/badges-alt/3.svg" },
    awayTeam: { name: "Coventry City", logoUrl: "https://resources.premierleague.com/premierleague25/badges-alt/8.svg" },
    predictionPercentages: { home: 100, draw: 0, away: 0 },
    predictors: [
      { name: "Picky", avatarUrl: "https://example.test/picky.png", choice: "home" },
      { name: "Ar Tao", avatarUrl: "https://example.test/tao.png", choice: "home" },
    ],
  });

  assert.equal(message.type, "flex");
  assert.equal(message.contents.type, "bubble");
  const serialized = JSON.stringify(message);
  assert.match(serialized, /Arsenal/);
  assert.match(serialized, /Coventry City/);
  assert.match(serialized, /2 - 1/);
  assert.match(serialized, /100/);
  assert.match(serialized, /Picky/);
  assert.match(serialized, /https:\/\/example\.test\/picky\.png/);
  assert.match(serialized, /https:\/\/liff\.line\.me\/2010604800-Y9eFejTF/);
  assert.match(serialized, /#ff647c/);
  assert.match(serialized, /#47d7a0/);
  assert.match(serialized, /#6da9ff/);
  assert.doesNotMatch(serialized, /\.svg/);
});

test("fixture prediction Flex uses Bangkok time and empty states", () => {
  const message = buildFixturePredictionFlex({
    gameweek: 1,
    dateLabel: "fallback date",
    kickoffAt: "2026-08-22T19:00:00.000Z",
    status: "upcoming",
    homeTeam: { name: "Arsenal" },
    awayTeam: { name: "Chelsea" },
    predictionPercentages: { home: 50, draw: 0, away: 0 },
    predictors: [{ name: "Picky", choice: "home" }],
  });

  const serialized = JSON.stringify(message);
  assert.match(serialized, /VS/);
  assert.match(serialized, /02:00/);
  assert.match(serialized, /50/);
  assert.match(serialized, /0/);
  assert.match(serialized, /ยังไม่มีคนเลือกฝั่งนี้/);
});

test("fixture prediction Flex keeps long predictor lists within Flex child limits", () => {
  const message = buildFixturePredictionFlex({
    gameweek: 1,
    dateLabel: "fallback date",
    status: "upcoming",
    homeTeam: { name: "Arsenal" },
    awayTeam: { name: "Chelsea" },
    predictionPercentages: { home: 100, draw: 0, away: 0 },
    predictors: Array.from({ length: 13 }, (_, index) => ({
      name: "Player " + (index + 1),
      choice: "home" as const,
    })),
  });

  const serialized = JSON.stringify(message);
  for (let index = 1; index <= 13; index += 1) {
    assert.match(serialized, new RegExp("Player " + index));
  }
  assert.doesNotThrow(() => validateFlexMessage(message));
});

test("fixture prediction Flex renders percentage bars with bounded widths", () => {
  const message = buildFixturePredictionFlex({
    gameweek: 5,
    dateLabel: "เสาร์ 22 ส.ค.",
    status: "finished",
    homeTeam: { name: "Arsenal" },
    awayTeam: { name: "Chelsea" },
    predictionPercentages: { home: 0, draw: 25, away: 75 },
    predictors: [],
  });

  const serialized = JSON.stringify(message);
  assert.match(serialized, /"width":"0%"/);
  assert.match(serialized, /"width":"25%"/);
  assert.match(serialized, /"width":"75%"/);
  assert.match(serialized, /"text":"25%"/);
  assert.match(serialized, /"text":"75%"/);
  assert.doesNotThrow(() => validateFlexMessage(message));
});

test("fixture prediction Flex clamps invalid percentage bar widths", () => {
  const message = buildFixturePredictionFlex({
    gameweek: 5,
    dateLabel: "เสาร์ 22 ส.ค.",
    status: "upcoming",
    homeTeam: { name: "Arsenal" },
    awayTeam: { name: "Chelsea" },
    predictionPercentages: { home: -10, draw: 140, away: 50 },
    predictors: [],
  });

  const serialized = JSON.stringify(message);
  assert.match(serialized, /"width":"0%"/);
  assert.match(serialized, /"width":"100%"/);
  assert.match(serialized, /"width":"50%"/);
  assert.doesNotThrow(() => validateFlexMessage(message));
});
