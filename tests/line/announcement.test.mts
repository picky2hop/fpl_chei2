import assert from "node:assert/strict";
import test from "node:test";
import { buildFantasyAwardsAnnouncement, buildPredictionAwardsAnnouncements } from "../../lib/line/announcement.ts";

const awards = {
  gameweek: 5,
  champions: [{ userId: "u1", lineUserId: "line-1", displayName: "Ar Tao", points: 18 }],
  woodenSpoons: [{ userId: "u2", lineUserId: "line-2", displayName: "สำรอง", points: 3 }],
  nonChampions: [
    { userId: "u2", lineUserId: "line-2", displayName: "สำรอง", points: 3 },
    { userId: "u3", lineUserId: "line-3", displayName: "ผู้เล่นสาม", points: 8 },
  ],
};

test("mentions each non-champion player on its own line", () => {
  const [message] = buildPredictionAwardsAnnouncements({ ...awards, allowMentions: true });

  assert.equal(message.type, "textV2");
  if (message.type !== "textV2") return;
  assert.match(message.text, /🎉 ผลตัดสินเกมทายผลพรีเมียร์ลีก GW 5/);
  assert.match(message.text, /🏆 แชมป์: \{champion_1\}/);
  assert.match(message.text, /👥 ผู้เล่นที่ไม่ใช่แชมป์ จำนวน 2 คน:\n\{non_champion_1\}\n\{non_champion_2\}/);
  assert.doesNotMatch(message.text, /บ๊วย|wooden_spoon/);
  assert.match(message.text, /💸 โอนเงินให้แชมป์คนละ 50 บาทด้วยนะครับ/);
  assert.deepEqual(message.substitution, {
    champion_1: { type: "mention", mentionee: { type: "user", userId: "line-1" } },
    non_champion_1: { type: "mention", mentionee: { type: "user", userId: "line-2" } },
    non_champion_2: { type: "mention", mentionee: { type: "user", userId: "line-3" } },
  });
});

test("falls back to a plain decorated announcement outside group chats", () => {
  const [message] = buildPredictionAwardsAnnouncements({ ...awards, allowMentions: false });

  assert.deepEqual(message, {
    type: "text",
    text: "🎉 ผลตัดสินเกมทายผลพรีเมียร์ลีก GW 5\n🏆 แชมป์: Ar Tao\n👥 ผู้เล่นที่ไม่ใช่แชมป์ จำนวน 2 คน:\nสำรอง\nผู้เล่นสาม\n💸 โอนเงินให้แชมป์คนละ 50 บาทด้วยนะครับ 🙏💰\nยินดีด้วยครับทุกคน 👏🎊",
  });
});

test("splits non-champion mentions across messages when needed", () => {
  const messages = buildPredictionAwardsAnnouncements({
    gameweek: 5,
    champions: [{ userId: "champion", lineUserId: "champion-line", displayName: "Champion", points: 18 }],
    woodenSpoons: [],
    nonChampions: Array.from({ length: 21 }, (_, index) => ({
      userId: `non-champion-${index}`,
      lineUserId: `non-champion-line-${index}`,
      displayName: `ผู้เล่น ${index + 1}`,
      points: 3,
    })),
    allowMentions: true,
  });

  assert.ok(messages.length > 1);
  const textV2Messages = messages.filter((message) => message.type === "textV2");
  assert.equal(textV2Messages.length, messages.length);
  assert.equal(textV2Messages.reduce((total, message) => total + Object.keys(message.substitution).length, 0), 22);
  assert.equal(textV2Messages.reduce((total, message) => total + (message.text.match(/^\{non_champion_\d+\}$/gm) ?? []).length, 0), 21);
  assert.deepEqual(textV2Messages.at(-1)?.substitution.non_champion_21, {
    type: "mention",
    mentionee: { type: "user", userId: "non-champion-line-20" },
  });
});

test("builds a Fantasy award announcement with the league name", () => {
  const message = buildFantasyAwardsAnnouncement({
    leagueName: "เชยเชย Cup",
    gameweek: 1,
    champions: [{ lineUserId: "line-1", displayName: "Champion" }],
    woodenSpoons: [{ lineUserId: "line-2", displayName: "Spoon" }],
    allowMentions: true,
  });

  assert.equal(message.type, "textV2");
  assert.match(JSON.stringify(message), /เชยเชย Cup|Champion|Spoon|champion_1|wooden_spoon_1/);
});
