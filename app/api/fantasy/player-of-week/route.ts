import { requireUser } from '@/lib/auth/guards';
import { createFantasyFplProvider } from '@/lib/fantasy/fpl-client';
import { loadLatestPlayerOfWeek } from '@/lib/fantasy/weekly-features';

export async function GET() {
  try { await requireUser(); } catch (error) {
    const status = typeof error === 'object' && error !== null && 'status' in error && error.status === 403 ? 403 : 401;
    return Response.json({ error: 'Authentication required' }, { status });
  }
  return Response.json(await loadLatestPlayerOfWeek({ provider: createFantasyFplProvider() }), { headers: { 'cache-control': 'no-store' } });
}
