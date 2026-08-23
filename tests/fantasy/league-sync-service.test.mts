import assert from "node:assert/strict";
import test from "node:test";
import { FantasyFplError } from "../../lib/fantasy/fpl-client.ts";
import { runFantasyLeagueSync, type FantasyLeagueSyncDependencies } from "../../lib/fantasy/league-sync-service.ts";
import type { FantasyLeagueRepository } from "../../lib/fantasy/repository.ts";
import type { FantasyFplProvider } from "../../lib/fantasy/types.ts";

function dependencies(overrides: Partial<FantasyLeagueSyncDependencies> = {}) {
  const calls = {
    league: [] as number[],
    members: [] as number[],
    history: [] as number[],
    apply: 0,
    finish: [] as string[],
  };
  const provider: FantasyFplProvider = {
    getEntrySummary: async (entryId) => ({ entryId, teamName: `Team ${entryId}`, managerName: `Manager ${entryId}` }),
    getEntryHistory: async (entryId) => {
      calls.history.push(entryId);
      return [{ event: 1, points: entryId, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0 }];
    },
    getBootstrap: async () => ({
      currentGameweek: 2,
      latestFinishedGameweek: 2,
      players: [{ playerId: 1, name: "Player", position: "MID", clubId: 1, clubName: "Club", status: "a", selectedByPercent: 10, transfersInEvent: 20, transfersOutEvent: 2, form: 6 }],
      mostCaptainedPlayerId: 1,
      mostViceCaptainedPlayerId: null,
    }),
    getLeague: async (leagueId) => {
      calls.league.push(leagueId);
      return { leagueId, officialName: leagueId === 819498 ? "Official Cup" : "Official Love" };
    },
    getLeagueMembers: async (leagueId) => {
      calls.members.push(leagueId);
      return leagueId === 819498
        ? [
          { entryId: 10, teamName: "Shared", managerName: "One", rank: 1 },
          { entryId: 20, teamName: "Cup Team", managerName: "Two", rank: 2 },
        ]
        : [
          { entryId: 10, teamName: "Shared", managerName: "One", rank: 1 },
          { entryId: 30, teamName: "Love Team", managerName: "Three", rank: 2 },
        ];
    },
  };
  const repository: Pick<FantasyLeagueRepository, "listActiveLeagues" | "applyLeagueSync"> = {
    listActiveLeagues: async () => [
      { id: "league-1", season_id: "season-1", fpl_league_id: 819498, official_name: "Old Cup", status: "active", archived_at: null },
      { id: "league-2", season_id: "season-1", fpl_league_id: 819502, official_name: "Old Love", status: "active", archived_at: null },
    ],
    applyLeagueSync: async (input) => {
      calls.apply += 1;
      assert.deepEqual(input.leagues.map((league) => league.official_name), ["Official Cup", "Official Love"]);
      assert.equal(input.memberships.length, 4);
      assert.deepEqual(input.scores.map((score) => score.fpl_entry_id), [10, 20, 30]);
      assert.equal(input.players.length, 1);
      return { jobRunId: input.jobRunId, leaguesUpserted: 2, membershipsUpserted: 4, scoresUpserted: 3, playersUpserted: 1 };
    },
  };
  const base: FantasyLeagueSyncDependencies = {
    now: () => new Date("2026-08-21T00:00:00.000Z"),
    seasonId: "season-1",
    gameweeks: [{ id: "gw-1", number: 1 }, { id: "gw-2", number: 2 }],
    provider,
    repository,
    createJob: async () => ({ id: "job-1" }),
    finishJob: async (input) => { calls.finish.push(input.status); },
    ...overrides,
  };
  return { dependencies: base, calls };
}

test("syncs all active leagues, deduplicates shared Entries, and fetches each history once", async () => {
  const { dependencies: deps, calls } = dependencies();
  const result = await runFantasyLeagueSync(deps);

  assert.deepEqual(calls.league, [819498, 819502]);
  assert.deepEqual(calls.members, [819498, 819502]);
  assert.deepEqual(calls.history.sort((a, b) => a - b), [10, 20, 30]);
  assert.equal(calls.apply, 1);
  assert.deepEqual(calls.finish, ["succeeded"]);
  assert.equal(result.currentGameweek, 2);
  assert.equal(result.stale, false);
  assert.equal(result.membershipsUpserted, 4);
  assert.match(result.message ?? "", /ลีก 2/);
  assert.match(result.message ?? "", /สมาชิก 4/);
  assert.match(result.message ?? "", /คะแนน 3/);
  assert.match(result.message ?? "", /นักเตะ 1/);
});

test("uses live league standings points for the current gameweek", async () => {
  const base = dependencies();
  const scores: Array<{ gameweek_id: string; fpl_entry_id: number; points: number; event_transfers: number; event_transfers_cost: number }> = [];
  const originalMembers = base.dependencies.provider.getLeagueMembers;
  base.dependencies.provider = {
    ...base.dependencies.provider,
    getLeagueMembers: async (leagueId) => (await originalMembers(leagueId)).map((member) => ({
      ...member,
      eventTotal: member.entryId === 10 ? 18 : member.entryId === 20 ? 22 : 27,
      eventTransfers: member.entryId === 10 ? 2 : 1,
      eventTransfersCost: member.entryId === 20 ? 4 : 0,
    })),
  };
  base.dependencies.repository = {
    ...base.dependencies.repository,
    applyLeagueSync: async (input) => {
      scores.push(...input.scores.map((score) => ({
        gameweek_id: score.gameweek_id,
        fpl_entry_id: score.fpl_entry_id,
        points: score.points,
        event_transfers: score.event_transfers,
        event_transfers_cost: score.event_transfers_cost,
      })));
      return { jobRunId: input.jobRunId, leaguesUpserted: 2, membershipsUpserted: 4, scoresUpserted: input.scores.length, playersUpserted: 1 };
    },
  };

  await runFantasyLeagueSync(base.dependencies);

  assert.deepEqual(scores.filter((score) => score.gameweek_id === "gw-2"), [
    { gameweek_id: "gw-2", fpl_entry_id: 10, points: 18, event_transfers: 2, event_transfers_cost: 0 },
    { gameweek_id: "gw-2", fpl_entry_id: 20, points: 22, event_transfers: 1, event_transfers_cost: 4 },
    { gameweek_id: "gw-2", fpl_entry_id: 30, points: 27, event_transfers: 1, event_transfers_cost: 0 },
  ]);
});

test("does not apply a partial snapshot when a league request fails", async () => {
  const base = dependencies();
  const originalMembers = base.dependencies.provider.getLeagueMembers;
  base.dependencies.provider = {
    ...base.dependencies.provider,
    getLeagueMembers: async (leagueId) => {
      if (leagueId === 819502) throw new Error("upstream failure");
      return originalMembers(leagueId);
    },
  };

  const result = await runFantasyLeagueSync(base.dependencies);

  assert.equal(base.calls.apply, 0);
  assert.deepEqual(base.calls.finish, ["failed"]);
  assert.equal(result.stale, true);
  assert.equal(result.membershipsUpserted, 0);
});

test("reports a safe league-stage reason when FPL league data fails", async () => {
  const base = dependencies();
  const originalMembers = base.dependencies.provider.getLeagueMembers;
  base.dependencies.provider = {
    ...base.dependencies.provider,
    getLeagueMembers: async (leagueId) => {
      if (leagueId === 819502) throw new FantasyFplError("FANTASY_FPL_HTTP_502", "raw provider response");
      return originalMembers(leagueId);
    },
  };

  const result = await runFantasyLeagueSync(base.dependencies);

  assert.equal(result.message, "โหลดข้อมูลลีกหรือสมาชิกจาก FPL ไม่สำเร็จ: FPL API ไม่พร้อมให้บริการ");
  assert.doesNotMatch(result.message ?? "", /raw provider response/);
});

test("does not apply a partial snapshot when an Entry history request fails", async () => {
  const base = dependencies();
  base.dependencies.provider = {
    ...base.dependencies.provider,
    getEntryHistory: async (entryId) => {
      if (entryId === 20) throw new Error("history failure");
      return [{ event: 1, points: entryId, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0 }];
    },
  };

  const result = await runFantasyLeagueSync(base.dependencies);

  assert.equal(base.calls.apply, 0);
  assert.deepEqual(base.calls.finish, ["failed"]);
  assert.equal(result.stale, true);
});

test("reports a safe history-stage reason when an Entry request times out", async () => {
  const base = dependencies();
  base.dependencies.provider = {
    ...base.dependencies.provider,
    getEntryHistory: async (entryId) => {
      if (entryId === 20) throw new FantasyFplError("FANTASY_FPL_TIMEOUT", "raw history response");
      return [{ event: 1, points: entryId, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0 }];
    },
  };

  const result = await runFantasyLeagueSync(base.dependencies);

  assert.equal(result.message, "โหลดคะแนน Entry จาก FPL ไม่สำเร็จ: FPL API ใช้เวลานานเกินกำหนด");
  assert.doesNotMatch(result.message ?? "", /raw history response/);
});
