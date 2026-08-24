import { createFantasyTeamOfWeekHandler } from "@/lib/api/fantasy-team-of-week-handler";
import { requireUser } from "@/lib/auth/guards";
import { getFantasyTeamOfWeekData } from "@/lib/data/fantasy";

export const GET = createFantasyTeamOfWeekHandler({
  requireUser,
  getTeamOfWeek: async () => getFantasyTeamOfWeekData(),
});
