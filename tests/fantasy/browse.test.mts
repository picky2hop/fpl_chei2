import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBrowseBatch, createBrowseHandler, readAllRows } from '../../lib/fantasy/browse.ts';
import { seasonFixture } from './browse-fixture.mts';


test('browse batches keep historical identities, awards and cumulative totals per GW', () => {
  const result = buildBrowseBatch(seasonFixture(), [1, 2, 38], false);
  assert.equal(result.views[1].leaderboard.gameweek[0].teamName, 'Old name');
  assert.equal(result.views[2].leaderboard.gameweek[0].teamName, 'New name');
  assert.equal(result.views[2].leaderboard.season[0].points, 20);
  assert.equal(result.views[38].leaderboard.season[0].points, 380);
  assert.deepEqual(result.views[1].awards.champions, [{ entryId: 1, award: 'champion' }]);
  assert.deepEqual(result.views[2].awards.champions, []);
  assert.equal(result.playerStats, undefined);
  assert.equal('playerStats' in result.views[1], false);
});

test('pagination returns all 1140 rows and propagates failures', async () => {
  const source = seasonFixture().scores;
  const rows = await readAllRows(async (from, to) => ({ data: source.slice(from, to + 1), error: null }));
  assert.equal(rows.length, 1140);
  await assert.rejects(readAllRows(async () => ({ data: null, error: { message: 'failed' } })));
});

test('authenticated browse validates bounded GW batches and returns no-store data', async () => {
  const handler = createBrowseHandler({ requireUser: async () => ({ id: 'u1' }), load: async ({ gameweeks, includePlayers }) => buildBrowseBatch(seasonFixture(), gameweeks, includePlayers) });
  for (const query of ['league=l1&gameweeks=0', 'league=l1&gameweeks=39', 'league=l1&gameweeks=1,2,3,4,5,6,7,8,9,10,11', 'gameweeks=1']) {
    assert.equal((await handler(new Request(`http://localhost/?${query}`))).status, 400);
  }
  const response = await handler(new Request('http://localhost/?league=l1&gameweeks=1,2'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).views[2].leaderboard.season[0].points, 20);
  const denied = createBrowseHandler({ requireUser: async () => { throw { status: 403 }; }, load: async () => { throw new Error('must not load'); } });
  assert.equal((await denied(new Request('http://localhost/?league=l1'))).status, 403);
});

test('38 GW compact table payload stays below 1 MB for 30 members', () => {
  const fixture = seasonFixture();
  let bytes = 0;
  for (let gw = 1; gw <= 38; gw += 10) {
    const batch = buildBrowseBatch(fixture, Array.from({ length: Math.min(10, 39 - gw) }, (_, i) => gw + i), false);
    bytes += Buffer.byteLength(JSON.stringify(batch));
  }
  assert.ok(bytes < 1_000_000, `${bytes} bytes`);
  console.log(`38 GW / 30 members serialized browse data: ${bytes} bytes`);
});
