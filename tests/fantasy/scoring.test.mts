import assert from "node:assert/strict";
import test from "node:test";
import { buildFantasyLeaderboard, rankPlayerStats, sumFantasySeasonPoints } from "../../lib/fantasy/scoring.ts";
import type { FantasyPlayerStatRow } from "../../lib/fantasy/scoring.ts";

test("season total sums FPL points without subtracting transfer cost", () => {
  assert.equal(sumFantasySeasonPoints([{ points: 72 }, { points: 45, event_transfers_cost: 4 }]), 117);
});

test("leaderboard includes missing scores as zero and keeps archived entries separate", () => {
  const rows = [
    { mapping_id: "m1", gameweek_id: "gw1", points: 72 },
    { mapping_id: "m1", gameweek_id: "gw2", points: 45 },
    { mapping_id: "m2", gameweek_id: "gw1", points: 60 },
  ];
  const mappings = [
    { id: "m1", fpl_entry_id: 100, fpl_team_name: "New FC", fpl_manager_name: "New", mapping_status: "active" as const, app_user_id: "u1", display_name: "One", avatar_url: null },
    { id: "m2", fpl_entry_id: 200, fpl_team_name: "Old FC", fpl_manager_name: "Old", mapping_status: "archived" as const, app_user_id: "u1", display_name: "One", avatar_url: null },
    { id: "m3", fpl_entry_id: 300, fpl_team_name: "Zero FC", fpl_manager_name: "Zero", mapping_status: "active" as const, app_user_id: "u2", display_name: "Two", avatar_url: null },
  ];

  const gameweek = buildFantasyLeaderboard({ rows, mappings, selectedGameweekId: "gw1", mode: "gameweek" });
  assert.deepEqual(gameweek.map((entry) => [entry.mappingId, entry.points]), [["m1", 72], ["m2", 60], ["m3", 0]]);

  const season = buildFantasyLeaderboard({ rows, mappings, selectedGameweekId: "gw2", mode: "season" });
  assert.deepEqual(season.map((entry) => [entry.mappingId, entry.points]), [["m1", 117], ["m2", 60], ["m3", 0]]);
});

test("player stats group four positions and include every tie at fifth place", () => {
  const players: FantasyPlayerStatRow[] = Array.from({ length: 7 }, (_, index) => ({
    fpl_player_id: index + 1,
    player_name: `Player ${index + 1}`,
    position: "MID" as const,
    club_id: 1,
    club_name: "Club",
    status: index === 6 ? "u" : "a",
    selected_by_percent: index === 0 ? 20 : index === 1 ? 19 : index === 2 ? 18 : index === 3 ? 17 : 16,
    transfers_in_event: 100 - index,
    transfers_out_event: index,
    form: 10 - index,
  }));
  players.push({
    fpl_player_id: 20,
    player_name: "Goalkeeper",
    position: "GK",
    club_id: 1,
    club_name: "Club",
    status: "a",
    selected_by_percent: 25,
    transfers_in_event: 200,
    transfers_out_event: 1,
    form: 9,
  });

  const stats = rankPlayerStats({
    players,
    currentGameweekId: "gw2",
    globalCaptainPlayerId: 1,
    globalViceCaptainPlayerId: 2,
  });

  assert.deepEqual(Object.keys(stats.selected), ["GK", "DEF", "MID", "FWD"]);
  assert.equal(stats.selected.MID.length, 6);
  assert.equal(stats.selected.MID.some((entry) => entry.playerId === 7), false);
  assert.equal(stats.globalCaptain?.playerId, 1);
  assert.equal(stats.globalViceCaptain?.playerId, 2);
});

test("ranks the five new player-stat categories independently by position", () => {
  const players: FantasyPlayerStatRow[] = Array.from({ length: 7 }, (_, index) => ({
    fpl_player_id: index + 1,
    player_name: `Player ${index + 1}`,
    position: "MID" as const,
    club_id: 1,
    club_name: "Club",
    status: "a",
    selected_by_percent: 10,
    transfers_in_event: 10,
    transfers_out_event: 10,
    form: 10,
    defensive_contribution: 70 - index,
    bps: 60 - index,
    points_per_game: 7 - index / 10,
    expected_goal_involvements_per_90: 1.5 - index / 100,
    latest_finished_gameweek_points: 20 - index,
  }));

  const stats = rankPlayerStats({ players, currentGameweekId: "gw2" });

  assert.deepEqual(stats.defensiveContribution.MID.slice(0, 2).map((entry) => entry.playerId), [1, 2]);
  assert.deepEqual(stats.bps.MID.slice(0, 2).map((entry) => entry.playerId), [1, 2]);
  assert.deepEqual(stats.pointsPerGame.MID.slice(0, 2).map((entry) => entry.playerId), [1, 2]);
  assert.deepEqual(stats.expectedGoalInvolvementsPer90.MID.slice(0, 2).map((entry) => entry.playerId), [1, 2]);
  assert.deepEqual(stats.latestGameweekPoints.MID.slice(0, 2).map((entry) => entry.playerId), [1, 2]);
});

test("excludes goalkeepers from DC and xGI90 rankings only", () => {
  const stats = rankPlayerStats({
    players: [
      { fpl_player_id: 1, player_name: "Goalkeeper", position: "GK", club_id: 1, club_name: "Club", status: "a", selected_by_percent: 10, transfers_in_event: 10, transfers_out_event: 10, form: 10, defensive_contribution: 999, bps: 999, points_per_game: 9, expected_goal_involvements_per_90: 9, latest_finished_gameweek_points: 9 },
      { fpl_player_id: 2, player_name: "Defender", position: "DEF", club_id: 1, club_name: "Club", status: "a", selected_by_percent: 10, transfers_in_event: 10, transfers_out_event: 10, form: 10, defensive_contribution: 100, bps: 100, points_per_game: 8, expected_goal_involvements_per_90: 8, latest_finished_gameweek_points: 8 },
    ],
    currentGameweekId: "gw2",
  });

  assert.deepEqual(stats.defensiveContribution.GK, []);
  assert.deepEqual(stats.expectedGoalInvolvementsPer90.GK, []);
  assert.equal(stats.bps.GK[0]?.playerId, 1);
  assert.equal(stats.pointsPerGame.GK[0]?.playerId, 1);
});
