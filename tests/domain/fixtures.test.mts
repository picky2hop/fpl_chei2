import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCloseGameweek,
  getFixtureOutcome,
  isPredictionOpen,
  reconcileFixtureMove,
} from "../../lib/domain/fixtures.ts";

describe("fixture domain rules", () => {
  it("maps the final score to a prediction outcome", () => {
    assert.equal(getFixtureOutcome(2, 1), "home");
    assert.equal(getFixtureOutcome(1, 1), "draw");
    assert.equal(getFixtureOutcome(0, 3), "away");
  });

  it("locks before-kickoff writes at kickoff, and for excluded users or non-open fixtures", () => {
    const kickoffAt = new Date("2026-08-15T12:00:00.000Z");
    assert.equal(isPredictionOpen({
      status: "scheduled",
      kickoffAt,
      now: new Date("2026-08-15T11:59:59.999Z"),
      participantStatus: "active",
    }), true);
    assert.equal(isPredictionOpen({
      status: "scheduled",
      kickoffAt,
      now: kickoffAt,
      participantStatus: "active",
    }), false);
    assert.equal(isPredictionOpen({
      status: "scheduled",
      kickoffAt,
      now: new Date("2026-08-15T11:00:00.000Z"),
      participantStatus: "excluded",
    }), false);
    assert.equal(isPredictionOpen({
      status: "postponed",
      kickoffAt,
      now: new Date("2026-08-15T11:00:00.000Z"),
      participantStatus: "active",
    }), false);
  });

  it("allows a GW to close only after a finished fixture and no scheduled/live fixture", () => {
    assert.equal(canCloseGameweek([{ status: "finished" }, { status: "postponed" }]), true);
    assert.equal(canCloseGameweek([{ status: "finished" }, { status: "scheduled" }]), false);
    assert.equal(canCloseGameweek([{ status: "postponed" }]), false);
    assert.equal(canCloseGameweek([]), false);
  });

  it("voids predictions when a fixture moves to another gameweek", () => {
    assert.deepEqual(reconcileFixtureMove({
      oldGameweekId: "gw-5",
      newGameweekId: "gw-10",
      kickoffChanged: true,
      fixtureStarted: false,
    }), {
      moved: true,
      voidPrediction: true,
      reopenTarget: true,
      oldGameweekId: "gw-5",
      newGameweekId: "gw-10",
    });
  });

  it("keeps a prediction when only the pre-kickoff time changes in the same gameweek", () => {
    assert.deepEqual(reconcileFixtureMove({
      oldGameweekId: "gw-5",
      newGameweekId: "gw-5",
      kickoffChanged: true,
      fixtureStarted: false,
    }), {
      moved: false,
      voidPrediction: false,
      reopenTarget: false,
      oldGameweekId: "gw-5",
      newGameweekId: "gw-5",
    });
  });
});
