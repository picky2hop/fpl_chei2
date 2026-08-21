import assert from "node:assert/strict";
import test from "node:test";
import { buildLeagueLeaderboard } from "../../lib/fantasy/league-scoring.ts";

const members = [
  { league_id: "league-1", gameweek_id: "gw-2", fpl_entry_id: 101, fpl_team_name: "Team One", fpl_manager_name: "Manager One" },
  { league_id: "league-1", gameweek_id: "gw-2", fpl_entry_id: 102, fpl_team_name: "Team Two", fpl_manager_name: "Manager Two" },
  { league_id: "league-1", gameweek_id: "gw-2", fpl_entry_id: 103, fpl_team_name: "Team Three", fpl_manager_name: "Manager Three" },
];

const scores = [
  { fpl_entry_id: 101, gameweek_id: "gw-1", gameweek_number: 1, points: 50 },
  { fpl_entry_id: 101, gameweek_id: "gw-2", gameweek_number: 2, points: 20 },
  { fpl_entry_id: 102, gameweek_id: "gw-1", gameweek_number: 1, points: 60 },
  { fpl_entry_id: 102, gameweek_id: "gw-2", gameweek_number: 2, points: 10 },
];

const mappings = [{
  fpl_entry_id: 101,
  app_user_id: "user-1",
  display_name: "LINE One",
  avatar_url: "https://example.test/avatar.png",
}];

test("includes mapped and unmapped members and assigns competition ranks", () => {
  const rows = buildLeagueLeaderboard({
    members,
    scores,
    mappings,
    selectedGameweekId: "gw-2",
    selectedGameweekNumber: 2,
    mode: "gameweek",
  });

  assert.deepEqual(rows.map((row) => ({ entry: row.fplEntryId, points: row.points, rank: row.rank, display: row.displayName })), [
    { entry: 101, points: 20, rank: 1, display: "LINE One" },
    { entry: 102, points: 10, rank: 2, display: "Team Two" },
    { entry: 103, points: 0, rank: 3, display: "Team Three" },
  ]);
  assert.equal(rows[1].mapped, false);
});

test("season mode sums scores through the selected Gameweek", () => {
  const rows = buildLeagueLeaderboard({
    members,
    scores,
    mappings,
    selectedGameweekId: "gw-2",
    selectedGameweekNumber: 2,
    mode: "season",
  });

  assert.deepEqual(rows.map((row) => [row.fplEntryId, row.points]), [[101, 70], [102, 70], [103, 0]]);
  assert.deepEqual(rows.slice(0, 2).map((row) => row.rank), [1, 1]);
});

test("uses the selected membership snapshot and keeps a shared Entry as one row", () => {
  const rows = buildLeagueLeaderboard({
    members: [members[0], members[0]],
    scores,
    mappings,
    selectedGameweekId: "gw-2",
    selectedGameweekNumber: 2,
    mode: "gameweek",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].fplEntryId, 101);
});
