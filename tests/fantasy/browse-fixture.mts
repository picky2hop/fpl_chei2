import type { FantasyLeagueDashboardInput } from "../../lib/fantasy/league-dashboard.ts";

export function seasonFixture(): FantasyLeagueDashboardInput {
  return {
    season: { id: 's1', name: '2026/27' }, selectedLeagueId: 'l1',
    leagues: [{ id: 'l1', season_id: 's1', fpl_league_id: 819498, official_name: 'Cup', status: 'active', archived_at: null }],
    gameweeks: Array.from({ length: 38 }, (_, i) => ({ id: `gw${i + 1}`, number: i + 1, name: `GW ${i + 1}`, is_current: i === 37, status: 'closed' })),
    memberships: Array.from({ length: 38 * 30 }, (_, i) => ({ league_id: 'l1', gameweek_id: `gw${Math.floor(i / 30) + 1}`, gameweek_number: Math.floor(i / 30) + 1, fpl_entry_id: i % 30 + 1, fpl_team_name: i < 30 ? 'Old name' : 'New name', fpl_manager_name: 'Manager' })),
    scores: Array.from({ length: 38 * 30 }, (_, i) => ({ gameweek_id: `gw${Math.floor(i / 30) + 1}`, gameweek_number: Math.floor(i / 30) + 1, fpl_entry_id: i % 30 + 1, points: 10 })),
    mappings: [], players: [], globalCaptainPlayerId: null, globalViceCaptainPlayerId: null,
    awards: [{ gameweek_id: 'gw1', fpl_entry_id: 1, award: 'champion' }, { gameweek_id: 'gw2', fpl_entry_id: 2, award: 'wooden_spoon' }],
    sync: { lastSyncedAt: '2026-09-15T00:00:00Z', stale: false, message: null },
  };
}
