import assert from "node:assert/strict";
import test from "node:test";
import { createWalkableShape, isCircleWalkable } from "../src/game/arenaGeometry.js";
import { moveCircle, separateCircles } from "../src/game/collision.js";
import { EnemyDirector } from "../src/game/EnemyDirector.js";
import { ENEMY_EMERGENCE } from "../src/game/encounterContracts.js";
import { DIFFICULTY } from "../src/game/gameConfig.js";
import { findNavigationPath, hasLineOfSight } from "../src/game/navigation.js";
import { generateArena } from "../src/generation/arenaGenerator.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

const arena = {
  width: 32,
  depth: 28,
  walkableShape: createWalkableShape({
    regions: [
      { id: "stem", role: "combat", x: -6, z: 0, width: 10, depth: 26 },
      { id: "arm", role: "combat", x: 4, z: 8, width: 20, depth: 10 },
    ],
    majorRegionIds: ["stem", "arm"],
    connectors: [{ id: "turn", from: "stem", to: "arm", width: 10 }],
  }),
  obstacles: [],
};

test("movement and navigation cannot cross a concave exterior void", () => {
  const start = { x: -6, z: -8 };
  const destination = { x: 9, z: 8 };
  const moved = moveCircle(start, { x: 30, z: 0 }, 1, 0.58, arena);
  assert.ok(moved.x < 0, `actor crossed into exterior void at ${JSON.stringify(moved)}`);
  assert.equal(isCircleWalkable(arena, moved, 0.58), true);
  assert.equal(hasLineOfSight(start, destination, arena, 0.58), false);
  const path = findNavigationPath(start, destination, arena, { padding: 0.58, cellSize: 1 });
  assert.ok(path.length > 2);
  assert.ok(path.every((point) => isCircleWalkable(arena, point, 0.58)));
});

test("actor separation at a concave corner never pushes an actor into void", () => {
  const actors = [
    { id: 1, active: true, position: { x: -0.7, z: 3.9 }, radius: 0.58 },
    { id: 2, active: true, position: { x: -0.4, z: 4.1 }, radius: 0.58 },
  ];
  separateCircles(actors, arena);
  assert.ok(actors.every((actor) => isCircleWalkable(arena, actor.position, actor.radius)));
});

test("scheduled enemies remain immovable, harmless, non-blocking, and invulnerable throughout emergence", () => {
  const generated = generateArena({ seed: "VERTICAL-SLICE-L", floor: 4, room: 2 });
  const events = [];
  const director = new EnemyDirector((type, detail) => events.push({ type, detail }));
  director.reset({
    arena: generated,
    floor: 4,
    room: 2,
    rng: new SeededRandom("VERTICAL-SLICE-L").fork("encounter-4-2"),
    difficulty: DIFFICULTY.standard,
  });
  const player = {
    position: { ...generated.playerSpawn },
    previousPosition: { ...generated.playerSpawn },
    radius: 0.58,
  };
  const initial = director.enemies.map((enemy) => ({ ...enemy.position }));
  const target = director.enemies[0];
  const health = target.health;
  const rejected = director.resolveCombatHit(target, {
    damage: health,
    direction: { x: 1, z: 0 },
    knockback: 12,
    poiseDamage: target.maxPoise,
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "emerging");
  assert.equal(target.health, health);

  director.update(ENEMY_EMERGENCE.durationSeconds - 0.01, player, () => {
    assert.fail("emerging enemies cannot deal damage");
  });
  assert.deepEqual(director.enemies.map((enemy) => enemy.position), initial);
  assert.equal(director.attackCoordinator.snapshot().leases.length, 0);
  assert.ok(director.enemies.every((enemy) => !director.isEnemyInteractive(enemy)));

  director.update(0.02, player, () => {});
  assert.ok(director.enemies.every((enemy) => director.isEnemyInteractive(enemy)));
  assert.equal(events.filter(({ type }) => type === "enemyEmergenceCompleted").length, director.enemies.length);
});

test("adjacent reinforcement placement preserves the response window without collision overlap", () => {
  const generated = generateArena({ seed: "ADJACENT-SPAWN", floor: 2, room: 1 });
  const director = new EnemyDirector(() => {});
  director.arena = generated;
  director.currentPlayer = { position: { ...generated.playerSpawn }, radius: 0.58 };
  const radius = 0.62;
  const point = director.findSpawnPoint(generated.playerSpawn, radius, 0.4);
  const distance = Math.hypot(point.x - generated.playerSpawn.x, point.z - generated.playerSpawn.z);
  assert.ok(distance >= radius + 0.58 + 0.08 - 1e-6);
  assert.ok(distance < radius + 0.58 + 1.1, `spawn was unnecessarily pushed away: ${distance}`);
  assert.equal(isCircleWalkable(generated, point, radius + 0.08), true);
});

test("kill-threshold reinforcements spawn immediately while the player remains outside every combat zone", () => {
  const generated = generateArena({ seed: "VERTICAL-SLICE-L", floor: 4, room: 2 });
  const events = [];
  const director = new EnemyDirector((type, detail) => events.push({ type, detail }));
  director.reset({
    arena: generated,
    floor: 4,
    room: 2,
    rng: new SeededRandom("VERTICAL-SLICE-L").fork("encounter-4-2"),
    difficulty: DIFFICULTY.standard,
  });
  const player = {
    position: { ...generated.playerSpawn },
    previousPosition: { ...generated.playerSpawn },
    radius: 0.58,
  };
  assert.ok(generated.combatZones.every((zone) => (
    Math.hypot(player.position.x - zone.x, player.position.z - zone.z) > zone.radius
  )));

  const reinforcementBatch = director.encounterPlan.batches[1];
  assert.equal(reinforcementBatch.trigger.type, "remaining");
  const sourceBatch = director.encounterPlan.batches[0];
  const killsToTrigger = sourceBatch.entries.length - reinforcementBatch.trigger.remainingCount;
  director.update(ENEMY_EMERGENCE.durationSeconds, player, () => {});
  const initialEnemyCount = director.enemies.length;
  director.update(10, player, () => {});
  assert.equal(director.enemies.length, initialEnemyCount);
  for (const enemy of director.enemies.slice(0, killsToTrigger)) {
    director.resolveCombatHit(enemy, {
      damage: enemy.maxHealth * 3,
      direction: { x: 1, z: 0 },
      knockback: 0,
      poiseDamage: 0,
    });
  }

  assert.deepEqual(player.position, generated.playerSpawn);
  assert.ok(director.enemies.length > initialEnemyCount);
  assert.ok(events.some(({ type, detail }) => (
    type === "encounterBatchTriggered" && detail.batchId === reinforcementBatch.id
  )));
  assert.ok(events.some(({ type, detail }) => (
    type === "enemyEmergenceStarted" && detail.batchId === reinforcementBatch.id
  )));
});

test("clearing the current field releases the next reserve without an empty delay", () => {
  const generated = generateArena({ seed: "VERTICAL-SLICE-L", floor: 4, room: 2 });
  const director = new EnemyDirector(() => {});
  director.reset({
    arena: generated,
    floor: 4,
    room: 2,
    rng: new SeededRandom("VERTICAL-SLICE-L").fork("encounter-4-2"),
    difficulty: DIFFICULTY.standard,
  });
  const player = { position: { ...generated.playerSpawn }, previousPosition: { ...generated.playerSpawn }, radius: 0.58 };
  director.update(ENEMY_EMERGENCE.durationSeconds, player, () => {});
  const initialEnemies = [...director.enemies];
  for (const enemy of initialEnemies) {
    if (!director.isEnemyInteractive(enemy)) continue;
    director.resolveCombatHit(enemy, {
      damage: enemy.maxHealth * 3,
      direction: { x: 1, z: 0 },
      knockback: 0,
      poiseDamage: 0,
    });
  }
  assert.equal(director.encounterPlan.type, "populationPressure");
  assert.ok(director.enemies.length > initialEnemies.length);
  assert.equal(director.hasLivingEnemies(), true);
  assert.equal(director.hasCombatRemaining(), true);
  assert.ok(director.encounterScheduler.snapshot().spawning > 0);
});

test("direct projectiles despawn at the actual concave silhouette instead of crossing exterior void", () => {
  const director = new EnemyDirector(() => {});
  director.arena = arena;
  director.difficulty = DIFFICULTY.standard;
  director.rng = new SeededRandom("PROJECTILE-SILHOUETTE");
  const projectile = director.spawnProjectile(
    { x: -2, z: -8 },
    0,
    14,
    10,
    2,
    "violet",
    { radius: 0.2 },
  );
  director.updateProjectiles(0.3, { position: { x: -6, z: 8 }, radius: 0.58 }, () => {});
  assert.equal(projectile.active, false);
});
