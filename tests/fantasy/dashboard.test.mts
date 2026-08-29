import assert from "node:assert/strict";
import test from "node:test";
import { buildFantasyDashboard } from "../../lib/fantasy/dashboard.ts";

test("dashboard defaults to current GW while player stats stay current-only", () => {
  const result = buildFantasyDashboard({
    season: { id: "s1", name: "2026/27" },
    gameweeks: [
      { id: "gw1", number: 1, name: "GW 1", is_current: false, status: "closed" },
      { id: "gw2", number: 2, name: "GW 2", is_current: true, status: "open" },
    ],
    mappings: [{ id: "m1", season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, fpl_team_name: "FC", fpl_manager_name: "Manager", mapping_status: "active", display_name: "User", avatar_url: null }],
    scores: [{ mapping_id: "m1", gameweek_id: "gw1", points: 72 }, { mapping_id: "m1", gameweek_id: "gw2", points: 45 }],
    players: [
      { gameweek_id: "gw1", fpl_player_id: 1, player_name: "Old", position: "MID", club_id: 1, club_name: "Club", status: "a", selected_by_percent: 99, transfers_in_event: 99, transfers_out_event: 0, form: 9 },
      { gameweek_id: "gw2", fpl_player_id: 2, player_name: "Current", position: "MID", club_id: 1, club_name: "Club", status: "a", selected_by_percent: 20, transfers_in_event: 20, transfers_out_event: 0, form: 6 },
    ],
    globalCaptainPlayerId: 2,
    globalViceCaptainPlayerId: null,
    awards: [],
    sync: { lastSyncedAt: "2026-08-17T00:00:00.000Z", stale: false, message: null },
  });

  assert.equal(result.currentGameweek, 2);
  assert.equal(result.latestFinishedGameweek, 1);
  assert.equal(result.selectedLeaderboardGameweek, 2);
  assert.deepEqual(result.leaderboard.gameweek.map((entry) => entry.points), [45]);
  assert.deepEqual(result.leaderboard.season.map((entry) => entry.points), [117]);
  assert.deepEqual(result.playerStats.selected.MID.map((entry) => entry.playerId), [2]);
});

test("dashboard keeps multiple teams separate when they share one LINE identity", () => {
  const result = buildFantasyDashboard({
    season: { id: "s1", name: "2026/27" },
    gameweeks: [{ id: "gw1", number: 1, name: "GW 1", is_current: true, status: "open" }],
    mappings: [
      { id: "m1", season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, fpl_team_name: "FC One", fpl_manager_name: "Manager One", mapping_status: "active", display_name: "LINE User", avatar_url: null },
      { id: "m2", season_id: "s1", app_user_id: "u1", fpl_entry_id: 101, fpl_team_name: "FC Two", fpl_manager_name: "Manager Two", mapping_status: "active", display_name: "LINE User", avatar_url: null },
    ],
    scores: [{ mapping_id: "m1", gameweek_id: "gw1", points: 41 }, { mapping_id: "m2", gameweek_id: "gw1", points: 37 }],
    players: [],
    globalCaptainPlayerId: null,
    globalViceCaptainPlayerId: null,
    awards: [],
    sync: { lastSyncedAt: null, stale: false, message: null },
  });

  assert.deepEqual(result.leaderboard.gameweek.map((entry) => [entry.fplEntryId, entry.points, entry.appUserId]), [
    [100, 41, "u1"],
    [101, 37, "u1"],
  ]);
});

test("dashboard can select historical leaderboard GW without changing current player stats", () => {
  const result = buildFantasyDashboard({
    season: { id: "s1", name: "2026/27" },
    gameweeks: [
      { id: "gw1", number: 1, name: "GW 1", is_current: false, status: "closed" },
      { id: "gw2", number: 2, name: "GW 2", is_current: true, status: "open" },
    ],
    selectedGameweekNumber: 1,
    mappings: [{ id: "m1", season_id: "s1", app_user_id: "u1", fpl_entry_id: 100, fpl_team_name: "FC", fpl_manager_name: "Manager", mapping_status: "active", display_name: "User", avatar_url: null }],
    scores: [{ mapping_id: "m1", gameweek_id: "gw1", points: 72 }, { mapping_id: "m1", gameweek_id: "gw2", points: 45 }],
    players: [{ gameweek_id: "gw2", fpl_player_id: 2, player_name: "Current", position: "MID", club_id: 1, club_name: "Club", status: "a", selected_by_percent: 20, transfers_in_event: 20, transfers_out_event: 0, form: 6 }],
    globalCaptainPlayerId: null,
    globalViceCaptainPlayerId: null,
    awards: [{ mapping_id: "m1", award: "champion" }],
    sync: { lastSyncedAt: null, stale: true, message: "ยังไม่สามารถอัปเดตข้อมูล Fantasy ล่าสุดได้" },
  });

  assert.equal(result.selectedLeaderboardGameweek, 1);
  assert.equal(result.latestFinishedGameweek, 1);
  assert.equal(result.leaderboard.gameweek[0].points, 72);
  assert.equal(result.playerStats.selected.MID[0].playerId, 2);
  assert.equal(result.awards.champions[0].mappingId, "m1");
  assert.equal(result.sync.stale, true);
});
