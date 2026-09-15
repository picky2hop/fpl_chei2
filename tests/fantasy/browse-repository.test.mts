import assert from 'node:assert/strict';
import test from 'node:test';
import { createFantasyRepository } from '../../lib/fantasy/repository.ts';
import { buildBrowseBatch } from '../../lib/fantasy/browse.ts';
import { seasonFixture } from './browse-fixture.mts';

test('browse repository reads beyond database row caps, preserves per-GW awards and omits unrequested players', async () => {
  const fixture = seasonFixture();
  const tables: Record<string, object[]> = {
    seasons: [fixture.season], gameweeks: fixture.gameweeks, fantasy_leagues: fixture.leagues,
    fantasy_league_membership_snapshots: fixture.memberships,
    fantasy_entry_gameweek_scores: fixture.scores,
    fantasy_league_awards: fixture.awards.map((award) => ({ ...award, league_id: 'l1' })),
    fantasy_entry_mappings: [], app_users: [], job_runs: [],
  };
  const client = { from(table: string) {
    assert.notEqual(table, 'fantasy_player_gameweek_stats');
    let rows: Record<string, unknown>[] = (tables[table] ?? []).map((row) => ({ season_id: 's1', ...row }));
    let offset = 0; let limit = 1000;
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) { rows = rows.filter((row) => row[column] === value); return query; },
      order() { return query; },
      range(from: number, to: number) { offset = from; limit = to - from + 1; return query; },
      limit(count: number) { limit = count; return query; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) { return Promise.resolve({ data: rows.slice(offset, offset + limit), error: null }).then(resolve); },
    };
    return query;
  } };
  const input = await createFantasyRepository(client as never).getLeagueDashboard({ seasonId: 's1', leagueId: 'l1', browse: true, includePlayers: false });
  assert.equal(input.memberships.length, 1140);
  assert.equal(input.scores.length, 1140);
  const batch = buildBrowseBatch(input, [1, 2, 38]);
  assert.equal(batch.views[38].leaderboard.season[0].points, 380);
  assert.equal(batch.views[1].awards.champions[0].entryId, 1);
  assert.equal(batch.views[2].awards.woodenSpoons[0].entryId, 2);
});
