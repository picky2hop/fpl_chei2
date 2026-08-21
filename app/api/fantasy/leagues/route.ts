import { createFantasyLeaguesHandler } from "@/lib/api/fantasy-leagues-handler";
import { requireUser } from "@/lib/auth/guards";
import { getFantasyLeaguesData } from "@/lib/data/fantasy";

export const GET = createFantasyLeaguesHandler({ requireUser, getLeagues: async () => getFantasyLeaguesData() });
