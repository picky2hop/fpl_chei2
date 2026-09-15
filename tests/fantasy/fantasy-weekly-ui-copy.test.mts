import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the approved weekly feature labels without a retry action", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /Player of the Week/);
  assert.match(source, /Team of the Week/);
  // Retry is now supported for table loading; weekly feature cards still have no retry action.
  const weeklyCards = source.slice(source.indexOf('function WeeklyFeatureCards'), source.indexOf('function PlayerStats('));
  assert.ok(weeklyCards.length > 0);
  assert.doesNotMatch(weeklyCards, /ลองใหม่|retry/i);
});

test("renders the Player of the Week cards vertically", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /flex-col/);
  assert.match(source, /playerOfWeek/);
});

test("places the Team of the Week action directly after the weekly cards", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /LegacyPlayerStats\(\{ data, onOpenTeamOfWeek \}/);
  assert.match(source, /WeeklyFeatureCards data=\{data\} onOpenTeamOfWeek=\{onOpenTeamOfWeek\}/);
  assert.match(source, /<LegacyPlayerStats data=\{data\} onOpenTeamOfWeek=\{\(\) => void openTeamOfWeek\(\)\} \/>/);
  assert.doesNotMatch(source, /<LegacyPlayerStats data=\{data\} \/><WeeklyFeatureCards/);
});

test("shows total points in both Fantasy team popups", async () => {
  const source = await readFile(new URL("../../app/fantasy/fantasy-app.tsx", import.meta.url), "utf8");
  assert.match(source, /fantasySquadTotalPoints\(response\.squad\)/);
  assert.match(source, /fantasyPlayersTotalPoints\(team\.players\)/);
  assert.ok((source.match(/คะแนนรวม/g) ?? []).length >= 2);
});
