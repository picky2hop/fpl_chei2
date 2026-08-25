import assert from "node:assert/strict";
import test from "node:test";
import { buildPredictionAwardsAnnouncement } from "../../lib/line/announcement.ts";

const awards = {
  gameweek: 5,
  champions: [{ userId: "u1", lineUserId: "line-1", displayName: "Ar Tao", points: 18 }],
  woodenSpoons: [{ userId: "u2", lineUserId: "line-2", displayName: "สำรอง", points: 3 }],
};

test("builds a celebratory group announcement with LINE mentions", () => {
  const message = buildPredictionAwardsAnnouncement({ ...awards, allowMentions: true });

  assert.equal(message.type, "textV2");
  if (message.type !== "textV2") return;
  assert.match(message.text, /🎉 ผลตัดสินเกมทายผลพรีเมียร์ลีก GW 5/);
  assert.match(message.text, /🏆 แชมป์: \{champion_1\}/);
  assert.match(message.text, /🥄 บ๊วย: \{wooden_spoon_1\}/);
  assert.deepEqual(message.substitution, {
    champion_1: { type: "mention", mentionee: { type: "user", userId: "line-1" } },
    wooden_spoon_1: { type: "mention", mentionee: { type: "user", userId: "line-2" } },
  });
});

test("falls back to a plain decorated announcement outside group chats", () => {
  const message = buildPredictionAwardsAnnouncement({ ...awards, allowMentions: false });

  assert.deepEqual(message, {
    type: "text",
    text: "🎉 ผลตัดสินเกมทายผลพรีเมียร์ลีก GW 5\n🏆 แชมป์: Ar Tao\n🥄 บ๊วย: สำรอง\nยินดีด้วยครับทุกคน 👏🎊",
  });
});

test("caps LINE mentions at twenty and keeps extra tied names visible", () => {
  const message = buildPredictionAwardsAnnouncement({
    gameweek: 5,
    champions: Array.from({ length: 21 }, (_, index) => ({
      userId: `u-${index}`,
      lineUserId: `line-${index}`,
      displayName: `Champion ${index + 1}`,
      points: 18,
    })),
    woodenSpoons: [],
    allowMentions: true,
  });

  assert.equal(message.type, "textV2");
  if (message.type !== "textV2") return;
  assert.equal(Object.keys(message.substitution).length, 20);
  assert.match(message.text, /Champion 21/);
});
