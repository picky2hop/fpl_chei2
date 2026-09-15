import assert from "node:assert/strict";
import test from "node:test";
import { fetchBrowseBatch } from '../../lib/fantasy/browse-cache.ts';

test("Fantasy dashboard requests fresh dashboard data after a sync", async () => {
  const signal = new AbortController().signal;
  const result = await fetchBrowseBatch('league 1', [2, 3], false, signal, async (url, init) => {
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.signal, signal);
    const query = new URL(String(url), 'http://localhost').searchParams;
    assert.equal(query.get('league'), 'league 1');
    assert.equal(query.get('gameweeks'), '2,3');
    assert.equal(query.has('players'), false);
    return Response.json({ views: { 2: { leaderboard: { gameweek: [{ points: 25 }] } } } });
  });
  assert.equal(result.views[2].leaderboard.gameweek[0].points, 25);
});
