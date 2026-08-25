import test from "node:test";
import assert from "node:assert/strict";
import {
  getAppUserRole,
  getMissingParticipantGameweekIds,
  toLiffAuthIdentity,
  type RepositorySeason,
  type RepositoryUser,
} from "../../lib/auth/user-repository-core.ts";

test("new non-admin LINE users use the database player role", () => {
  assert.equal(getAppUserRole("U-player", "U-admin"), "player");
});

test("new users join only open or upcoming gameweeks that have no participant row", () => {
  assert.deepEqual(
    getMissingParticipantGameweekIds([
      { id: "gw-1", status: "closed" },
      { id: "gw-2", status: "open" },
      { id: "gw-3", status: "upcoming" },
      { id: "gw-4", status: "reopened" },
    ], ["gw-3"]),
    ["gw-2"],
  );
});

test("excluded participant rows are preserved and are not treated as missing", () => {
  assert.deepEqual(
    getMissingParticipantGameweekIds([
      { id: "gw-1", status: "open" },
      { id: "gw-2", status: "upcoming" },
    ], ["gw-1", "gw-2"]),
    [],
  );
});

test("identity mapping returns only the safe LIFF response fields", () => {
  const user: RepositoryUser = {
    id: "user-1",
    display_name: "Chei",
    avatar_url: null,
  };
  const season: RepositorySeason = { id: "season-1", name: "2026/27" };

  assert.deepEqual(toLiffAuthIdentity(user, season), {
    appUserId: "user-1",
    displayName: "Chei",
    avatarUrl: null,
    seasonId: "season-1",
    seasonName: "2026/27",
  });
});
