import test from "node:test";
import assert from "node:assert/strict";
import {
  getMissingParticipantGameweekIds,
  toLiffAuthIdentity,
  type RepositorySeason,
  type RepositoryUser,
} from "../../lib/auth/user-repository-core.ts";

test("new users join every active-season gameweek that has no participant row", () => {
  assert.deepEqual(
    getMissingParticipantGameweekIds(["gw-1", "gw-2", "gw-3"], ["gw-2"]),
    ["gw-1", "gw-3"],
  );
});

test("excluded participant rows are preserved and are not treated as missing", () => {
  assert.deepEqual(
    getMissingParticipantGameweekIds(["gw-1", "gw-2"], ["gw-1", "gw-2"]),
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
