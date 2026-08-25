import assert from "node:assert/strict";
import test from "node:test";
import { runFantasyPlayerStatsSync } from "../../lib/fantasy/player-stats-sync-service.ts";
import type { FantasyFplProvider } from "../../lib/fantasy/types.ts";
import type { FantasyLeagueRepository } from "../../lib/fantasy/repository.ts";

test("syncs only current-gameweek player statistics", async () => {
  let bootstrapCalls = 0;
  let historyCalls = 0;
  let picksCalls = 0;
  let savedPlayers: unknown[] = [];
  const provider: FantasyFplProvider = {
    getBootstrap: async () => {
      bootstrapCalls += 1;
      return {
        currentGameweek: 3,
        latestFinishedGameweek: 2,
        gameweeks: [],
        players: [{ playerId: 7, name: "Player Seven", position: "MID", clubId: 1, clubName: "Club", status: "a", selectedByPercent: 10, transfersInEvent: 20, transfersOutEvent: 3, form: 5 }],
        mostCaptainedPlayerId: 7,
        mostViceCaptainedPlayerId: null,
      };
    },
    getEntryHistory: async () => { historyCalls += 1; throw new Error("must not call history"); },
    getEntryPicks: async () => { picksCalls += 1; throw new Error("must not call picks"); },
    getEntrySummary: async (entryId) => ({ entryId, teamName: "Team", managerName: "Manager" }),
    getEventLive: async () => [],
    getDreamTeam: async () => ({ topPlayerId: null, topPoints: null, players: [] }),
    getLeague: async (leagueId) => ({ leagueId, officialName: "League" }),
    getLeagueMembers: async () => [],
  };
  const repository: Pick<FantasyLeagueRepository, "applyPlayerStatsSync"> = {
    applyPlayerStatsSync: async (input) => {
      savedPlayers = input.players;
      return { jobRunId: input.jobRunId, playersUpserted: input.players.length };
    },
  };
  const result = await runFantasyPlayerStatsSync({
    now: () => new Date("2026-08-25T00:00:00.000Z"),
    seasonId: "season-1",
    gameweeks: [{ id: "gw-3", number: 3 }],
    provider,
    repository,
    createJob: async () => ({ id: "job-3" }),
    finishJob: async () => undefined,
  });

  assert.equal(bootstrapCalls, 1);
  assert.equal(historyCalls, 0);
  assert.equal(picksCalls, 0);
  assert.equal(savedPlayers.length, 1);
  assert.equal(result.playersUpserted, 1);
  assert.equal(result.currentGameweek, 3);
  assert.equal(result.stale, false);
});
