import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

test("Fantasy player statistics are due once per Bangkok clock hour", async () => {
  const source = await readFile(
    new URL("../../scheduler/google-apps-script/Code.gs", import.meta.url),
    "utf8",
  );
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context);
  const scheduler = context as typeof context & {
    getBangkokScheduleDecision: (input: {
      day: number;
      hour: number;
      minute: number;
      dateKey: string;
      lastDaily: string | null;
      lastSchedule: string | null;
      lastLiveSyncAt: string | null;
      lastFantasyPlayerStatsAttemptHour: string | null;
      nowMs: number;
    }) => { fantasyPlayerStatsDue: boolean; updateFantasyPlayerStatsAttempt: boolean };
  };

  const input = {
    day: 3,
    hour: 14,
    minute: 20,
    dateKey: "2026-08-05",
    lastDaily: "2026-08-05",
    lastSchedule: "2026-08-05",
    lastLiveSyncAt: null,
    nowMs: Date.parse("2026-08-05T07:20:00.000Z"),
  };
  assert.equal(scheduler.getBangkokScheduleDecision({ ...input, lastFantasyPlayerStatsAttemptHour: null }).fantasyPlayerStatsDue, true);
  assert.equal(scheduler.getBangkokScheduleDecision({ ...input, lastFantasyPlayerStatsAttemptHour: "2026-08-05T14" }).fantasyPlayerStatsDue, false);
  assert.equal(scheduler.getBangkokScheduleDecision({ ...input, hour: 15, lastFantasyPlayerStatsAttemptHour: "2026-08-05T14" }).updateFantasyPlayerStatsAttempt, true);
});
