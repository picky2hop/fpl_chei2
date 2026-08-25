import assert from "node:assert/strict";
import test from "node:test";
import {
  assertActiveMappingUniqueness,
  buildPlayerSnapshotRows,
  createFantasyRepository,
  uniqueSnapshotKeys,
} from "../../lib/fantasy/repository.ts";

const players = (count: number, formDelta = 0) => Array.from({ length: count }, (_, index) => ({
  playerId: index + 1,
  name: `Player ${index + 1}`,
  position: index % 4 === 0 ? "GK" as const : "MID" as const,
  clubId: (index % 2) + 1,
  clubName: index % 2 === 0 ? "Home" : "Away",
  status: "a",
  selectedByPercent: 10 + formDelta,
  transfersInEvent: 100,
  transfersOutEvent: 20,
  form: 6 + formDelta,
}));

test("same-GW player sync upserts identity while a different GW adds snapshots", () => {
  const first = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw1", players: players(700) });
  const sameGw = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw1", players: players(700, 1) });
  const nextGw = buildPlayerSnapshotRows({ seasonId: "s1", gameweekId: "gw2", players: players(700) });

  assert.equal(first.length, 700);
  assert.equal(uniqueSnapshotKeys([...first, ...sameGw]).size, 700);
  assert.equal(uniqueSnapshotKeys([...first, ...nextGw]).size, 1400);
});

test("allows one active LINE user to map multiple FPL Entries", () => {
  assert.doesNotThrow(() => assertActiveMappingUniqueness([
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "active" },
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 101, mapping_status: "active" },
  ]));
});

test("active mapping identity cannot duplicate an FPL entry", () => {
  assert.doesNotThrow(() => assertActiveMappingUniqueness([
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "active" },
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "archived" },
    { season_id: "s1", app_user_id: "u2", fpl_entry_id: 101, mapping_status: "active" },
  ]));

  assert.throws(() => assertActiveMappingUniqueness([
    { season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, mapping_status: "active" },
    { season_id: "s1", app_user_id: "u2", fpl_entry_id: 100, mapping_status: "active" },
  ]), /active mapping already exists for FPL entry/);
});

test("upserts one current squad snapshot per Entry and replaces the previous GW", async () => {
  const calls: Array<{ rows: unknown; options: unknown }> = [];
  const client = {
    from(table: string) {
      assert.equal(table, "fantasy_entry_current_squads");
      return {
        upsert(rows: unknown, options: unknown) {
          calls.push({ rows, options });
          return Promise.resolve({ error: null });
        },
      };
    },
  } as never;
  const repository = createFantasyRepository(client);
  const squad = {
    gameweekNumber: 3,
    formation: "3-4-3",
    captainPlayerId: 5,
    viceCaptainPlayerId: 9,
    starters: [],
    bench: [],
  };

  await repository.upsertCurrentSquad!({
    seasonId: "s1",
    entryId: 123,
    gameweekId: "gw-3",
    squad,
    syncedAt: "2026-08-22T00:00:00.000Z",
  });

  assert.deepEqual(calls, [{
    rows: [{
      season_id: "s1",
      fpl_entry_id: 123,
      gameweek_id: "gw-3",
      gameweek_number: 3,
      squad,
      source_synced_at: "2026-08-22T00:00:00.000Z",
    }],
    options: { onConflict: "season_id,fpl_entry_id" },
  }]);
});

test("current league Entry context uses the current membership snapshot", async () => {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        order() {
          return Promise.resolve({
            data: table === "gameweeks"
              ? [{ id: "gw-3", number: 3, is_current: true, status: "open" }]
              : undefined,
            error: null,
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: { fpl_entry_id: 123 }, error: null });
        },
      };
      return chain;
    },
  } as never;
  const repository = createFantasyRepository(client);

  assert.deepEqual(await repository.getCurrentLeagueEntry!({ seasonId: "s1", leagueId: "league-1", entryId: 123 }), {
    gameweekId: "gw-3",
    gameweekNumber: 3,
  });
  assert.deepEqual(calls, ["gameweeks", "fantasy_league_membership_snapshots"]);
});

test("passes calculation method through the multi-league score RPC", async () => {
  let rpcName = "";
  let rpcArgs: Record<string, unknown> | null = null;
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcName = name;
      rpcArgs = args;
      return Promise.resolve({
        data: { jobRunId: "job-1", leaguesUpserted: 0, membershipsUpserted: 0, scoresUpserted: 1, playersUpserted: 0 },
        error: null,
      });
    },
  } as never;
  const repository = createFantasyRepository(client);

  await repository.applyLeagueSync({
    jobRunId: "job-1",
    syncedAt: "2026-08-21T00:00:00.000Z",
    leagues: [],
    memberships: [],
    scores: [{
      season_id: "season-1",
      gameweek_id: "gw-1",
      fpl_entry_id: 101,
      fpl_team_name: "Team One",
      fpl_manager_name: "Manager One",
      points: 60,
      event_transfers: 2,
      event_transfers_cost: 4,
      points_on_bench: 11,
      calculation_method: "starting_xi_captain_v1",
      source_synced_at: "2026-08-21T00:00:00.000Z",
    }],
    players: [],
  });

  assert.equal(rpcName, "apply_fantasy_league_sync");
  assert.deepEqual((rpcArgs as { p_scores: unknown[] }).p_scores, [{
    season_id: "season-1",
    gameweek_id: "gw-1",
    fpl_entry_id: 101,
    fpl_team_name: "Team One",
    fpl_manager_name: "Manager One",
    points: 60,
    event_transfers: 2,
    event_transfers_cost: 4,
    points_on_bench: 11,
    calculation_method: "starting_xi_captain_v1",
    source_synced_at: "2026-08-21T00:00:00.000Z",
  }]);
});

test("reads existing multi-league score calculation methods", async () => {
  const client = {
    from(table: string) {
      assert.equal(table, "fantasy_entry_gameweek_scores");
      return {
        select(fields: string) {
          assert.equal(fields, "fpl_entry_id,gameweek_id,calculation_method");
          return {
            eq(field: string, value: string) {
              assert.equal(field, "season_id");
              assert.equal(value, "season-1");
              return Promise.resolve({
                data: [{ fpl_entry_id: 101, gameweek_id: "gw-1", calculation_method: "legacy_fpl_history" }],
                error: null,
              });
            },
          };
        },
      };
    },
  } as never;
  const repository = createFantasyRepository(client);

  assert.deepEqual(await repository.listEntryGameweekScores!("season-1"), [
    { fpl_entry_id: 101, gameweek_id: "gw-1", calculation_method: "legacy_fpl_history" },
  ]);
});

test("passes score-only recalculation rows through its dedicated RPC", async () => {
  let rpcName = "";
  let rpcArgs: Record<string, unknown> | null = null;
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcName = name;
      rpcArgs = args;
      return Promise.resolve({ data: { jobRunId: "job-2", scoresUpserted: 1 }, error: null });
    },
  } as never;
  const repository = createFantasyRepository(client);

  const result = await repository.applyScoreRecalculation!({
    jobRunId: "job-2",
    scores: [{
      season_id: "season-1",
      gameweek_id: "gw-1",
      fpl_entry_id: 101,
      fpl_team_name: "Team One",
      fpl_manager_name: "Manager One",
      points: 60,
      event_transfers: 0,
      event_transfers_cost: 0,
      points_on_bench: 0,
      calculation_method: "starting_xi_captain_v1",
      source_synced_at: "2026-08-25T00:00:00.000Z",
    }],
  });

  assert.equal(rpcName, "apply_fantasy_score_recalculation");
  assert.deepEqual(rpcArgs, { p_job_run_id: "job-2", p_scores: [{
    season_id: "season-1",
    gameweek_id: "gw-1",
    fpl_entry_id: 101,
    fpl_team_name: "Team One",
    fpl_manager_name: "Manager One",
    points: 60,
    event_transfers: 0,
    event_transfers_cost: 0,
    points_on_bench: 0,
    calculation_method: "starting_xi_captain_v1",
    source_synced_at: "2026-08-25T00:00:00.000Z",
  }] });
  assert.deepEqual(result, { jobRunId: "job-2", scoresUpserted: 1 });
});

test("passes player statistics through its dedicated current-GW RPC", async () => {
  let rpcName = "";
  let rpcArgs: Record<string, unknown> | null = null;
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcName = name;
      rpcArgs = args;
      return Promise.resolve({ data: { jobRunId: "job-3", playersUpserted: 1 }, error: null });
    },
  } as never;
  const repository = createFantasyRepository(client);
  const players = [{
    season_id: "season-1",
    gameweek_id: "gw-3",
    fpl_player_id: 7,
    player_name: "Player Seven",
    position: "MID" as const,
    club_id: 1,
    club_name: "Club",
    status: "a",
    selected_by_percent: 10,
    transfers_in_event: 20,
    transfers_out_event: 3,
    form: 5,
    source_synced_at: "2026-08-25T00:00:00.000Z",
  }];

  const result = await repository.applyPlayerStatsSync!({ jobRunId: "job-3", syncedAt: "2026-08-25T00:00:00.000Z", players });

  assert.equal(rpcName, "apply_fantasy_player_stats_sync");
  assert.deepEqual(rpcArgs, { p_job_run_id: "job-3", p_synced_at: "2026-08-25T00:00:00.000Z", p_players: players });
  assert.deepEqual(result, { jobRunId: "job-3", playersUpserted: 1 });
});
