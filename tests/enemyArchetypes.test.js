import assert from "node:assert/strict";
import test from "node:test";
import {
  ENEMY_ARCHETYPES,
  NON_BOSS_ARCHETYPE_IDS,
  PROJECTILE_KINDS,
  encounterWeightsForFloor,
  getEnemyArchetype,
} from "../src/game/enemyArchetypes.js";
import { EnemyDirector } from "../src/game/EnemyDirector.js";
import { queenActionFamily, QUEEN_HAZARD_CAP, QUEEN_SUMMON_CAP } from "../src/game/bossPatterns.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

const difficulty = Object.freeze({ enemyHealth: 1, enemyDamage: 1, enemySpeed: 1 });
const arena = Object.freeze({
  width: 28,
  depth: 20,
  boss: false,
  obstacles: [],
  enemySpawnPoints: Object.freeze([
    Object.freeze({ x: -7, z: -4 }),
    Object.freeze({ x: 7, z: -4 }),
    Object.freeze({ x: -7, z: 4 }),
    Object.freeze({ x: 7, z: 4 }),
    Object.freeze({ x: 0, z: 6 }),
  ]),
});

function createDirector(seed = "ENEMY-TEST") {
  const events = [];
  const director = new EnemyDirector((type, detail) => events.push({ type, detail }));
  director.arena = arena;
  director.rng = new SeededRandom(seed);
  director.difficulty = difficulty;
  return { director, events };
}

function simulateTelegraph(type, seed = "TELEGRAPH-TEST") {
  const { director, events } = createDirector(seed);
  const enemy = director.spawnEnemy(type, { x: 0, z: 0 }, 6);
  enemy.attackCooldown = 0;
  const player = { position: { x: 2, z: 0 }, radius: 0.58 };
  director.update(1 / 60, player, () => {});
  return events.find((event) => event.type === "enemyTelegraph");
}

test("six non-boss archetypes expose unique model and behavior contracts", () => {
  assert.equal(NON_BOSS_ARCHETYPE_IDS.length, 6);
  assert.equal(new Set(NON_BOSS_ARCHETYPE_IDS.map((type) => getEnemyArchetype(type).modelKey)).size, 6);
  assert.equal(new Set(NON_BOSS_ARCHETYPE_IDS.map((type) => getEnemyArchetype(type).behavior)).size, 6);
  assert.equal(ENEMY_ARCHETYPES.queen.behavior, "bossPhases");
  assert.ok(NON_BOSS_ARCHETYPE_IDS.every((type) => Object.keys(getEnemyArchetype(type).attacks).length >= 2));
});

test("floor weighting unlocks categories progressively without an empty encounter table", () => {
  for (let floor = 1; floor <= 10; floor += 1) {
    const weights = encounterWeightsForFloor(floor);
    assert.ok(weights.some((entry) => entry.weight > 0));
    for (const entry of weights) {
      const definition = getEnemyArchetype(entry.value);
      assert.equal(entry.weight > 0, floor >= definition.unlockFloor);
    }
  }
});

test("every archetype emits a renderer-ready telegraph geometry contract", () => {
  for (const type of NON_BOSS_ARCHETYPE_IDS) {
    const event = simulateTelegraph(type, `TELEGRAPH-${type}`);
    assert.ok(event, `${type} did not telegraph`);
    assert.equal(event.detail.type, type);
    assert.ok(["cone", "lane", "circle", "blink"].includes(event.detail.shape));
    assert.ok(Number.isFinite(event.detail.radius) && event.detail.radius > 0);
    assert.ok(Number.isFinite(event.detail.width) && event.detail.width >= 0);
    assert.ok(Number.isFinite(event.detail.direction.x));
    assert.ok(Number.isFinite(event.detail.direction.z));
    assert.ok(event.detail.duration > 0);
  }
});

test("seeded encounter decisions produce identical enemy and telegraph sequences", () => {
  const run = () => {
    const { director, events } = createDirector("REPEATABLE-ENCOUNTER");
    director.reset({ arena, floor: 8, room: 3, rng: new SeededRandom("REPEATABLE-ENCOUNTER"), difficulty });
    for (const enemy of director.enemies) enemy.attackCooldown = 0;
    director.update(1 / 60, { position: { x: 0, z: 0 }, radius: 0.58 }, () => {});
    return {
      types: director.enemies.map((enemy) => enemy.type),
      telegraphs: events
        .filter((event) => event.type === "enemyTelegraph")
        .map((event) => ({ type: event.detail.type, attack: event.detail.attack, target: event.detail.target })),
    };
  };

  assert.deepEqual(run(), run());
});

test("stress encounters cycle through all six non-boss categories", () => {
  const { director } = createDirector();
  director.stressSpawn(35, 9);
  assert.deepEqual(new Set(director.enemies.map((enemy) => enemy.type)), new Set(NON_BOSS_ARCHETYPE_IDS));
});

test("the six combat categories resolve into distinct runtime actions", () => {
  const expectedOutcomes = {
    thrall: ({ enemy }) => assert.equal(enemy.state, "dash"),
    reaver: ({ damageSources }) => assert.deepEqual(damageSources, ["crosscut"]),
    boneguard: ({ damageSources }) => assert.deepEqual(damageSources, ["shieldSlam"]),
    hexer: ({ director, damageSources }) => assert.ok(
      director.projectiles.some((projectile) => projectile.active) || damageSources.some((source) => source.startsWith("hex")),
    ),
    wraith: ({ damageSources }) => assert.deepEqual(damageSources, ["veilSweep"]),
    bombardier: ({ director, damageSources }) => assert.ok(
      director.projectiles.some((projectile) => projectile.active && projectile.kind === PROJECTILE_KINDS.CINDER_SHARD) ||
      damageSources.includes(PROJECTILE_KINDS.CINDER_SHARD),
    ),
  };

  for (const type of NON_BOSS_ARCHETYPE_IDS) {
    const { director, events } = createDirector(`ACTION-${type}`);
    const enemy = director.spawnEnemy(type, { x: 0, z: 0 }, 7);
    const damageSources = [];
    const player = { position: { x: 2, z: 0 }, radius: 0.58 };
    enemy.attackCooldown = 0;
    director.update(1 / 60, player, (_damage, source) => damageSources.push(source));
    const telegraph = events.find((event) => event.type === "enemyTelegraph");
    director.update(telegraph.detail.duration + 0.01, player, (_damage, source) => damageSources.push(source));
    expectedOutcomes[type]({ director, enemy, events, damageSources });
  }
});

test("the queen phase-two decision table deterministically reaches every enhanced attack family", () => {
  const sequence = () => {
    const { director } = createDirector("QUEEN-PHASE");
    const queen = director.spawnEnemy("queen", { x: 0, z: 0 }, 10);
    queen.bossPhase = 2;
    return Array.from({ length: 12 }, () => director.chooseQueenAction(queen));
  };

  const first = sequence();
  assert.deepEqual(first, sequence());
  assert.deepEqual(
    new Set(first),
    new Set(["royalVolley", "royalFan", "royalLance", "royalSlam", "royalDash", "voidWell", "summon", "teleport"]),
  );
  for (let index = 1; index < first.length; index += 1) {
    assert.notEqual(queenActionFamily(first[index]), queenActionFamily(first[index - 1]));
  }
});

test("normal enemies select different telegraphed attacks at meaningful ranges", () => {
  const cases = [
    ["thrall", 1.4, "graveCleave"], ["thrall", 2.5, "lunge"],
    ["reaver", 2.1, "crosscut"], ["reaver", 6, "dashLane"],
    ["boneguard", 2.2, "shieldSlam"], ["boneguard", 5, "guardCharge"],
    ["hexer", 4.5, "rune"], ["hexer", 9, "aimedBolt"],
    ["wraith", 2.3, "veilSweep"], ["wraith", 5, "blinkFlank"],
    ["bombardier", 5.5, "cinderBurst"], ["bombardier", 9, "lobbedBomb"],
  ];

  for (const [type, distance, attack] of cases) {
    const { director, events } = createDirector(`SITUATIONAL-${type}-${distance}`);
    const enemy = director.spawnEnemy(type, { x: 0, z: 0 }, 8);
    enemy.attackCooldown = 0;
    director.update(1 / 60, { position: { x: distance, z: 0 }, radius: 0.58 }, () => {});
    const telegraph = events.find((event) => event.type === "enemyTelegraph");
    assert.equal(telegraph?.detail.attack, attack, `${type} at ${distance} selected the wrong action`);
  }
});

test("Queen phase transitions are authored at 70% and 35% and grant a bounded transition lock", () => {
  const { director, events } = createDirector("QUEEN-TRANSITIONS");
  const queen = director.spawnEnemy("queen", { x: 0, z: 0 }, 10);
  const player = { position: { x: 7, z: 0 }, radius: 0.58 };
  queen.health = queen.maxHealth * 0.69;

  director.update(1 / 60, player, () => {});
  assert.equal(queen.bossPhase, 2);
  assert.equal(queen.state, "phaseTransition");
  assert.equal(events.filter((event) => event.type === "bossPhaseChanged").length, 1);

  const healthDuringTransition = queen.health;
  director.damageEnemy(queen, 100, { x: 1, z: 0 }, 4);
  assert.equal(queen.health, healthDuringTransition);
  director.update(0.9, player, () => {});
  queen.health = queen.maxHealth * 0.34;
  director.update(1 / 60, player, () => {});
  assert.equal(queen.bossPhase, 3);
  assert.equal(events.filter((event) => event.type === "bossPhaseChanged").length, 2);
});

test("Queen patterns respect persistent-hazard and summon caps", () => {
  const { director } = createDirector("QUEEN-CAPS");
  const queen = director.spawnEnemy("queen", { x: 0, z: 0 }, 10);
  queen.bossPhase = 3;
  for (let index = 0; index < QUEEN_HAZARD_CAP; index += 1) {
    director.spawnProjectile(queen.position, 0, 0, 1, 5, "violet", {
      kind: PROJECTILE_KINDS.QUEEN_WELL,
      mode: "rune",
      sourceType: "queen",
      target: { x: index + 1, z: 0 },
      areaRadius: 2,
    });
  }
  for (let index = 0; index < QUEEN_SUMMON_CAP; index += 1) {
    director.spawnEnemy("thrall", { x: index - 2, z: 4 }, 10);
  }

  const actions = Array.from({ length: 24 }, () => director.chooseQueenAction(queen));
  assert.ok(!actions.includes("voidWell"));
  assert.ok(!actions.includes("summon"));
});

test("boneguard shields reduce frontal damage while leaving rear attacks exposed", () => {
  const frontal = createDirector("SHIELD-FRONT");
  const frontalGuard = frontal.director.spawnEnemy("boneguard", { x: 0, z: 0 }, 3);
  frontalGuard.facing = { x: -1, z: 0 };
  frontal.director.damageEnemy(frontalGuard, 40, { x: 1, z: 0 }, 5);

  const rear = createDirector("SHIELD-REAR");
  const rearGuard = rear.director.spawnEnemy("boneguard", { x: 0, z: 0 }, 3);
  rearGuard.facing = { x: 1, z: 0 };
  rear.director.damageEnemy(rearGuard, 40, { x: 1, z: 0 }, 5);

  assert.ok(frontalGuard.health > rearGuard.health);
  assert.ok(frontal.events.some((event) => event.type === "enemyBlock"));
  assert.ok(!rear.events.some((event) => event.type === "enemyBlock"));
});

test("hexer aimed, fan, and rune spells create distinct pooled projectile kinds", () => {
  const spellKinds = new Map([
    ["aimedBolt", PROJECTILE_KINDS.HEX_BOLT],
    ["fan", PROJECTILE_KINDS.HEX_SHARD],
    ["rune", PROJECTILE_KINDS.HEX_RUNE],
  ]);

  for (const [spell, projectileKind] of spellKinds) {
    const { director } = createDirector(`HEXER-${spell}`);
    const hexer = director.spawnEnemy("hexer", { x: 0, z: 0 }, 6);
    const player = { position: { x: 9, z: 6 }, radius: 0.58 };
    director.beginAttack(hexer, spell, { x: 4, z: 0 }, { x: 1, z: 0, distance: 4 });
    const steps = Math.ceil(ENEMY_ARCHETYPES.hexer.attacks[spell].windup * 60) + 1;
    for (let step = 0; step < steps; step += 1) director.update(1 / 60, player, () => {});
    const matching = director.projectiles.filter((projectile) => projectile.active && projectile.kind === projectileKind);
    assert.equal(matching.length, spell === "fan" ? 5 : 1);
  }
});

test("bombardier lob lands at its telegraphed target and resolves pooled area damage", () => {
  const { director, events } = createDirector("BOMB-IMPACT");
  const bombardier = director.spawnEnemy("bombardier", { x: 0, z: 0 }, 6);
  const player = { position: { x: 2, z: 0 }, radius: 0.58 };
  const damageSources = [];
  director.beginAttack(bombardier, "lobbedBomb", player.position, { x: 1, z: 0, distance: 2 });

  for (let step = 0; step < 110; step += 1) {
    director.update(1 / 60, player, (_damage, source) => damageSources.push(source));
  }

  assert.ok(damageSources.includes(PROJECTILE_KINDS.CINDER_BOMB));
  assert.ok(events.some((event) => event.type === "projectileImpact" && event.detail.radius === 2.35));
  assert.ok(director.projectiles.every((projectile) => !projectile.active || projectile.kind !== PROJECTILE_KINDS.CINDER_BOMB));
});

test("bombardiers serialize area attacks so their escape windows cannot overlap", () => {
  const { director, events } = createDirector("BOMB-CADENCE");
  const first = director.spawnEnemy("bombardier", { x: -2, z: 0 }, 8);
  const second = director.spawnEnemy("bombardier", { x: 2, z: 0 }, 8);
  const player = { position: { x: 0, z: 0 }, radius: 0.58 };
  first.attackCooldown = 0;
  second.attackCooldown = 0;

  director.update(1 / 60, player, () => {});
  assert.equal(events.filter((event) => event.type === "enemyTelegraph").length, 1);

  for (let step = 0; step < 55; step += 1) director.update(1 / 60, player, () => {});
  assert.equal(events.filter((event) => event.type === "enemyTelegraph").length, 1);

  for (let step = 0; step < 20; step += 1) director.update(1 / 60, player, () => {});
  assert.equal(events.filter((event) => event.type === "enemyTelegraph").length, 2);
});
