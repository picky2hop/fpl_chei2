import assert from "node:assert/strict";
import test from "node:test";
import { fetchFplSnapshot } from "../../lib/sync/fpl-client.ts";

const bootstrap = {
  teams: [
    { id: 1, name: "Home", short_name: "HOM", code: 101 },
    { id: 2, name: "Away", short_name: "AWY", code: 102 },
  ],
  events: [{ id: 1, name: "Gameweek 1", is_current: true }],
};

const fixtures = [{
  id: 1,
  event: 1,
  kickoff_time: "2026-08-15T12:00:00Z",
  team_h: 1,
  team_a: 2,
  team_h_score: null,
  team_a_score: null,
  started: false,
  finished: false,
  finished_provisional: false,
  postponed: false,
}];

async function expectFailureCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => error instanceof Error
    && "code" in error
    && error.code === code);
}

test("classifies FPL HTTP 403 without storing the response body", async () => {
  const fetchImpl: typeof fetch = async () => new Response("provider-secret-body", { status: 403 });

  await expectFailureCode(
    () => fetchFplSnapshot({ fetchImpl, baseUrl: "https://fpl.test", timeoutMs: 100 }),
    "FPL_HTTP_403",
  );
});

test("classifies FPL HTTP 502 without storing the response body", async () => {
  const fetchImpl: typeof fetch = async () => new Response("upstream trace", { status: 502 });

  await expectFailureCode(
    () => fetchFplSnapshot({ fetchImpl, baseUrl: "https://fpl.test", timeoutMs: 100 }),
    "FPL_HTTP_502",
  );
});

test("aborts the sibling FPL request when either endpoint fails", async () => {
  let siblingSignal: AbortSignal | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/api/bootstrap-static/")) {
      return new Response(null, { status: 403 });
    }
    siblingSignal = init?.signal ?? undefined;
    return new Promise<Response>(() => undefined);
  };

  await expectFailureCode(
    () => fetchFplSnapshot({ fetchImpl, baseUrl: "https://fpl.test", timeoutMs: 100 }),
    "FPL_HTTP_403",
  );

  assert.equal(siblingSignal?.aborted, true);
});

test("classifies an aborted FPL request as a timeout", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    assert.ok(init?.signal, "the provider request must carry a timeout signal");
    throw new DOMException("request aborted", "AbortError");
  };

  await expectFailureCode(
    () => fetchFplSnapshot({ fetchImpl, baseUrl: "https://fpl.test", timeoutMs: 1 }),
    "FPL_TIMEOUT",
  );
});

test("returns a validated snapshot from both FPL endpoints", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    return Response.json(url.endsWith("/api/fixtures/") ? fixtures : bootstrap);
  };

  const snapshot = await fetchFplSnapshot({ fetchImpl, baseUrl: "https://fpl.test/", timeoutMs: 100, expectedFixtureCount: 1 });

  assert.equal(snapshot.fixtures.length, 1);
  assert.equal(snapshot.teams.length, 2);
  assert.equal(snapshot.events.length, 1);
});
