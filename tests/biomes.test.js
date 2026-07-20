import assert from "node:assert/strict";
import test from "node:test";
import { generateArena } from "../src/generation/arenaGenerator.js";
import {
  BIOMES,
  chooseEnvironmentTheme,
  ENVIRONMENT_THEMES,
  ENVIRONMENT_THEME_IDS,
  getEnvironmentTheme,
} from "../src/generation/biomes.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

test("seeded arenas keep cosmetic environment selection and prop generation deterministic", () => {
  const first = generateArena({ seed: "THEME-CHECK", floor: 7, room: 2 });
  const second = generateArena({ seed: "THEME-CHECK", floor: 7, room: 2 });
  assert.deepEqual(first, second);
  assert.ok(ENVIRONMENT_THEMES[first.environmentTheme]);
  assert.equal(first.biome, first.environmentTheme);
  assert.ok(first.props.length >= 8);
});

test("environment themes are selected from one global pool without floor progression", () => {
  const first = chooseEnvironmentTheme(new SeededRandom("GLOBAL-THEME"));
  const same = chooseEnvironmentTheme(new SeededRandom("GLOBAL-THEME"));
  assert.equal(first, same);

  const encountered = new Set();
  for (let seedIndex = 0; seedIndex < 80; seedIndex += 1) {
    encountered.add(chooseEnvironmentTheme(new SeededRandom(`THEME-${seedIndex}`)).id);
  }
  assert.deepEqual(encountered, new Set(ENVIRONMENT_THEME_IDS));
});

test("environment themes expose presentation assets but no mechanical gameplay contract", () => {
  assert.equal(BIOMES, ENVIRONMENT_THEMES);
  for (const theme of Object.values(ENVIRONMENT_THEMES)) {
    assert.equal("gameplay" in theme, false);
    assert.ok(theme.floorModel);
    assert.ok(theme.wallModel);
    assert.ok(theme.obstacleModels.length > 0);
    assert.ok(theme.propModels.length > 0);
    assert.ok(theme.palette.accent > 0);
    assert.equal(getEnvironmentTheme(theme.id), theme);
  }
});

test("environment theme asset bundles remain visually distinct", () => {
  const fingerprints = new Set(Object.values(ENVIRONMENT_THEMES).map((theme) => JSON.stringify({
    floorModel: theme.floorModel,
    wallModel: theme.wallModel,
    decal: theme.decal,
    palette: theme.palette,
  })));
  assert.equal(fingerprints.size, ENVIRONMENT_THEME_IDS.length);
});

test("environment models never alternate between blocking obstacles and collisionless props", () => {
  const obstacleModels = new Set(Object.values(ENVIRONMENT_THEMES).flatMap((theme) => theme.obstacleModels));
  const propModels = new Set(Object.values(ENVIRONMENT_THEMES).flatMap((theme) => theme.propModels));
  const conflictingModels = [...obstacleModels].filter((modelKey) => propModels.has(modelKey));
  assert.deepEqual(conflictingModels, []);
});
