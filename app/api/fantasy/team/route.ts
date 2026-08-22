import { createFantasyTeamHandler } from "@/lib/api/fantasy-team-handler";
import { requireUser } from "@/lib/auth/guards";
import { getFantasyCurrentSquadData } from "@/lib/data/fantasy";

export const GET = createFantasyTeamHandler({
  requireUser,
  getCurrentTeam: async ({ leagueId, entryId }) => getFantasyCurrentSquadData({ leagueId, entryId }),
});
