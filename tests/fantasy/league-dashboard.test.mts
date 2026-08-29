import assert from "node:assert/strict";
import test from "node:test";
import { buildFantasyLeagueDashboard } from "../../lib/fantasy/league-dashboard.ts";

const baseInput = {
  season: { id: "s1", name: "2026/27" },
  gameweeks: [
    { id: "gw1", number: 1, name: "GW 1", is_current: false, status: "closed" },
    { id: "gw2", number: 2, name: "GW 2", is_current: true, status: "open" },
  ],
  leagues: [
    { id: "l1", season_id: "s1", fpl_league_id: 819498, official_name: "Cup", status: "active" as const, archived_at: null },
    { id: "l2", season_id: "s1", fpl_league_id: 819502, official_name: "Love", status: "archived" as const, archived_at: "2026-08-20T00:00:00.000Z" },
  ],
  selectedLeagueId: "l1",
  memberships: [
    { league_id: "l1", gameweek_id: "gw1", gameweek_number: 1, fpl_entry_id: 10, fpl_team_name: "Team 10", fpl_manager_name: "Manager 10" },
    { league_id: "l1", gameweek_id: "gw2", gameweek_number: 2, fpl_entry_id: 10, fpl_team_name: "Team 10", fpl_manager_name: "Manager 10" },
    { league_id: "l1", gameweek_id: "gw2", gameweek_number: 2, fpl_entry_id: 20, fpl_team_name: "Team 20", fpl_manager_name: "Manager 20" },
  ],
  scores: [
    { fpl_entry_id: 10, gameweek_id: "gw1", gameweek_number: 1, points: 50 },
    { fpl_entry_id: 10, gameweek_id: "gw2", gameweek_number: 2, points: 40 },
    { fpl_entry_id: 20, gameweek_id: "gw2", gameweek_number: 2, points: 40 },
  ],
  mappings: [{ fpl_entry_id: 10, app_user_id: "u1", display_name: "LINE One", avatar_url: null }],
  players: [{ gameweek_id: "gw2", fpl_player_id: 1, player_name: "Current Player", position: "MID" as const, club_id: 1, club_name: "Club", status: "a", selected_by_percent: 20, transfers_in_event: 20, transfers_out_event: 0, form: 6 }],
  globalCaptainPlayerId: 1,
  globalViceCaptainPlayerId: null,
  awards: [{ fpl_entry_id: 20, award: "champion" as const }],
  sync: { lastSyncedAt: "2026-08-21T00:00:00.000Z", stale: false, message: null },
};

test("league dashboard includes unmapped members and keeps player stats global", () => {
  const result = buildFantasyLeagueDashboard(baseInput);
  assert.deepEqual(result.leaderboard.gameweek.map((row) => [row.fplEntryId, row.points, row.mapped]), [[10, 40, true], [20, 40, false]]);
  assert.equal(result.latestFinishedGameweek, 1);
  assert.equal(result.leaderboard.gameweek[0].rank, 1);
  assert.equal(result.leaderboard.gameweek[1].rank, 1);
  assert.deepEqual(result.playerStats.selected.MID.map((player) => player.playerId), [1]);
  assert.equal(result.awards.champions[0].entryId, 20);
  assert.deepEqual(result.playerOfWeek, { state: "unavailable", message: "ยังไม่มีข้อมูล Player of the Week" });
});

test("season ranking sums scores through selected GW and archived leagues remain selectable", () => {
  const result = buildFantasyLeagueDashboard({ ...baseInput, selectedLeagueId: "l2", selectedGameweekNumber: 1, memberships: [{ ...baseInput.memberships[0], league_id: "l2" }] });
  assert.equal(result.selectedLeagueId, "l2");
  assert.equal(result.selectedLeaderboardGameweek, 1);
  assert.equal(result.leaderboard.season[0].points, 50);
  assert.equal(result.leagues.find((league) => league.id === "l2")?.status, "archived");
});
