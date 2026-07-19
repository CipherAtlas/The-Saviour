import assert from "node:assert/strict";
import test from "node:test";
import { joinPublicAssetUrl, publicAssetUrl } from "../src/publicAssetUrl.js";

test("public asset URLs keep root-relative paths outside a Vite build", () => {
  assert.equal(publicAssetUrl("assets/models/characters/knight.glb"), "/assets/models/characters/knight.glb");
});

test("public asset URLs respect a GitHub Pages project base", () => {
  assert.equal(
    joinPublicAssetUrl("/The-Saviour/", "/assets/vn/backgrounds/dungeon-threshold.png"),
    "/The-Saviour/assets/vn/backgrounds/dungeon-threshold.png",
  );
  assert.equal(joinPublicAssetUrl("/The-Saviour", "assets/audio/music/unlight.mp3"), "/The-Saviour/assets/audio/music/unlight.mp3");
});

test("public asset URLs reject missing paths", () => {
  assert.throws(() => joinPublicAssetUrl("/The-Saviour/", ""), /non-empty strings/);
});
