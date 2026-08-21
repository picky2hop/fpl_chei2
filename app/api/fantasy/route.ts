import { createFantasyHandler } from "@/lib/api/fantasy-handler";
import { requireUser } from "@/lib/auth/guards";
import { getFantasyLeagueDashboardData } from "@/lib/data/fantasy";

export const GET = createFantasyHandler({
  requireUser,
  getDashboard: async ({ leagueId, gameweekNumber }) => getFantasyLeagueDashboardData({ leagueId, gameweekNumber }),
});
