import assert from "node:assert/strict";
import test from "node:test";
import { generateArena } from "../src/generation/arenaGenerator.js";
import { BIOMES } from "../src/generation/biomes.js";

test("seeded arenas keep biome and prop generation deterministic", () => {
  const first = generateArena({ seed: "BIOME-CHECK", floor: 7, room: 2 });
  const second = generateArena({ seed: "BIOME-CHECK", floor: 7, room: 2 });
  assert.deepEqual(first, second);
  assert.ok(BIOMES[first.biome]);
  assert.ok(first.props.length >= 8);
});

test("all biome bands appear across a complete set of deterministic runs", () => {
  const encountered = new Set();
  for (let floor = 1; floor <= 10; floor += 1) {
    for (let room = 1; room <= 3; room += 1) {
      encountered.add(generateArena({ seed: `BAND-${floor}`, floor, room, boss: floor === 10 && room === 3 }).biome);
    }
  }
  assert.deepEqual(encountered, new Set(Object.keys(BIOMES)));
});

test("each biome exposes a distinct encounter and layout gameplay identity", () => {
  const identities = new Set();
  const encounterSignatures = new Set();
  const layoutSignatures = new Set();
  for (const biome of Object.values(BIOMES)) {
    identities.add(biome.gameplay.identity);
    encounterSignatures.add(JSON.stringify(biome.gameplay.encounterBias));
    layoutSignatures.add(JSON.stringify(biome.gameplay.layoutWeights));
    assert.ok(Object.values(biome.gameplay.encounterBias).every((weight) => weight > 0));
    assert.ok(Object.values(biome.gameplay.layoutWeights).every((weight) => weight > 0));
  }
  assert.equal(identities.size, Object.keys(BIOMES).length);
  assert.equal(encounterSignatures.size, Object.keys(BIOMES).length);
  assert.equal(layoutSignatures.size, Object.keys(BIOMES).length);
});

test("environment models never alternate between blocking obstacles and collisionless props", () => {
  const obstacleModels = new Set(Object.values(BIOMES).flatMap((biome) => biome.obstacleModels));
  const propModels = new Set(Object.values(BIOMES).flatMap((biome) => biome.propModels));
  const conflictingModels = [...obstacleModels].filter((modelKey) => propModels.has(modelKey));

  assert.deepEqual(conflictingModels, []);
});
