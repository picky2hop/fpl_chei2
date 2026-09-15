import { buildFantasyLeagueDashboard, type FantasyLeagueDashboardInput, type FantasyLeagueDashboardResponse } from './league-dashboard.ts';

export type BrowseView = Pick<FantasyLeagueDashboardResponse, 'leaderboard' | 'awards' | 'selectedLeaderboardGameweek'>;
export type BrowseBatch = Pick<FantasyLeagueDashboardResponse, 'season' | 'leagues' | 'currentGameweek' | 'latestFinishedGameweek' | 'selectedLeagueId' | 'sync'> & {
  views: Record<number, BrowseView>;
  playerStats?: FantasyLeagueDashboardResponse['playerStats'];
};

export async function readAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await page(from, from + size - 1);
    if (result.error || !result.data) throw new Error('Fantasy database operation failed');
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}

export function buildBrowseBatch(input: FantasyLeagueDashboardInput, gameweeks: number[] = [], includePlayers = false): BrowseBatch {
  const base = buildFantasyLeagueDashboard(input);
  const requested = gameweeks.length ? gameweeks : [base.currentGameweek];
  const views: Record<number, BrowseView> = {};
  for (const number of requested) {
    const gw = input.gameweeks.find((item) => item.number === number && item.number <= base.currentGameweek);
    if (!gw) continue;
    const dashboard = buildFantasyLeagueDashboard({ ...input, players: [], selectedGameweekNumber: number, awards: input.awards.filter((award) => award.gameweek_id === gw.id) });
    views[number] = { selectedLeaderboardGameweek: number, leaderboard: dashboard.leaderboard, awards: dashboard.awards };
  }
  return { season: base.season, leagues: base.leagues, currentGameweek: base.currentGameweek, latestFinishedGameweek: base.latestFinishedGameweek, selectedLeagueId: base.selectedLeagueId, sync: base.sync, views, ...(includePlayers ? { playerStats: base.playerStats } : {}) };
}

export function createBrowseHandler(dependencies: {
  requireUser: () => Promise<{ id: string }>;
  load: (input: { leagueId: string; gameweeks: number[]; includePlayers: boolean }) => Promise<BrowseBatch>;
}) {
  return async (request: Request): Promise<Response> => {
    try { await dependencies.requireUser(); } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error && error.status === 403 ? 403 : 401;
      return Response.json({ error: 'Authentication required' }, { status });
    }
    const query = new URL(request.url).searchParams;
    const leagueId = query.get('league')?.trim();
    const raw = query.get('gameweeks');
    const gameweeks = raw === null ? [] : raw.split(',').map(Number);
    if (!leagueId || gameweeks.length > 10 || gameweeks.some((gw) => !Number.isInteger(gw) || gw < 1 || gw > 38)) return Response.json({ error: 'Invalid league or gameweeks' }, { status: 400 });
    try {
      const result = await dependencies.load({ leagueId, gameweeks: [...new Set(gameweeks)], includePlayers: query.get('players') === '1' });
      return Response.json(result, { headers: { 'cache-control': 'no-store' } });
    } catch { return Response.json({ error: 'โหลดตาราง Fantasy ไม่สำเร็จ' }, { status: 500 }); }
  };
}
