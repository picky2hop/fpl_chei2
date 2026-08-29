import assert from "node:assert/strict";
import test from "node:test";
import { runFantasyScoreRecalculation } from "../../lib/fantasy/score-recalculation-service.ts";
import type { FantasyFplProvider, FantasySquadPlayer } from "../../lib/fantasy/types.ts";
import type { FantasyLeagueRepository } from "../../lib/fantasy/repository.ts";

function squad(entryId: number, gameweekNumber: number) {
  const players: FantasySquadPlayer[] = Array.from({ length: 15 }, (_, index) => ({
    pickPosition: index + 1,
    playerId: entryId * 100 + index + 1,
    playerName: `Player ${entryId}-${index + 1}`,
    position: index === 0 ? "GK" : index < 6 ? "DEF" : index < 10 ? "MID" : "FWD",
    clubName: "Club",
    multiplier: index === 0 ? 2 : 1,
    isCaptain: index === 0,
    isViceCaptain: index === 1,
    points: entryId,
  }));
  return { gameweekNumber, formation: "1-5-4-3", captainPlayerId: players[0].playerId, viceCaptainPlayerId: players[1].playerId, starters: players.slice(0, 11), bench: players.slice(11) };
}

function dependencies() {
  const saved: Array<{ entryId: number; gameweekId: string; points: number }> = [];
  let recalculationInput: unknown;
  const provider: FantasyFplProvider = {
    getBootstrap: async () => ({ currentGameweek: 2, latestFinishedGameweek: 2, gameweeks: [], players: [], mostCaptainedPlayerId: null, mostViceCaptainedPlayerId: null }),
    getEntryHistory: async () => [
      { event: 1, points: 999, event_transfers: 1, event_transfers_cost: 2, points_on_bench: 3 },
      { event: 2, points: 999, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 4 },
    ],
    getEntryPicks: async (entryId, gameweekNumber) => {
      if (entryId === 20 && gameweekNumber === 1) throw new Error("picks unavailable");
      return squad(entryId, gameweekNumber);
    },
    getEntrySummary: async (entryId) => ({ entryId, teamName: `Team ${entryId}`, managerName: `Manager ${entryId}` }),
    getEventLive: async () => [],
    getDreamTeam: async () => ({ topPlayerId: null, topPoints: null, players: [] }),
    getLeague: async (leagueId) => ({ leagueId, officialName: `League ${leagueId}` }),
    getLeagueMembers: async () => [],
  };
  const repository: Pick<FantasyLeagueRepository, "listActiveLeagues" | "listLeagueEntryIds" | "listEntryGameweekScores" | "applyScoreRecalculation"> = {
    listActiveLeagues: async () => [{ id: "league-1", season_id: "season-1", fpl_league_id: 819498, official_name: "Cup", status: "active", archived_at: null }],
    listLeagueEntryIds: async () => [10, 20],
    listEntryGameweekScores: async () => [
      { fpl_entry_id: 10, gameweek_id: "gw-1", calculation_method: "legacy_fpl_history" },
      { fpl_entry_id: 10, gameweek_id: "gw-2", calculation_method: "starting_xi_captain_v1" },
      { fpl_entry_id: 20, gameweek_id: "gw-1", calculation_method: "legacy_fpl_history" },
    ],
    applyScoreRecalculation: async (input) => {
      recalculationInput = input;
      saved.push(...input.scores.map((score) => ({ entryId: score.fpl_entry_id, gameweekId: score.gameweek_id, points: score.points })));
      return { jobRunId: input.jobRunId, scoresUpserted: input.scores.length };
    },
  };
  return {
    saved,
    getRecalculationInput: () => recalculationInput,
    dependencies: {
      now: () => new Date("2026-08-25T00:00:00.000Z"),
      seasonId: "season-1",
      gameweeks: [{ id: "gw-1", number: 1 }, { id: "gw-2", number: 2 }],
      provider,
      repository,
      createJob: async () => ({ id: "job-1" }),
      finishJob: async () => undefined,
    },
  };
}

test("recalculates legacy and missing scores, skips formula rows, and keeps failed old rows untouched", async () => {
  const base = dependencies();

  const result = await runFantasyScoreRecalculation(base.dependencies);

  assert.equal(result.stale, false);
  assert.deepEqual(base.saved, [
    { entryId: 10, gameweekId: "gw-1", points: 120 },
    { entryId: 20, gameweekId: "gw-2", points: 240 },
  ]);
  assert.deepEqual(result.failedScoreTargets, [{ entryId: 20, gameweek: 1, reason: "ไม่สามารถอ่าน Picks ของ Entry/GW นี้ได้" }]);
  assert.equal(base.saved.some((row) => row.points === 0), false);
  assert.match(result.message ?? "", /ล้มเหลว 1 รายการ/);
});

test("backfills historical league memberships for every current league Entry", async () => {
  const base = dependencies();

  await runFantasyScoreRecalculation(base.dependencies);

  const input = base.getRecalculationInput() as { memberships: Array<{ league_id: string; gameweek_id: string; fpl_entry_id: number; fpl_team_name: string; fpl_manager_name: string }> };
  assert.deepEqual(input.memberships.map((membership) => [membership.league_id, membership.gameweek_id, membership.fpl_entry_id]), [
    ["league-1", "gw-1", 10],
    ["league-1", "gw-2", 10],
    ["league-1", "gw-1", 20],
    ["league-1", "gw-2", 20],
  ]);
});
