"use client";

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createBrowseCache, fetchBrowseBatch } from '@/lib/fantasy/browse-cache';
import type { FantasyLeagueDashboardResponse } from '@/lib/fantasy/league-dashboard';

export function useFantasyBrowse(leagueId: string, gameweek: number | null) {
  const [cache] = useState(() => createBrowseCache(fetchBrowseBatch));
  const snapshot = useSyncExternalStore(cache.subscribe, cache.getSnapshot, cache.getSnapshot);
  const [playerOfWeek, setPlayerOfWeek] = useState<FantasyLeagueDashboardResponse['playerOfWeek']>({ state: 'unavailable', message: 'กำลังโหลด Player of the Week…' });
  useEffect(() => {
    if (leagueId) void cache.select(leagueId, gameweek);
  }, [cache, leagueId, gameweek]);
  const seasonId = snapshot.context?.season.id;
  const currentGameweek = snapshot.context?.currentGameweek;
  useEffect(() => {
    if (!seasonId) return;
    // Yield until the first table can paint, then start a single background queue.
    const timer = window.setTimeout(() => {
      const context = cache.getSnapshot().context;
      if (context) void cache.prefetch([leagueId, ...context.leagues.filter((l) => l.status === 'active').map((l) => l.id)]);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [cache, seasonId, currentGameweek, leagueId]);
  useEffect(() => {
    const refresh = () => { if (leagueId && document.visibilityState === 'visible') void cache.select(leagueId, gameweek); };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, [cache, leagueId, gameweek]);
  useEffect(() => {
    if (!seasonId) return;
    let active = true;
    let controller: AbortController | undefined;
    const load = async () => {
      if (document.visibilityState === 'hidden' || controller) return;
      controller = new AbortController();
      try {
        const response = await fetch('/api/fantasy/player-of-week', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const value = await response.json() as FantasyLeagueDashboardResponse['playerOfWeek'];
        if (active) setPlayerOfWeek(value);
      } catch { if (active) setPlayerOfWeek({ state: 'unavailable', message: 'ไม่สามารถโหลด Player of the Week ได้ในขณะนี้' }); }
      finally { controller = undefined; }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); };
  }, [seasonId, currentGameweek]);
  useEffect(() => () => cache.dispose(), [cache]);
  // Effects run after render: never display a previous selection under new controls.
  const selectedData = cache.read(leagueId, gameweek);
  return { ...snapshot, data: selectedData ? { ...selectedData, playerOfWeek } : null, retry: cache.refresh };
}
