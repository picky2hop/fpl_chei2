import assert from "node:assert/strict";
import test from "node:test";
import { selectDefaultFantasyLeague } from "../../lib/fantasy/league-selection.ts";

test("selects active FPL league 819498 first", () => {
  assert.equal(selectDefaultFantasyLeague([
    { id: "league-2", fpl_league_id: 819502, status: "active" as const },
    { id: "league-1", fpl_league_id: 819498, status: "active" as const },
  ]), "league-1");
});

test("falls back to the first active league", () => {
  assert.equal(selectDefaultFantasyLeague([
    { id: "archived", fpl_league_id: 819498, status: "archived" as const },
    { id: "league-2", fpl_league_id: 819502, status: "active" as const },
  ]), "league-2");
});

test("returns null when no active league exists", () => {
  assert.equal(selectDefaultFantasyLeague([
    { id: "archived", fpl_league_id: 819498, status: "archived" as const },
  ]), null);
});
