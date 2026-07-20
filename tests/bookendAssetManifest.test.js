import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import {
  BOOKEND_BACKGROUND_ASSETS,
  BOOKEND_CHARACTER_ASSETS,
  bookendBackgroundAsset,
  bookendCharacterAsset,
} from "../src/game/bookendAssetManifest.js";

test("every retained bookend asset exists in the public tree", async () => {
  const assets = [...Object.values(BOOKEND_BACKGROUND_ASSETS), ...Object.values(BOOKEND_CHARACTER_ASSETS)];
  for (const asset of assets) {
    const relativePath = asset.path.replace(/^.*?assets\//, "assets/");
    await access(new URL(`../public/${relativePath}`, import.meta.url));
  }
});

test("bookend asset lookup is closed and immutable", () => {
  assert.ok(Object.isFrozen(BOOKEND_BACKGROUND_ASSETS));
  assert.ok(Object.isFrozen(BOOKEND_CHARACTER_ASSETS));
  assert.equal(bookendBackgroundAsset("ring-void").id, "ring-void");
  assert.equal(bookendCharacterAsset("prince.determined").characterId, "prince");
  assert.throws(() => bookendBackgroundAsset("missing"), RangeError);
  assert.throws(() => bookendCharacterAsset("missing"), RangeError);
});
