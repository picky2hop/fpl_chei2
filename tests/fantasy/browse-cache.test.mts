import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowseCache } from '../../lib/fantasy/browse-cache.ts';
import { buildBrowseBatch } from '../../lib/fantasy/browse.ts';
import type { BrowseBatch } from '../../lib/fantasy/browse.ts';
import { seasonFixture } from './browse-fixture.mts';

function batch(league: string, weeks: number[]) {
  return buildBrowseBatch({ ...seasonFixture(), selectedLeagueId: league, memberships: seasonFixture().memberships.map((m) => ({ ...m, league_id: league })) }, weeks, true);
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

test('first table resolves before prefetch; cached navigation makes no request', async () => {
  const requests: number[][] = [];
  const cache = createBrowseCache(async (league, weeks) => { requests.push(weeks); return batch(league, weeks); });
  await cache.select('l1', null);
  assert.equal(cache.getSnapshot().data?.selectedLeaderboardGameweek, 38);
  assert.equal(requests.length, 1);
  await cache.prefetch(['l1', 'l2']);
  assert.ok(requests.every((weeks) => weeks.length <= 10));
  const count = requests.length;
  await cache.select('l2', 1);
  assert.equal(cache.getSnapshot().data?.selectedLeagueId, 'l2');
  assert.equal(cache.getSnapshot().data?.leaderboard.season[0].points, 10);
  assert.equal(requests.length, count);
});

test('out-of-order responses never replace the selected league and missing views hide old data', async () => {
  const a = deferred<BrowseBatch>(); const b = deferred<BrowseBatch>();
  const cache = createBrowseCache((league) => league === 'l1' ? a.promise : b.promise);
  const first = cache.select('l1', 1);
  const second = cache.select('l2', 2);
  assert.equal(cache.getSnapshot().data, null);
  b.resolve(batch('l2', [2])); await second;
  a.resolve(batch('l1', [1])); await first;
  assert.equal(cache.getSnapshot().data?.selectedLeagueId, 'l2');
  assert.equal(cache.getSnapshot().data?.selectedLeaderboardGameweek, 2);
});

test('deduplicates concurrent navigation and retains cached data when refresh fails', async () => {
  let calls = 0; let fail = false; let now = 0;
  const pending = deferred<BrowseBatch>();
  const cache = createBrowseCache(async () => { calls++; if (fail) throw new Error('offline'); return pending.promise; }, () => now);
  const first = cache.select('l1', 1); const second = cache.select('l1', 1);
  assert.equal(calls, 1);
  pending.resolve(batch('l1', [1])); await Promise.all([first, second]);
  fail = true; now = 61_000;
  await cache.select('l1', 1);
  assert.equal(cache.getSnapshot().data?.leaderboard.gameweek[0].points, 10);
  assert.ok(cache.getSnapshot().error);
});

test('foreground request can complete while one background batch is pending; disposal ignores pending results', async () => {
  const pending = deferred<BrowseBatch>();
  const cache = createBrowseCache(async (league, weeks) => weeks.length > 1 ? pending.promise : batch(league, weeks));
  await cache.select('l1', 38);
  const background = cache.prefetch(['l1']);
  await cache.select('l2', 1);
  assert.equal(cache.getSnapshot().data?.selectedLeagueId, 'l2');
  cache.dispose();
  pending.resolve(batch('l1', [37, 36])); await background;
  assert.equal(cache.getSnapshot().data?.selectedLeagueId, 'l2');
});

test('rapid uncached selection aborts superseded foreground requests', async () => {
  const signals: AbortSignal[] = [];
  const pending = deferred<BrowseBatch>();
  const cache = createBrowseCache(async (_league, _weeks, _players, signal) => { signals.push(signal); return pending.promise; });
  const a = cache.select('l1', 1);
  const b = cache.select('l1', 2);
  const c = cache.select('l1', 3);
  assert.equal(signals.filter((signal) => !signal.aborted).length, 1);
  cache.dispose(); pending.resolve(batch('l1', [1, 2, 3]));
  await Promise.all([a, b, c]);
});

test('expired cache refresh updates scores and cached selection is readable before an effect runs', async () => {
  let points = 10; let now = 0;
  const cache = createBrowseCache(async (league, weeks) => {
    const result = batch(league, weeks);
    result.views[1].leaderboard.gameweek[0].points = points;
    return result;
  }, () => now);
  await cache.select('l1', 1);
  assert.equal(cache.read('l1', 1)?.leaderboard.gameweek[0].points, 10);
  points = 25; now = 61_000;
  await cache.select('l1', 1);
  assert.equal(cache.getSnapshot().data?.leaderboard.gameweek[0].points, 25);
});

test('returning to an aborted selection starts a fresh request immediately', async () => {
  const responses: Array<ReturnType<typeof deferred<BrowseBatch>>> = [];
  const cache = createBrowseCache(async () => { const next = deferred<BrowseBatch>(); responses.push(next); return next.promise; });
  const a = cache.select('l1', 1);
  const b = cache.select('l1', 2);
  const again = cache.select('l1', 1);
  assert.equal(responses.length, 3);
  responses.forEach((response) => response.resolve(batch('l1', [1, 2])));
  await Promise.all([a, b, again]);
  assert.equal(cache.getSnapshot().data?.selectedLeaderboardGameweek, 1);
});

test('current-GW navigation reuses the same GW already being prefetched', async () => {
  const pending = deferred<BrowseBatch>();
  let calls = 0;
  const cache = createBrowseCache(async (league, weeks) => { calls++; return league === 'l2' ? pending.promise : batch(league, weeks); });
  await cache.select('l1', 38);
  const background = cache.prefetch(['l2']);
  const navigation = cache.select('l2', null);
  assert.equal(calls, 2);
  cache.dispose(); pending.resolve(batch('l2', [38]));
  await Promise.all([background, navigation]);
});

test('season changes discard earlier-season cache entries', async () => {
  let season = 's1';
  const cache = createBrowseCache(async (league, weeks) => ({ ...batch(league, weeks), season: { id: season, name: season } }));
  await cache.select('l1', 1);
  await cache.select('l2', 2);
  season = 's2';
  await cache.refresh();
  assert.equal(cache.read('l1', 1), null);
  assert.equal(cache.read('l2', 2)?.season.id, 's2');
});
