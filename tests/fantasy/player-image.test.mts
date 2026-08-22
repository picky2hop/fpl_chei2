import assert from "node:assert/strict";
import test from "node:test";
import { buildFplPlayerPhotoUrl } from "../../lib/fantasy/player-image.ts";

test("builds the official FPL player photo URL from an Entry player ID", () => {
  assert.equal(
    buildFplPlayerPhotoUrl(437730),
    "https://resources.premierleague.com/premierleague25/photos/players/110x140/437730.png",
  );
});
