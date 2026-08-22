import assert from "node:assert/strict";
import test from "node:test";
import { createFantasyFplProvider } from "../../lib/fantasy/fpl-client.ts";

const bootstrap = {
  events: [
    { id: 1, is_current: false, finished: true, most_captained: 2, most_vice_captained: 3 },
    { id: 2, is_current: true, finished: false, most_captained: 4, most_vice_captained: 5 },
  ],
  teams: [{ id: 1, name: "Home" }, { id: 2, name: "Away" }],
  element_types: [
    { id: 1, singular_name_short: "GKP" },
    { id: 2, singular_name_short: "DEF" },
    { id: 3, singular_name_short: "MID" },
    { id: 4, singular_name_short: "FWD" },
  ],
  elements: [{
    id: 10,
    web_name: "Player",
    first_name: "A",
    second_name: "Player",
    element_type: 3,
    team: 1,
    status: "a",
    selected_by_percent: "12.5",
    transfers_in_event: 100,
    transfers_out_event: 20,
    form: "6.2",
  }],
};

const history = {
  current: [{ event: 1, points: 72, event_transfers: 2, event_transfers_cost: 4, points_on_bench: 11 }],
  past: [],
  chips: [],
};

test("fetches and normalizes entry summary, history, and bootstrap data", async () => {
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/api/bootstrap-static/")) return Response.json(bootstrap);
      if (url.endsWith("/api/entry/123/history/")) return Response.json(history);
      return Response.json({ id: 123, name: "Chei FC", player_first_name: "Chei", player_last_name: "Manager" });
    },
  });

  assert.deepEqual(await provider.getEntrySummary(123), { entryId: 123, teamName: "Chei FC", managerName: "Chei Manager" });
  assert.deepEqual(await provider.getEntryHistory(123), history.current);
  assert.equal((await provider.getBootstrap()).currentGameweek, 2);
  assert.equal((await provider.getBootstrap()).players[0].position, "MID");
  assert.equal((await provider.getBootstrap()).mostCaptainedPlayerId, 4);
});

test("fetches and normalizes the current Entry picks with player metadata", async () => {
  const squadBootstrap = {
    ...bootstrap,
    elements: Array.from({ length: 15 }, (_, index) => ({
      id: index + 1,
      web_name: `Player ${index + 1}`,
      first_name: "FPL",
      second_name: `Player ${index + 1}`,
      element_type: index === 0 ? 1 : index < 4 ? 2 : index < 8 ? 3 : 4,
      team: index % 2 ? 1 : 2,
      status: "a",
      selected_by_percent: "10",
      transfers_in_event: 1,
      transfers_out_event: 2,
      form: "5",
    })),
  };
  const picks = {
    picks: Array.from({ length: 15 }, (_, index) => ({
      element: index + 1,
      position: index + 1,
      multiplier: index === 4 ? 2 : index >= 11 ? 0 : 1,
      is_captain: index === 4,
      is_vice_captain: index === 8,
    })),
  };
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.endsWith("/api/entry/123/event/2/picks/")) return Response.json(picks);
      if (url.endsWith("/api/bootstrap-static/")) return Response.json(squadBootstrap);
      return Response.json({ id: 123, name: "Chei FC", player_first_name: "Chei", player_last_name: "Manager" });
    },
  });

  const squad = await provider.getEntryPicks(123, 2);
  assert.equal(squad.gameweekNumber, 2);
  assert.equal(squad.formation, "3-4-3");
  assert.equal(squad.captainPlayerId, 5);
  assert.equal(squad.viceCaptainPlayerId, 9);
  assert.equal(squad.starters[0].playerName, "Player 1");
  assert.equal(squad.bench[0].playerId, 12);
});

test("rejects a non-success FPL response without exposing its body", async () => {
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async () => new Response("provider secret body", { status: 403 }),
  });

  await assert.rejects(provider.getEntryHistory(123), (error: unknown) => error instanceof Error
    && "code" in error
    && error.code === "FANTASY_FPL_HTTP_403"
    && !error.message.includes("provider secret body"));
});

test("falls back to the latest finished GW when FPL has no current GW", async () => {
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async () => Response.json({
      ...bootstrap,
      events: [
        { id: 1, is_current: false, finished: true, most_captained: 2, most_vice_captained: 3 },
        { id: 2, is_current: false, finished: true, most_captained: 4, most_vice_captained: 5 },
      ],
    }),
  });

  assert.equal((await provider.getBootstrap()).currentGameweek, 2);
});

test("uses the next scheduled GW when FPL has no current or finished GW", async () => {
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async () => Response.json({
      ...bootstrap,
      events: [
        { id: 1, is_current: false, is_next: true, finished: false, most_captained: null, most_vice_captained: null },
        { id: 2, is_current: false, is_next: false, finished: false, most_captained: null, most_vice_captained: null },
      ],
    }),
  });

  const snapshot = await provider.getBootstrap();
  assert.equal(snapshot.currentGameweek, 1);
  assert.equal(snapshot.latestFinishedGameweek, null);
});
