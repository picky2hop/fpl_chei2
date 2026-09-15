import type { BrowseBatch } from './browse.ts';
import type { FantasyLeagueDashboardResponse } from './league-dashboard.ts';
import { rankPlayerStats } from './scoring.ts';

type Dashboard = FantasyLeagueDashboardResponse;
type Snapshot = { data: Dashboard | null; context: BrowseBatch | null; loading: boolean; error: string };
type Loader = (league: string, weeks: number[], includePlayers: boolean, signal: AbortSignal) => Promise<BrowseBatch>;
const emptyPlayers = rankPlayerStats({ players: [], currentGameweekId: '' });

export async function fetchBrowseBatch(league: string, weeks: number[], includePlayers: boolean, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<BrowseBatch> {
  const query = new URLSearchParams({ league });
  if (weeks.length) query.set('gameweeks', weeks.join(','));
  if (includePlayers) query.set('players', '1');
  const response = await fetchImpl(`/api/fantasy/browse?${query}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Unable to load Fantasy');
  return await response.json() as BrowseBatch;
}

// Owned by one mounted page: never shared across users or persisted in browser storage.
export function createBrowseCache(load: Loader, now = Date.now) {
  const entries = new Map<string, { data: Dashboard; at: number }>();
  const pending = new Map<string, Promise<void>>();
  const errors = new Map<string, string>();
  const controllers = new Set<AbortController>();
  const listeners = new Set<() => void>();
  let context: BrowseBatch | null = null;
  let selected = { league: '', gw: null as number | null };
  let players: Dashboard['playerStats'] | undefined;
  let playersAt = -Infinity;
  let epoch = 0;
  let background: Promise<void> | null = null;
  let foregroundController: AbortController | null = null;
  let foregroundTask: Promise<void> | null = null;
  let foregroundKeys: string[] = [];
  let snapshot: Snapshot = { data: null, context: null, loading: false, error: '' };
  const key = (league: string, gw: number | null) => `${league}:${gw ?? 'current'}`;
  const selectedKey = () => key(selected.league, selected.gw ?? context?.currentGameweek ?? null);
  function read(league: string, gw: number | null) {
    const entry = entries.get(key(league, gw ?? context?.currentGameweek ?? null));
    return entry ? { ...entry.data, currentGameweek: context?.currentGameweek ?? entry.data.currentGameweek, playerStats: players ?? entry.data.playerStats } : null;
  }
  function publish() {
    const entry = entries.get(selectedKey());
    snapshot = {
      data: entry ? read(selected.league, selected.gw) : null,
      context, loading: pending.has(selectedKey()) || pending.has(key(selected.league, selected.gw)),
      error: errors.get(selectedKey()) ?? errors.get(key(selected.league, selected.gw)) ?? '',
    };
    for (const listener of listeners) listener();
  }
  async function request(league: string, weeks: number[], includePlayers: boolean, foreground = false) {
    const keys = weeks.length ? weeks.map((gw) => key(league, gw)) : [key(league, null)];
    const existing = keys.map((k) => pending.get(k)).filter((p): p is Promise<void> => Boolean(p));
    if (existing.length === keys.length) { await Promise.all(existing); return; }
    const missing = weeks.filter((gw) => !pending.has(key(league, gw)));
    const activeKeys = weeks.length ? missing.map((gw) => key(league, gw)) : keys;
    const generation = epoch;
    const controller = new AbortController();
    if (foreground) {
      foregroundController?.abort();
      for (const k of foregroundKeys) if (pending.get(k) === foregroundTask) pending.delete(k);
      foregroundController = controller;
      foregroundKeys = activeKeys;
    }
    controllers.add(controller);
    for (const k of activeKeys) errors.delete(k);
    const task = (async () => {
      try {
        const batch = await load(league, missing, includePlayers, controller.signal);
        if (generation !== epoch || controller.signal.aborted) return;
        if (batch.selectedLeagueId !== league) throw new Error('Unexpected league');
        if (!Object.keys(batch.views).length) throw new Error('Unavailable gameweek');
        if (context && context.season.id !== batch.season.id) {
          // Drop old season views and invalidate other responses still in flight.
          epoch++;
          entries.clear(); players = undefined; playersAt = -Infinity;
        }
        context = batch;
        if (batch.playerStats) { players = batch.playerStats; playersAt = now(); }
        for (const [gw, view] of Object.entries(batch.views)) {
          entries.set(key(league, Number(gw)), { at: now(), data: {
            season: batch.season, leagues: batch.leagues, currentGameweek: batch.currentGameweek,
            latestFinishedGameweek: batch.latestFinishedGameweek, selectedLeagueId: league, sync: batch.sync,
            ...view, playerStats: players ?? emptyPlayers,
            playerOfWeek: { state: 'unavailable', message: 'กำลังโหลด Player of the Week…' },
          } });
        }
        for (const k of activeKeys) errors.delete(k);
      } catch {
        if (generation === epoch && !controller.signal.aborted) for (const k of activeKeys) errors.set(k, 'โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณาลองใหม่');
      } finally {
        controllers.delete(controller);
      }
    })();
    if (foreground) foregroundTask = task;
    for (const k of activeKeys) pending.set(k, task);
    publish();
    await task;
    for (const k of activeKeys) if (pending.get(k) === task) pending.delete(k);
    publish();
  }
  async function select(league: string, gw: number | null, force = false) {
    selected = { league, gw };
    publish();
    const entry = entries.get(selectedKey());
    if (!force && entry && now() - entry.at < 60_000) return;
    const inFlight = pending.get(selectedKey()) ?? pending.get(key(league, gw));
    if (inFlight) { await inFlight; return; }
    await request(league, gw === null ? [] : [gw], !players || now() - playersAt >= 60_000, true);
  }
  function prefetch(leagues: string[]) {
    if (background) return background;
    const generation = epoch;
    const current = context?.currentGameweek;
    if (!current) return Promise.resolve();
    background = (async () => {
      for (const league of [...new Set(leagues)]) {
        const weeks = Array.from({ length: current }, (_, i) => current - i);
        for (let offset = 0; offset < weeks.length; offset += 10) {
          if (epoch !== generation) return;
          const missing = weeks.slice(offset, offset + 10).filter((gw) => !entries.has(key(league, gw)) && !pending.has(key(league, gw)));
          if (missing.length) await request(league, missing, false);
        }
      }
    })().finally(() => { background = null; });
    return background;
  }
  return {
    select, prefetch, read,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: () => selected.league ? select(selected.league, selected.gw, true) : Promise.resolve(),
    dispose: () => { epoch++; for (const controller of controllers) controller.abort(); pending.clear(); },
  };
}
