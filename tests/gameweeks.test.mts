import test from "node:test";
import assert from "node:assert/strict";
import { getCurrentGameweekId } from "../lib/gameweeks.ts";

test("selects the current gameweek and falls back to the first available gameweek", () => {
  assert.equal(
    getCurrentGameweekId([
      { id: 3, state: "past" },
      { id: 5, state: "current" },
      { id: 6, state: "future" },
    ]),
    5,
  );
  assert.equal(getCurrentGameweekId([{ id: 3, state: "past" }, { id: 6, state: "future" }]), 3);
  assert.equal(getCurrentGameweekId([]), null);
});
