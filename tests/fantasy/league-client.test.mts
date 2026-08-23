import assert from "node:assert/strict";
import test from "node:test";
import { createFantasyFplProvider } from "../../lib/fantasy/fpl-client.ts";

const pageOne = {
  league: { id: 819498, name: "เชยเชย Cup" },
  standings: {
    has_next: true,
    results: [
      { id: 1, entry: 101, entry_name: "Team One", player_name: "Manager One", rank: 1, event_total: 55, total: 120, event_transfers: 2, event_transfers_cost: 4 },
      { id: 2, entry: 102, entry_name: "Team Two", player_name: "Manager Two", rank: 2, event_total: 48, total: 110, event_transfers: 1, event_transfers_cost: 0 },
    ],
  },
};

const pageTwo = {
  league: { id: 819498, name: "เชยเชย Cup" },
  standings: {
    has_next: false,
    results: [
      { id: 3, entry: 101, entry_name: "Team One", player_name: "Manager One", rank: 1, event_total: 55, total: 120, event_transfers: 2, event_transfers_cost: 4 },
      { id: 4, entry: 103, entry_name: "Team Three", player_name: "Manager Three", rank: 3, event_total: 40, total: 100, event_transfers: 0, event_transfers_cost: 0 },
    ],
  },
};

function providerWithResponses(responses: Record<string, unknown>) {
  return createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async (input) => {
      const url = String(input);
      const key = url.includes("page_standings=1&page_new_entries=1&page=2") ? "page-2" : "page-1";
      const value = responses[key];
      if (value === undefined) return new Response("not found", { status: 404 });
      return Response.json(value);
    },
  });
}

test("loads the official FPL league name", async () => {
  const provider = providerWithResponses({ "page-1": pageOne });

  assert.deepEqual(await provider.getLeague(819498), {
    leagueId: 819498,
    officialName: "เชยเชย Cup",
  });
});

test("loads every FPL league standings page and preserves source rank", async () => {
  const provider = providerWithResponses({ "page-1": pageOne, "page-2": pageTwo });

  assert.deepEqual(await provider.getLeagueMembers(819498), [
    { entryId: 101, teamName: "Team One", managerName: "Manager One", rank: 1, eventTotal: 55, seasonTotal: 120, eventTransfers: 2, eventTransfersCost: 4 },
    { entryId: 102, teamName: "Team Two", managerName: "Manager Two", rank: 2, eventTotal: 48, seasonTotal: 110, eventTransfers: 1, eventTransfersCost: 0 },
    { entryId: 101, teamName: "Team One", managerName: "Manager One", rank: 1, eventTotal: 55, seasonTotal: 120, eventTransfers: 2, eventTransfersCost: 4 },
    { entryId: 103, teamName: "Team Three", managerName: "Manager Three", rank: 3, eventTotal: 40, seasonTotal: 100, eventTransfers: 0, eventTransfersCost: 0 },
  ]);
});

test("requests league standings without a server cache", async () => {
  let requestInit: RequestInit | undefined;
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async (_input, init) => {
      requestInit = init;
      return Response.json({ ...pageOne, standings: { ...pageOne.standings, has_next: false } });
    },
  });

  await provider.getLeagueMembers(819498);

  assert.equal(requestInit?.cache, "no-store");
});

test("rejects a malformed league standings response", async () => {
  const provider = providerWithResponses({ "page-1": { league: { id: 819498, name: "เชยเชย Cup" } } });

  await assert.rejects(provider.getLeagueMembers(819498), (error: unknown) => error instanceof Error
    && "code" in error
    && error.code === "FANTASY_FPL_INVALID_DATA");
});

test("does not expose an upstream response body for league failures", async () => {
  const provider = createFantasyFplProvider({
    baseUrl: "https://fpl.test",
    fetchImpl: async () => new Response("provider secret body", { status: 429 }),
  });

  await assert.rejects(provider.getLeague(819498), (error: unknown) => error instanceof Error
    && "code" in error
    && error.code === "FANTASY_FPL_HTTP_429"
    && !error.message.includes("provider secret body"));
});
