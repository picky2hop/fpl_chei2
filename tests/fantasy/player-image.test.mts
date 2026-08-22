import assert from "node:assert/strict";
import test from "node:test";
import { buildFplPlayerPhotoUrl, photoKeyFromFplPhoto } from "../../lib/fantasy/player-image.ts";

test("builds the official FPL player photo URL from a FPL photo key", () => {
  assert.equal(
    buildFplPlayerPhotoUrl(437730),
    "https://resources.premierleague.com/premierleague25/photos/players/110x140/437730.png",
  );
});

test("normalizes the FPL photo filename without using the player ID", () => {
  assert.equal(photoKeyFromFplPhoto("154561.jpg"), "154561");
  assert.equal(buildFplPlayerPhotoUrl("154561"), "https://resources.premierleague.com/premierleague25/photos/players/110x140/154561.png");
});
