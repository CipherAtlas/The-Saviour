import assert from "node:assert/strict";
import test from "node:test";
import { EnemyDirector } from "../src/game/EnemyDirector.js";
import { createEncounterPlan, ENEMY_ORIGINS, volatileOriginQuota } from "../src/game/encounterPatterns.js";
import { generateArena } from "../src/generation/arenaGenerator.js";
import { SeededRandom } from "../src/generation/seededRandom.js";
import { ENEMY_ORIGIN_VISUAL_PROFILES, getEnemyOriginVisualProfile } from "../src/rendering/enemyVisualProfiles.js";

const difficulty = Object.freeze({ enemyHealth: 1, enemyDamage: 1, enemySpeed: 1 });
const arena = Object.freeze({
  width: 28,
  depth: 20,
  boss: false,
  biome: "forgottenKeep",
  obstacles: Object.freeze([]),
  enemySpawnPoints: Object.freeze([
    Object.freeze({ x: -7, z: -4 }),
    Object.freeze({ x: 7, z: -4 }),
    Object.freeze({ x: -7, z: 4 }),
    Object.freeze({ x: 7, z: 4 }),
    Object.freeze({ x: 0, z: 6 }),
  ]),
});

function encounter(seed, floor, room) {
  const generated = generateArena({ seed, floor, room, boss: false });
  return createEncounterPlan({
    floor,
    room,
    biome: generated.biome,
    spawnPoints: generated.enemySpawnPoints,
    rng: new SeededRandom(`${seed}:plan`),
  });
}

function entries(plan) {
  return plan.waves.flatMap((wave) => wave.entries);
}

function createDirector(seed = "ORIGIN-DIRECTOR") {
  const events = [];
  const director = new EnemyDirector((type, detail) => events.push({ type, detail }));
  director.arena = arena;
  director.rng = new SeededRandom(seed);
  director.difficulty = difficulty;
  return { director, events };
}

function combatHit(actionId, damage, sourcePosition) {
  return Object.freeze({
    actionId,
    damage,
    critical: false,
    direction: Object.freeze({ x: 1, z: 0 }),
    knockback: 0,
    poiseDamage: 0,
    pullStrength: 0,
    sourcePosition: Object.freeze({ ...sourcePosition }),
    origin: "player",
  });
}

test("variant planning is deterministic and keeps the enemy type sequence", () => {
  for (const [seed, floor, room] of [["ORIGIN-ROSTER", 8, 3], ["ORIGIN-EARLY", 2, 2], ["ORIGIN-LATE", 10, 2]]) {
    assert.deepEqual(encounter(seed, floor, room), encounter(seed, floor, room));
  }
});

test("volatile quotas rise through the run while floor one stays stable", () => {
  const expected = [
    [0, 0, 0], [0, 1, 1], [1, 1, 1], [1, 1, 2], [2, 2, 2],
    [2, 3, 3], [3, 4, 5], [4, 5, 6], [5, 6, 7], [7, 8, 0],
  ];
  for (let floor = 1; floor <= 10; floor += 1) {
    for (let room = 1; room <= 3; room += 1) {
      const roster = entries(encounter(`ORIGIN-QUOTA-${floor}-${room}`, floor, room));
      assert.equal(roster.filter(({ origin }) => origin === ENEMY_ORIGINS.VOLATILE).length, expected[floor - 1][room - 1]);
      assert.equal(volatileOriginQuota(floor, room, roster.length), expected[floor - 1][room - 1]);
      assert.ok(roster.every(({ origin }) => Object.values(ENEMY_ORIGINS).includes(origin)));
    }
  }
});

test("runtime enemies, projectiles, and combat events retain their variant", () => {
  const { director, events } = createDirector();
  const enemy = director.spawnEnemy("hexer", { x: 0, z: 0 }, 6, { origin: ENEMY_ORIGINS.VOLATILE, originPhase: 1.25 });
  const player = { position: { x: 9, z: 0 }, radius: 0.58 };
  enemy.attackCooldown = 0;
  director.update(1 / 60, player, () => {});
  const telegraph = events.find(({ type }) => type === "enemyTelegraph");
  director.update(telegraph.detail.duration + 0.01, player, () => {});
  assert.equal(telegraph.detail.enemyOrigin, ENEMY_ORIGINS.VOLATILE);
  assert.ok(director.projectiles.some(({ active, origin }) => active && origin === ENEMY_ORIGINS.VOLATILE));
  director.resolveCombatHit(enemy, combatHit("variant-defeat", enemy.maxHealth, { x: -1, z: 0 }));
  assert.equal(events.find(({ type }) => type === "enemyDefeated")?.detail.origin, ENEMY_ORIGINS.VOLATILE);
});

test("the boss and its summons always use the stable variant", () => {
  const { director, events } = createDirector("ORIGIN-BOSS");
  const queen = director.spawnEnemy("queen", { x: 0, z: 0 }, 10, { origin: ENEMY_ORIGINS.VOLATILE });
  director.summonQueenGuard(queen);
  assert.ok(director.enemies.every(({ origin }) => origin === ENEMY_ORIGINS.STABLE));
  assert.equal(events.find(({ type }) => type === "queenSummon")?.detail.origin, ENEMY_ORIGINS.STABLE);
});

test("stable dismissal is idempotent and preserves volatile actors and magic", () => {
  const { director, events } = createDirector("ORIGIN-DISMISS");
  const stable = director.spawnEnemy("boneguard", { x: -2, z: 0 }, 8, { origin: ENEMY_ORIGINS.STABLE });
  const volatile = director.spawnEnemy("wraith", { x: 2, z: 0 }, 8, { origin: ENEMY_ORIGINS.VOLATILE });
  const stableProjectile = director.spawnProjectile({ x: -2, z: 0 }, 0, 1, 1, 5, "violet", { origin: ENEMY_ORIGINS.STABLE });
  const volatileProjectile = director.spawnProjectile({ x: 2, z: 0 }, 0, 1, 1, 5, "violet", { origin: ENEMY_ORIGINS.VOLATILE });
  const result = director.dismissStableOrigin();
  assert.deepEqual({ stable: stable.active, volatile: volatile.active, stableProjectile: stableProjectile.active, volatileProjectile: volatileProjectile.active }, {
    stable: false, volatile: true, stableProjectile: false, volatileProjectile: true,
  });
  assert.equal(result.actors.length, 1);
  assert.equal(events.filter(({ type }) => type === "stableOriginDismissed").length, 1);
  assert.equal(director.dismissStableOrigin(), null);
});

test("variant presentation profiles are immutable and distinct", () => {
  const stable = getEnemyOriginVisualProfile(ENEMY_ORIGINS.STABLE);
  const volatile = getEnemyOriginVisualProfile(ENEMY_ORIGINS.VOLATILE);
  assert.ok(Object.isFrozen(ENEMY_ORIGIN_VISUAL_PROFILES));
  assert.ok(Object.isFrozen(stable));
  assert.ok(Object.isFrozen(volatile));
  assert.notEqual(stable.color, volatile.color);
  assert.equal(stable.sway, 0);
  assert.ok(volatile.sway > stable.sway);
  assert.ok(volatile.pulseAmount > stable.pulseAmount);
});
