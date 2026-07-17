import assert from "node:assert/strict";
import test from "node:test";
import { generateArena, validateArena } from "../src/generation/arenaGenerator.js";
import { ARENA_LAYOUTS } from "../src/generation/arenaLayouts.js";
import { PORTAL_CONFIG } from "../src/game/gameConfig.js";

test("arena generation is deterministic for a seed and location", () => {
  const options = { seed: "CROWN-42", floor: 5, room: 2, boss: false };
  assert.deepEqual(generateArena(options), generateArena(options));
});

test("generated arenas keep the player, center portal, and enemy spawns connected", () => {
  for (let seedIndex = 0; seedIndex < 160; seedIndex += 1) {
    for (let floor = 1; floor <= 10; floor += 1) {
      const room = (seedIndex % 3) + 1;
      const arena = generateArena({
        seed: `SWEEP-${seedIndex}`,
        floor,
        room,
        boss: floor === 10 && room === 3,
      });
      assert.equal(validateArena(arena), true, `unreachable layout for seed ${seedIndex}, floor ${floor}, room ${room}`);
      assert.ok(arena.enemySpawnPoints.length >= 8, "arena should retain enough safe spawn positions");
      assert.ok(arena.obstacles.length > 0, "local repair should preserve at least one authored obstacle");
      assert.deepEqual(arena.portal, { x: 0, z: 0 });
      for (const obstacle of arena.obstacles) {
        const dx = Math.max(Math.abs(obstacle.x) - obstacle.width / 2, 0);
        const dz = Math.max(Math.abs(obstacle.z) - obstacle.depth / 2, 0);
        assert.ok(Math.hypot(dx, dz) >= PORTAL_CONFIG.clearanceRadius);
      }
      assert.ok(arena.rewardPosition);
      assert.ok(arena.combatZones.length > 0);
    }
  }
});

test("boss arena reserves a large central fighting space", () => {
  const arena = generateArena({ seed: "QUEEN", floor: 10, room: 3, boss: true });
  assert.equal(arena.boss, true);
  assert.ok(arena.width >= 34);
  assert.ok(arena.depth >= 24);
  assert.equal(arena.layoutFamily, "bossCourt");
  assert.ok(arena.obstacles.every((obstacle) => Math.hypot(obstacle.x, obstacle.z) > 4));
});

test("authored layout families produce larger rooms with deterministic combat zones", () => {
  const seen = new Set();
  for (let seedIndex = 0; seedIndex < 180; seedIndex += 1) {
    for (let floor = 1; floor <= 10; floor += 1) {
      const arena = generateArena({
        seed: `LAYOUT-${seedIndex}`,
        floor,
        room: (seedIndex % 3) + 1,
        boss: floor === 10 && seedIndex % 3 === 2,
      });
      seen.add(arena.layoutFamily);
      assert.ok(arena.width >= 34);
      assert.ok(arena.depth >= 24);
      assert.ok(arena.spawnGroups.every((group) => group.spawnIndices.length >= 4));
    }
  }
  assert.deepEqual(seen, new Set(Object.keys(ARENA_LAYOUTS)));
});

test("large seed sweeps repair blocked layouts locally instead of flattening the room", () => {
  for (let seedIndex = 0; seedIndex < 600; seedIndex += 1) {
    const floor = (seedIndex % 10) + 1;
    const room = (seedIndex % 3) + 1;
    const arena = generateArena({ seed: `REPAIR-${seedIndex}`, floor, room, boss: floor === 10 && room === 3 });
    assert.equal(validateArena(arena), true);
    assert.ok(arena.obstacles.length > 0);
  }
});
