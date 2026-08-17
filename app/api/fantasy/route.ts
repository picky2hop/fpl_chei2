import { createFantasyHandler } from "@/lib/api/fantasy-handler";
import { requireUser } from "@/lib/auth/guards";
import { getFantasyDashboardData } from "@/lib/data/fantasy";

export const GET = createFantasyHandler({
  requireUser,
  getDashboard: async ({ gameweekNumber }) => getFantasyDashboardData({ gameweekNumber }),
});
