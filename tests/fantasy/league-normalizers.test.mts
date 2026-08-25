import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntryGameweekScoreRows,
  buildEntryScoreRequestIds,
  buildMembershipSnapshotRows,
  deduplicateLeagueMembers,
} from "../../lib/fantasy/league-normalizers.ts";

const sources = [
  {
    leagueId: "league-1",
    members: [
      { entryId: 101, teamName: "Team One", managerName: "Manager One", rank: 1 },
      { entryId: 102, teamName: "Team Two", managerName: "Manager Two", rank: 2 },
    ],
  },
  {
    leagueId: "league-2",
    members: [
      { entryId: 101, teamName: "Team One", managerName: "Manager One", rank: 4 },
      { entryId: 103, teamName: "Team Three", managerName: "Manager Three", rank: 1 },
    ],
  },
];

test("deduplicates shared Entries while retaining every league badge", () => {
  assert.deepEqual(deduplicateLeagueMembers(sources), [
    {
      entryId: 101,
      teamName: "Team One",
      managerName: "Manager One",
      leagues: [
        { leagueId: "league-1", rank: 1 },
        { leagueId: "league-2", rank: 4 },
      ],
    },
    {
      entryId: 102,
      teamName: "Team Two",
      managerName: "Manager Two",
      leagues: [{ leagueId: "league-1", rank: 2 }],
    },
    {
      entryId: 103,
      teamName: "Team Three",
      managerName: "Manager Three",
      leagues: [{ leagueId: "league-2", rank: 1 }],
    },
  ]);
});

test("builds one membership snapshot row per league membership", () => {
  assert.deepEqual(buildMembershipSnapshotRows({
    seasonId: "season-1",
    gameweekId: "gw-1",
    syncedAt: "2026-08-21T00:00:00.000Z",
    sources,
  }), [
    {
      season_id: "season-1",
      league_id: "league-1",
      gameweek_id: "gw-1",
      fpl_entry_id: 101,
      fpl_team_name: "Team One",
      fpl_manager_name: "Manager One",
      source_synced_at: "2026-08-21T00:00:00.000Z",
    },
    {
      season_id: "season-1",
      league_id: "league-1",
      gameweek_id: "gw-1",
      fpl_entry_id: 102,
      fpl_team_name: "Team Two",
      fpl_manager_name: "Manager Two",
      source_synced_at: "2026-08-21T00:00:00.000Z",
    },
    {
      season_id: "season-1",
      league_id: "league-2",
      gameweek_id: "gw-1",
      fpl_entry_id: 101,
      fpl_team_name: "Team One",
      fpl_manager_name: "Manager One",
      source_synced_at: "2026-08-21T00:00:00.000Z",
    },
    {
      season_id: "season-1",
      league_id: "league-2",
      gameweek_id: "gw-1",
      fpl_entry_id: 103,
      fpl_team_name: "Team Three",
      fpl_manager_name: "Manager Three",
      source_synced_at: "2026-08-21T00:00:00.000Z",
    },
  ]);
});

test("returns each Entry once for score requests in stable order", () => {
  const rows = buildMembershipSnapshotRows({ seasonId: "s", gameweekId: "g", syncedAt: "now", sources });
  assert.deepEqual(buildEntryScoreRequestIds(rows), [101, 102, 103]);
});

test("marks History-derived score rows as legacy while retaining FPL metadata", () => {
  assert.deepEqual(buildEntryGameweekScoreRows({
    seasonId: "season-1",
    gameweekIdByNumber: new Map([[1, "gw-1"]]),
    historyByEntry: new Map([[101, [{ event: 1, points: 72, event_transfers: 2, event_transfers_cost: 4, points_on_bench: 11 }]]]),
    membersByEntry: new Map([[101, { teamName: "Team One", managerName: "Manager One" }]]),
    syncedAt: "2026-08-21T00:00:00.000Z",
  }), [{
    season_id: "season-1",
    gameweek_id: "gw-1",
    fpl_entry_id: 101,
    fpl_team_name: "Team One",
    fpl_manager_name: "Manager One",
    points: 72,
    event_transfers: 2,
    event_transfers_cost: 4,
    points_on_bench: 11,
    calculation_method: "legacy_fpl_history",
    source_synced_at: "2026-08-21T00:00:00.000Z",
  }]);
});

test("rejects a membership with an invalid Entry ID", () => {
  assert.throws(() => buildMembershipSnapshotRows({
    seasonId: "s",
    gameweekId: "g",
    syncedAt: "now",
    sources: [{ leagueId: "league-1", members: [{ entryId: 0, teamName: "Team", managerName: "Manager", rank: null }] }],
  }), /invalid FPL entry/i);
});
