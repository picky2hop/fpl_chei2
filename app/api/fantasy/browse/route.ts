import { requireUser } from '@/lib/auth/guards';
import { createBrowseHandler, buildBrowseBatch } from '@/lib/fantasy/browse';
import { createFantasyRepository } from '@/lib/fantasy/repository';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const GET = createBrowseHandler({
  requireUser,
  load: async ({ leagueId, gameweeks, includePlayers }) => {
    const repository = createFantasyRepository(getSupabaseAdmin());
    const season = await repository.getActiveSeason();
    const input = await repository.getLeagueDashboard({ seasonId: season.id, leagueId, browse: true, includePlayers });
    return buildBrowseBatch(input, gameweeks, includePlayers);
  },
});
