import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import viteConfig, {
  collectReleasePublicAssets,
  isReleaseAssetBlocked,
  normalizeReleaseAssetPath,
} from "../vite.config.js";

const BLOCKED_RELEASE_ASSETS = Object.freeze([
  "assets/dungeon-stone.webp",
  "assets/evil-queen-portrait.webp",
  "assets/princess-portrait.webp",
  "assets/title-art.webp",
  "assets/sprites/enemy-archetypes.webp",
  "assets/sprites/foundry-decals.webp",
  "assets/sprites/keep-decals.webp",
  "assets/sprites/ossuary-decals.webp",
  "assets/sprites/princess-world.webp",
  "assets/sprites/queen-world.webp",
  "assets/sprites/void-court-decals.webp",
  "assets/vfx/combat-vfx.webp",
  "assets/menu/title-bg-01.png",
  "assets/menu/zephyr-c-title.png",
  "assets/vn/floor01-witch-projection-bg.png",
]);

test("release path validation rejects traversal and absolute paths", () => {
  assert.equal(normalizeReleaseAssetPath("assets/vn/backgrounds/ring-void.png"), "assets/vn/backgrounds/ring-void.png");
  for (const unsafePath of [
    "../secrets.txt",
    "assets/../../secrets.txt",
    "assets\\..\\secrets.txt",
    "/absolute/file.png",
    "C:\\absolute\\file.png",
    "assets//file.png",
    "assets/./file.png",
    "assets/\0file.png",
  ]) {
    assert.throws(() => normalizeReleaseAssetPath(unsafePath), /Release asset path/);
  }
});

test("release denylist excludes every retained blocked asset and future legacy WebPs in scoped folders", async () => {
  for (const relativePath of BLOCKED_RELEASE_ASSETS) {
    assert.equal(isReleaseAssetBlocked(relativePath), true, relativePath);
    await access(path.resolve("public", relativePath));
  }
  assert.equal(isReleaseAssetBlocked("assets/new-legacy-art.webp"), true);
  assert.equal(isReleaseAssetBlocked("assets/sprites/new-legacy-sprite.webp"), true);
  assert.equal(isReleaseAssetBlocked("assets/vfx/new-legacy-vfx.webp"), true);
  assert.equal(isReleaseAssetBlocked("assets/vn/backgrounds/dungeon-threshold.png"), false);
  assert.equal(isReleaseAssetBlocked("assets/models/characters/knight.glb"), false);
  assert.equal(isReleaseAssetBlocked("assets/LICENSES.md"), false);
});

test("release collector preserves allowed paths and skips denied files", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "rogue-release-assets-"));
  try {
    await mkdir(path.join(temporaryRoot, "assets", "vn"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "assets", "sprites"), { recursive: true });
    await writeFile(path.join(temporaryRoot, "assets", "LICENSES.md"), "licenses");
    await writeFile(path.join(temporaryRoot, "assets", "vn", "allowed.png"), "allowed");
    await writeFile(path.join(temporaryRoot, "assets", "sprites", "blocked.webp"), "blocked");

    const files = await collectReleasePublicAssets(temporaryRoot);
    assert.deepEqual(files.map(({ fileName }) => fileName), [
      "assets/LICENSES.md",
      "assets/vn/allowed.png",
    ]);
    assert.equal(files[1].source.toString(), "allowed");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Vite disables its broad public copy only for builds", () => {
  const buildConfig = viteConfig({ command: "build" });
  const serveConfig = viteConfig({ command: "serve" });
  assert.equal(buildConfig.publicDir, false);
  assert.equal(serveConfig.publicDir, "public");
  assert.equal(buildConfig.plugins.some((plugin) => plugin.name === "release-public-assets"), true);
});
