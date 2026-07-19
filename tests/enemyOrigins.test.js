import assert from "node:assert/strict";
import test from "node:test";
import { EnemyDirector } from "../src/game/EnemyDirector.js";
import {
  createEncounterPlan,
  ENEMY_ORIGINS,
  princessOriginQuota,
} from "../src/game/encounterPatterns.js";
import { generateArena } from "../src/generation/arenaGenerator.js";
import { SeededRandom } from "../src/generation/seededRandom.js";
import {
  ENEMY_ORIGIN_VISUAL_PROFILES,
  getEnemyOriginVisualProfile,
} from "../src/rendering/enemyVisualProfiles.js";

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

test("origin planning is deterministic and keeps the pre-origin type sequence", () => {
  const fixtures = [
    ["ORIGIN-ROSTER", 8, 3, [
      ["reaver", "thrall", "reaver", "bombardier"],
      ["bombardier", "reaver", "hexer", "boneguard"],
      ["wraith", "thrall", "wraith"],
    ]],
    ["ORIGIN-EARLY", 2, 2, [
      ["thrall", "thrall", "thrall"],
      ["hexer", "reaver"],
    ]],
    ["ORIGIN-LATE", 10, 2, [
      ["bombardier", "thrall", "thrall", "thrall", "reaver", "bombardier"],
      ["bombardier", "hexer", "hexer", "reaver", "wraith"],
    ]],
  ];

  for (const [seed, floor, room, expectedTypes] of fixtures) {
    const first = encounter(seed, floor, room);
    const second = encounter(seed, floor, room);
    assert.deepEqual(first, second);
    assert.deepEqual(first.waves.map((wave) => wave.entries.map((entry) => entry.type)), expectedTypes);
  }
});

test("Princess quotas progress by floor while floor one remains entirely Witch-origin", () => {
  const expected = [
    [0, 0, 0],
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 2],
    [2, 2, 2],
    [2, 3, 3],
    [3, 4, 5],
    [4, 5, 6],
    [5, 6, 7],
    [7, 8, 0],
  ];

  for (let floor = 1; floor <= 10; floor += 1) {
    for (let room = 1; room <= 3; room += 1) {
      const plan = encounter(`ORIGIN-QUOTA-${floor}-${room}`, floor, room);
      const roster = entries(plan);
      assert.equal(
        roster.filter((entry) => entry.origin === ENEMY_ORIGINS.PRINCESS).length,
        expected[floor - 1][room - 1],
      );
      assert.equal(princessOriginQuota(floor, room, roster.length), expected[floor - 1][room - 1]);
      assert.ok(roster.every((entry) => Object.values(ENEMY_ORIGINS).includes(entry.origin)));
      assert.ok(roster.every((entry) => Number.isFinite(entry.originPhase)));
    }
  }
});

test("runtime enemies, projectiles, and combat events retain their origin", () => {
  const { director, events } = createDirector();
  const enemy = director.spawnEnemy("hexer", { x: 0, z: 0 }, 6, {
    origin: ENEMY_ORIGINS.PRINCESS,
    originPhase: 1.25,
  });
  assert.equal(enemy.origin, ENEMY_ORIGINS.PRINCESS);
  assert.equal(events.find((event) => event.type === "enemySpawned")?.detail.origin, ENEMY_ORIGINS.PRINCESS);

  const player = { position: { x: 9, z: 0 }, radius: 0.58 };
  enemy.attackCooldown = 0;
  director.update(1 / 60, player, () => {});
  const telegraph = events.find((event) => event.type === "enemyTelegraph");
  assert.equal(telegraph?.detail.enemyOrigin, ENEMY_ORIGINS.PRINCESS);
  director.update(telegraph.detail.duration + 0.01, player, () => {});
  assert.ok(director.projectiles.some((projectile) => projectile.active && projectile.origin === ENEMY_ORIGINS.PRINCESS));
  assert.equal(events.find((event) => event.type === "enemyAttack")?.detail.origin, ENEMY_ORIGINS.PRINCESS);

  director.resolveCombatHit(enemy, combatHit("origin-runtime-defeat", enemy.maxHealth, { x: -1, z: 0 }));
  assert.equal(events.find((event) => event.type === "enemyHit")?.detail.origin, ENEMY_ORIGINS.PRINCESS);
  assert.equal(events.find((event) => event.type === "enemyDefeated")?.detail.origin, ENEMY_ORIGINS.PRINCESS);
  assert.throws(
    () => director.spawnEnemy("thrall", { x: 0, z: 0 }, 1, { origin: "unknown" }),
    /Unknown enemy origin/,
  );
});

test("wave events report origin counts matching the spawned actors", () => {
  const events = [];
  const director = new EnemyDirector((type, detail) => events.push({ type, detail }));
  director.reset({
    arena,
    floor: 8,
    room: 3,
    rng: new SeededRandom("ORIGIN-WAVE"),
    difficulty,
  });
  const event = events.find((entry) => entry.type === "encounterWaveStarted");
  const actual = director.enemies.reduce((counts, enemy) => {
    counts[enemy.origin] += 1;
    return counts;
  }, { witch: 0, princess: 0 });
  assert.deepEqual(event.detail.originCounts, actual);
});

test("the boss and every boss summon are Witch-origin", () => {
  const { director, events } = createDirector("ORIGIN-BOSS");
  const queen = director.spawnEnemy("queen", { x: 0, z: 0 }, 10, { origin: ENEMY_ORIGINS.PRINCESS });
  director.summonQueenGuard(queen);
  assert.ok(director.enemies.every((enemy) => enemy.origin === ENEMY_ORIGINS.WITCH));
  assert.equal(events.find((event) => event.type === "queenSummon")?.detail.origin, ENEMY_ORIGINS.WITCH);
});

test("Witch-origin dismissal is idempotent and preserves Princess actors and magic", () => {
  const { director, events } = createDirector("ORIGIN-DISMISS");
  const witch = director.spawnEnemy("boneguard", { x: -2, z: 0 }, 8, { origin: ENEMY_ORIGINS.WITCH });
  const princess = director.spawnEnemy("wraith", { x: 2, z: 0 }, 8, { origin: ENEMY_ORIGINS.PRINCESS });
  const witchProjectile = director.spawnProjectile({ x: -2, z: 0 }, 0, 1, 1, 5, "violet", { origin: ENEMY_ORIGINS.WITCH });
  const princessProjectile = director.spawnProjectile({ x: 2, z: 0 }, 0, 1, 1, 5, "violet", { origin: ENEMY_ORIGINS.PRINCESS });
  director.pendingWaves = [{
    index: 1,
    delay: 0.6,
    entries: [
      { type: "thrall", origin: ENEMY_ORIGINS.WITCH },
      { type: "reaver", origin: ENEMY_ORIGINS.PRINCESS },
    ],
  }];

  const result = director.dismissWitchOrigin();
  assert.equal(witch.active, false);
  assert.equal(witch.dismissed, true);
  assert.equal(princess.active, true);
  assert.equal(witchProjectile.active, false);
  assert.equal(witchProjectile.origin, ENEMY_ORIGINS.WITCH);
  assert.equal(princessProjectile.active, true);
  assert.equal(princessProjectile.origin, ENEMY_ORIGINS.PRINCESS);
  assert.deepEqual(director.pendingWaves[0].entries.map((entry) => entry.origin), [ENEMY_ORIGINS.PRINCESS]);
  assert.deepEqual({ actors: result.actors.length, projectiles: result.projectiles, pendingEntries: result.pendingEntries }, {
    actors: 1,
    projectiles: 1,
    pendingEntries: 1,
  });
  assert.equal(events.filter((event) => event.type === "enemyDefeated").length, 0);
  assert.equal(events.filter((event) => event.type === "witchOriginDismissed").length, 1);
  assert.equal(director.dismissWitchOrigin(), null);
  assert.equal(events.filter((event) => event.type === "witchOriginDismissed").length, 1);
});

test("boss cleanup waits for the narrative cue and dismisses surviving Witch summons without defeat events", () => {
  const { director, events } = createDirector("ORIGIN-BOSS-CLEANUP");
  const queen = director.spawnEnemy("queen", { x: 0, z: 0 }, 10, { origin: ENEMY_ORIGINS.WITCH });
  const guard = director.spawnEnemy("thrall", { x: 3, z: 0 }, 10, { origin: ENEMY_ORIGINS.WITCH });
  director.resolveCombatHit(queen, combatHit("origin-boss-defeat", queen.maxHealth, { x: -1, z: 0 }));
  assert.equal(guard.active, true);
  assert.equal(events.filter((event) => event.type === "witchOriginDismissed").length, 0);
  director.dismissWitchOrigin();
  assert.equal(guard.active, false);
  assert.equal(guard.dismissed, true);
  assert.deepEqual(events.filter((event) => event.type === "enemyDefeated").map((event) => event.detail.id), [queen.id]);
  assert.equal(events.filter((event) => event.type === "witchOriginDismissed").length, 1);
});

test("origin presentation profiles are immutable and distinct across both render paths", () => {
  const witch = getEnemyOriginVisualProfile(ENEMY_ORIGINS.WITCH);
  const princess = getEnemyOriginVisualProfile(ENEMY_ORIGINS.PRINCESS);
  assert.ok(Object.isFrozen(ENEMY_ORIGIN_VISUAL_PROFILES));
  assert.ok(Object.isFrozen(witch));
  assert.ok(Object.isFrozen(princess));
  assert.notEqual(witch.color, princess.color);
  assert.equal(witch.sway, 0);
  assert.ok(princess.sway > witch.sway);
  assert.ok(princess.pulseAmount > witch.pulseAmount);
  assert.throws(() => getEnemyOriginVisualProfile("unknown"), RangeError);
});
