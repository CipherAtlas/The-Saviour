import assert from "node:assert/strict";
import test from "node:test";
import {
  getPerimeterWallSegments,
  isCircleWalkable,
  isPointWalkable,
  walkableArea,
} from "../src/game/arenaGeometry.js";
import {
  arenaContainsOnlyWalkableContent,
  generateArena,
  reachableCells,
  validateArena,
} from "../src/generation/arenaGenerator.js";
import {
  ARENA_LAYOUTS,
  chooseArenaLayout,
  NORMAL_ARENA_LAYOUT_IDS,
} from "../src/generation/arenaLayouts.js";
import { PORTAL_CONFIG } from "../src/game/gameConfig.js";

const SIZE_BANDS = Object.freeze([
  { floors: [1, 3], width: [40, 48], depth: [30, 38] },
  { floors: [4, 6], width: [46, 56], depth: [34, 44] },
  { floors: [7, 10], width: [54, 66], depth: [40, 50] },
]);

function bandForFloor(floor) {
  return SIZE_BANDS.find((band) => floor >= band.floors[0] && floor <= band.floors[1]);
}

function silhouetteSignature(arena) {
  const samples = [];
  for (let row = 0; row < 13; row += 1) {
    const z = -arena.depth / 2 + (row / 12) * arena.depth;
    for (let column = 0; column < 17; column += 1) {
      const x = -arena.width / 2 + (column / 16) * arena.width;
      samples.push(isPointWalkable(arena, { x, z }) ? "1" : "0");
    }
  }
  return samples.join("");
}

function shapeBounds(arena) {
  const bounds = arena.walkableShape.regions.map((region) => ({
    minX: region.x - region.width / 2,
    maxX: region.x + region.width / 2,
    minZ: region.z - region.depth / 2,
    maxZ: region.z + region.depth / 2,
  }));
  return {
    width: Math.max(...bounds.map((entry) => entry.maxX)) - Math.min(...bounds.map((entry) => entry.minX)),
    depth: Math.max(...bounds.map((entry) => entry.maxZ)) - Math.min(...bounds.map((entry) => entry.minZ)),
  };
}

test("arena generation is deterministic for a seed and location", () => {
  const options = { seed: "CROWN-42", floor: 5, room: 2, boss: false };
  assert.deepEqual(generateArena(options), generateArena(options));
});

test("the global layout pool is equal-weighted, deterministic, and avoids adjacent repetition", () => {
  for (const seed of ["POOL-A", "POOL-B", "POOL-C"]) {
    const sequence = [];
    for (let routeIndex = 0; routeIndex < 30; routeIndex += 1) {
      const floor = Math.floor(routeIndex / 3) + 1;
      const room = (routeIndex % 3) + 1;
      sequence.push(chooseArenaLayout({ seed, floor, room, boss: false }).id);
    }
    assert.deepEqual(new Set(sequence.slice(0, 8)), new Set(NORMAL_ARENA_LAYOUT_IDS));
    assert.deepEqual(new Set(sequence.slice(8, 16)), new Set(NORMAL_ARENA_LAYOUT_IDS));
    assert.ok(sequence.every((family, index) => index === 0 || family !== sequence[index - 1]));

    const repeat = Array.from({ length: 30 }, (_unused, routeIndex) => chooseArenaLayout({
      seed,
      floor: Math.floor(routeIndex / 3) + 1,
      room: (routeIndex % 3) + 1,
      boss: false,
    }).id);
    assert.deepEqual(sequence, repeat);
  }
});

test("all eight normal families have distinct authoritative non-rectangular silhouettes", () => {
  const representatives = new Map();
  for (let routeIndex = 0; routeIndex < 8; routeIndex += 1) {
    const floor = Math.floor(routeIndex / 3) + 1;
    const room = (routeIndex % 3) + 1;
    const arena = generateArena({ seed: "FAMILY-CYCLE", floor, room });
    representatives.set(arena.layoutFamily, arena);
  }

  assert.deepEqual(new Set(representatives.keys()), new Set(NORMAL_ARENA_LAYOUT_IDS));
  assert.equal(new Set([...representatives.values()].map(silhouetteSignature)).size, NORMAL_ARENA_LAYOUT_IDS.length);
  for (const [family, arena] of representatives) {
    assert.equal(arena.walkableShape.kind, "regionUnion", family);
    assert.ok(arena.walkableShape.regions.length >= 2, family);
    assert.ok(walkableArea(arena) < arena.width * arena.depth * 0.96, `${family} must not be a disguised rectangle`);
    assert.ok(getPerimeterWallSegments(arena).length >= 6, family);
    assert.deepEqual(shapeBounds(arena), { width: arena.width, depth: arena.depth });
    assert.ok(arena.walkableShape.connectors.every((entry) => entry.width >= 8), family);
    for (const regionId of arena.walkableShape.majorRegionIds) {
      const region = arena.walkableShape.regions.find((entry) => entry.id === regionId);
      assert.ok(Math.min(region.width, region.depth) >= 12, `${family}:${regionId} is too narrow for combat`);
    }
  }
});

test("normal arenas use larger floor bands and room-scaled complexity", () => {
  for (let floor = 1; floor <= 10; floor += 1) {
    for (let room = 1; room <= 3; room += 1) {
      if (floor === 10 && room === 3) continue;
      const arena = generateArena({ seed: `BAND-${floor}`, floor, room });
      const band = bandForFloor(floor);
      assert.ok(arena.width >= band.width[0] && arena.width <= band.width[1], `${floor}-${room}:width`);
      assert.ok(arena.depth >= band.depth[0] && arena.depth <= band.depth[1], `${floor}-${room}:depth`);
      assert.equal(arena.layoutComplexity, room);
      assert.ok(arena.obstacles.length >= 2 && arena.obstacles.length <= 8);
      assert.equal("hazards" in arena, false);
      assert.equal("elevation" in arena, false);
      assert.equal("destructibles" in arena, false);
    }
  }
});

test("generated objectives, combat zones, props, and distributed spawns respect the silhouette", () => {
  for (let seedIndex = 0; seedIndex < 48; seedIndex += 1) {
    const floor = (seedIndex % 10) + 1;
    const room = (seedIndex % 3) + 1;
    const boss = floor === 10 && room === 3;
    const arena = generateArena({ seed: `CONTENT-${seedIndex}`, floor, room, boss });
    const context = `seed CONTENT-${seedIndex}, floor ${floor}, room ${room}, layout ${arena.layoutFamily}`;
    assert.equal(validateArena(arena), true, context);
    assert.equal(arenaContainsOnlyWalkableContent(arena), true, context);
    assert.equal(isCircleWalkable(arena, arena.playerSpawn, 0.58), true, context);
    assert.equal(isCircleWalkable(arena, arena.portal, PORTAL_CONFIG.clearanceRadius), true, context);
    assert.equal(isCircleWalkable(arena, arena.rewardPosition, 1.15), true, context);
    assert.ok(arena.enemySpawnPoints.length >= (boss ? 14 : 20), context);
    assert.ok(arena.enemySpawnPoints.some(
      (spawn) => Math.hypot(spawn.x - arena.playerSpawn.x, spawn.z - arena.playerSpawn.z) < 7,
    ), `${context}: spawn pool must permit nearby reinforcement pressure`);
    assert.ok(arena.enemySpawnPoints.every(
      (spawn) => Math.hypot(spawn.x - arena.playerSpawn.x, spawn.z - arena.playerSpawn.z) >= 1.42,
    ), `${context}: spawn point overlaps the player`);
    assert.ok(arena.spawnGroups.every((group) => group.spawnIndices.length >= 4), context);
    assert.ok(reachableCells(arena).size > 0, context);
  }
});

test("the Witch court preserves a large open central fighting space", () => {
  const arena = generateArena({ seed: "QUEEN", floor: 10, room: 3, boss: true });
  assert.equal(arena.boss, true);
  assert.ok(arena.width >= 56);
  assert.ok(arena.depth >= 42);
  assert.equal(arena.layoutFamily, "bossCourt");
  assert.equal(arena.walkableShape.regions.length, 1);
  assert.equal(isCircleWalkable(arena, { x: 0, z: 1 }, 9.5), true);
  assert.ok(arena.obstacles.every((obstacle) => Math.hypot(obstacle.x, obstacle.z) > 10));
});

test("bounded generation sweep reports reproducible context and retains authored cover", () => {
  const seen = new Set();
  for (let seedIndex = 0; seedIndex < 120; seedIndex += 1) {
    const floor = (seedIndex % 10) + 1;
    const room = (Math.floor(seedIndex / 10) % 3) + 1;
    const boss = floor === 10 && room === 3;
    const seed = `REFINEMENT-SWEEP-${seedIndex}`;
    const arena = generateArena({ seed, floor, room, boss });
    const context = `seed ${seed}, floor ${floor}, room ${room}, layout ${arena.layoutFamily}`;
    seen.add(arena.layoutFamily);
    assert.equal(validateArena(arena), true, context);
    assert.ok(arena.obstacles.length >= 2, context);
    assert.ok(arena.enemySpawnPoints.length >= (boss ? 14 : 20), context);
  }
  assert.deepEqual(seen, new Set(Object.keys(ARENA_LAYOUTS)));
});
