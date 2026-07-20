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

function combatHit(actionId, overrides = {}) {
  return Object.freeze({
    actionId,
    damage: overrides.damage ?? 0,
    critical: overrides.critical ?? false,
    direction: Object.freeze({ ...(overrides.direction ?? { x: 1, z: 0 }) }),
    knockback: overrides.knockback ?? 0,
    poiseDamage: overrides.poiseDamage ?? 0,
    pullStrength: overrides.pullStrength ?? 0,
    sourcePosition: Object.freeze({ ...(overrides.sourcePosition ?? { x: -1, z: 0 }) }),
    origin: overrides.origin ?? "player",
  });
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

test("the reinforced roster has faster movement, larger health pools, and immutable combo plans", () => {
  const minimums = {
    thrall: { health: 78, speed: 5.45 },
    reaver: { health: 94, speed: 5.9 },
    boneguard: { health: 182, speed: 3.5 },
    hexer: { health: 74, speed: 3.95 },
    wraith: { health: 98, speed: 5.35 },
    bombardier: { health: 104, speed: 3.7 },
    queen: { health: 2300, speed: 5.2 },
  };
  const comboOpeners = {
    thrall: "lunge",
    reaver: "dashLane",
    boneguard: "guardCharge",
    hexer: "aimedBolt",
    wraith: "blinkFlank",
    bombardier: "lobbedBomb",
  };

  for (const [type, minimum] of Object.entries(minimums)) {
    const stats = getEnemyArchetype(type).stats;
    assert.ok(stats.maxHealth >= minimum.health, `${type} health regressed`);
    assert.ok(stats.speed >= minimum.speed, `${type} speed regressed`);
  }
  for (const [type, attackKind] of Object.entries(comboOpeners)) {
    const attack = getEnemyArchetype(type).attacks[attackKind];
    assert.ok(attack.combo?.followup, `${type} is missing a combo follow-up`);
    assert.ok(attack.combo.gap >= 0 && attack.combo.window > attack.combo.gap);
    assert.equal(Object.isFrozen(attack.combo), true);
    if (attack.tracking) assert.equal(Object.isFrozen(attack.tracking), true);
  }
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
    director.update(1 / 60, player, (attempt) => damageSources.push(attempt.source));
    const telegraph = events.find((event) => event.type === "enemyTelegraph");
    director.update(telegraph.detail.duration + 0.01, player, (attempt) => damageSources.push(attempt.source));
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

test("mobile targets are led by a bounded prediction that remains locked to the telegraph", () => {
  const { director, events } = createDirector("PREDICTIVE-AIM");
  const reaver = director.spawnEnemy("reaver", { x: 0, z: 0 }, 6);
  const player = {
    position: { x: 6, z: 0 },
    previousPosition: { x: 5.85, z: 0 },
    radius: 0.58,
  };
  reaver.attackCooldown = 0;

  director.update(1 / 60, player, () => {});

  const telegraph = events.find((event) => event.type === "enemyTelegraph");
  assert.equal(telegraph.detail.attack, "dashLane");
  assert.ok(telegraph.detail.target.x > player.position.x);
  assert.ok(telegraph.detail.target.x <= player.position.x + ENEMY_ARCHETYPES.reaver.attacks.dashLane.tracking.maxLead);
  assert.deepEqual(reaver.attackTarget, telegraph.detail.target);
});

test("regular enemies telegraph and execute a deterministic two-step combo", () => {
  const { director, events } = createDirector("THRALL-COMBO");
  const thrall = director.spawnEnemy("thrall", { x: 0, z: 0 }, 6);
  const player = {
    position: { x: 2.4, z: 0 },
    previousPosition: { x: 2.4, z: 0 },
    radius: 0.58,
  };
  thrall.attackCooldown = 0;

  for (let step = 0; step < 120; step += 1) director.update(1 / 60, player, () => {});

  const telegraphs = events
    .filter((event) => event.type === "enemyTelegraph" && event.detail.enemyId === thrall.id)
    .slice(0, 2)
    .map((event) => event.detail);
  const attacks = events
    .filter((event) => event.type === "enemyAttack" && event.detail.enemyId === thrall.id)
    .slice(0, 2)
    .map((event) => event.detail);
  assert.deepEqual(telegraphs.map(({ attack }) => attack), ["lunge", "graveCleave"]);
  assert.deepEqual(telegraphs.map(({ comboStep }) => comboStep), [1, 2]);
  assert.equal(telegraphs[0].comboId, telegraphs[1].comboId);
  assert.deepEqual(attacks.map(({ attack }) => attack), ["lunge", "graveCleave"]);
  assert.equal(events.filter((event) => event.type === "enemyComboStarted").length, 1);
  assert.equal(events.filter((event) => event.type === "enemyComboContinued").length, 1);
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
  const transitionHit = director.resolveCombatHit(queen, combatHit("queen-transition-lock", {
    damage: 100,
    knockback: 4,
  }));
  assert.equal(transitionHit.accepted, false);
  assert.equal(transitionHit.reason, "uninterruptible");
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
  frontal.director.resolveCombatHit(frontalGuard, combatHit("boneguard-front", {
    damage: 40,
    knockback: 5,
  }));

  const rear = createDirector("SHIELD-REAR");
  const rearGuard = rear.director.spawnEnemy("boneguard", { x: 0, z: 0 }, 3);
  rearGuard.facing = { x: 1, z: 0 };
  rear.director.resolveCombatHit(rearGuard, combatHit("boneguard-rear", {
    damage: 40,
    knockback: 5,
  }));

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

test("one fan action can damage the player at most once even when shards overlap", () => {
  const { director } = createDirector("FAN-SINGLE-IMPACT");
  const hexer = director.spawnEnemy("hexer", { x: 0, z: 0 }, 6);
  const player = { position: { x: 1, z: 0 }, radius: 0.58 };
  const attempts = [];
  const actionId = director.beginAttack(hexer, "fan", player.position, { x: 1, z: 0, distance: 1 });

  director.update(ENEMY_ARCHETYPES.hexer.attacks.fan.windup + 0.01, player, (attempt) => attempts.push(attempt));

  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].actionId, actionId);
});

test("bombardier lob lands at its telegraphed target and resolves pooled area damage", () => {
  const { director, events } = createDirector("BOMB-IMPACT");
  const bombardier = director.spawnEnemy("bombardier", { x: 0, z: 0 }, 6);
  const player = { position: { x: 2, z: 0 }, radius: 0.58 };
  const damageSources = [];
  director.beginAttack(bombardier, "lobbedBomb", player.position, { x: 1, z: 0, distance: 2 });

  for (let step = 0; step < 110; step += 1) {
    director.update(1 / 60, player, (attempt) => damageSources.push(attempt.source));
  }

  assert.ok(damageSources.includes(PROJECTILE_KINDS.CINDER_BOMB));
  assert.ok(events.some((event) => event.type === "projectileImpact" && event.detail.radius === 2.35));
  assert.ok(director.projectiles.every((projectile) => !projectile.active || projectile.kind !== PROJECTILE_KINDS.CINDER_BOMB));
});

test("all six hostile route families emit frozen attempts linked to their committed telegraph", () => {
  const routes = [
    { type: "thrall", attack: "graveCleave", family: "cone" },
    { type: "reaver", attack: "crosscut", family: "circle" },
    { type: "wraith", attack: "blinkFlank", family: "blink" },
    { type: "thrall", attack: "lunge", family: "dash" },
    { type: "hexer", attack: "aimedBolt", family: "directProjectile" },
    { type: "bombardier", attack: "lobbedBomb", family: "areaProjectile" },
  ];
  const families = new Set();
  for (const route of routes) {
    const { director, events } = createDirector(`DAMAGE-ROUTE-${route.family}`);
    const enemy = director.spawnEnemy(route.type, { x: 0, z: 0 }, 6);
    const player = { position: { x: 1, z: 0 }, radius: 0.58 };
    const attempts = [];
    const actionId = director.beginAttack(enemy, route.attack, player.position, { x: 1, z: 0, distance: 1 });
    for (let step = 0; step < 180 && attempts.length === 0; step += 1) {
      director.update(1 / 60, player, (attempt) => attempts.push(attempt));
    }

    assert.equal(attempts.length, 1, route.family);
    const attempt = attempts[0];
    families.add(attempt.family);
    assert.equal(Object.isFrozen(attempt), true);
    assert.equal(attempt.actionId, actionId);
    assert.equal(attempt.family, route.family);
    assert.equal(attempt.enemyId, enemy.id);
    assert.equal(attempt.enemyType, enemy.type);
    assert.equal(attempt.enemyOrigin, enemy.origin);
    assert.ok(attempt.amount > 0);
    assert.match(attempt.attemptId, /^player-damage-\d+$/);
    if (route.family.endsWith("Projectile")) assert.match(attempt.projectileId, /^projectile-\d+$/);
    else assert.equal(attempt.projectileId, null);
    const telegraph = events.find((event) => event.type === "enemyTelegraph" && event.detail.attack === route.attack);
    const impact = events.find((event) => event.type === "enemyAttack" && event.detail.attack === route.attack);
    assert.equal(telegraph.detail.actionId, actionId);
    assert.equal(impact.detail.actionId, actionId);
  }
  assert.deepEqual([...families].sort(), ["areaProjectile", "blink", "circle", "cone", "dash", "directProjectile"]);
});

test("pooled projectiles receive fresh identities while preserving current owner provenance", () => {
  const { director } = createDirector("PROJECTILE-REUSE");
  const owner = director.spawnEnemy("hexer", { x: 0, z: 0 }, 4);
  const first = director.spawnProjectile(owner.position, 0, 0, 5, 1, "violet", {
    actionId: "enemy-action-first",
    enemyId: owner.id,
    enemyType: owner.type,
    enemyOrigin: owner.origin,
    sourceType: owner.type,
    origin: owner.origin,
  });
  const firstId = first.id;
  director.deactivateProjectile(first);
  const second = director.spawnProjectile(owner.position, 0, 0, 7, 1, "violet", {
    actionId: "enemy-action-second",
    enemyId: owner.id,
    enemyType: owner.type,
    enemyOrigin: owner.origin,
    sourceType: owner.type,
    origin: owner.origin,
  });

  assert.equal(second, first);
  assert.notEqual(second.id, firstId);
  assert.equal(second.actionId, "enemy-action-second");
  assert.equal(second.ownerEnemyId, owner.id);
  assert.equal(second.ownerEnemyType, owner.type);
  assert.equal(second.ownerEnemyOrigin, owner.origin);
  const attempts = [];
  director.updateProjectiles(1 / 60, { position: { x: 0, z: 0 }, radius: 0.58 }, (attempt) => attempts.push(attempt));
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].projectileId, second.id);
  assert.equal(attempts[0].actionId, "enemy-action-second");
  assert.equal(attempts[0].enemyId, owner.id);
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

test("enemy types receive deterministic bounded poise and resistance classes", () => {
  const { director } = createDirector("RESISTANCE");
  const expected = {
    thrall: "light", wraith: "light", hexer: "light",
    reaver: "medium", bombardier: "medium", boneguard: "heavy", queen: "boss",
  };
  for (const [type, resistanceClass] of Object.entries(expected)) {
    const enemy = director.spawnEnemy(type, { x: 0, z: 0 }, 5);
    assert.equal(enemy.resistanceClass, resistanceClass);
    assert.equal(enemy.poise, enemy.maxPoise);
    assert.ok(enemy.maxPoise > 0);
    assert.equal(enemy.poiseRecoveryDelay, 0);
  }
});

test("Claim candidate queries sweep segments and cleave arcs in stable active order", () => {
  const { director } = createDirector("CLAIM-QUERY");
  const first = director.spawnEnemy("thrall", { x: 2, z: 0 }, 3);
  const second = director.spawnEnemy("reaver", { x: 4, z: 0.45 }, 3);
  director.spawnEnemy("hexer", { x: -3, z: 0 }, 3);
  const inactive = director.spawnEnemy("wraith", { x: 3, z: 0 }, 3);
  inactive.active = false;

  const swept = director.querySweep({ pass: "outbound", from: { x: 0, z: 0 }, to: { x: 5, z: 0 }, radius: 0.2 });
  assert.deepEqual(swept.map((enemy) => enemy.id), [first.id, second.id]);
  const cleave = director.querySweep({
    pass: "cleave",
    from: { x: 0, z: 0 },
    to: { x: 0, z: 0 },
    radius: 5,
    arc: Math.PI / 2,
    direction: { x: 1, z: 0 },
  });
  assert.deepEqual(cleave.map((enemy) => enemy.id), [first.id, second.id]);
});

test("poise crosses zero once, interrupts windup and dash, staggers once, and recovers after delay", () => {
  const { director, events } = createDirector("POISE");
  const enemy = director.spawnEnemy("reaver", { x: 0, z: 0 }, 4);
  director.beginAttack(enemy, "crosscut", { x: 2, z: 0 }, { x: 1, z: 0 });
  const hit = {
    actionId: "claim-1",
    damage: 1,
    critical: false,
    direction: { x: 1, z: 0 },
    knockback: 0,
    poiseDamage: enemy.maxPoise,
    pullStrength: 0,
    sourcePosition: { x: -2, z: 0 },
    origin: "player",
  };
  const resolved = director.resolveCombatHit(enemy, hit);
  assert.equal(resolved.accepted, true);
  assert.equal(resolved.hit.poiseDamage, enemy.maxPoise);
  assert.equal(Object.isFrozen(resolved.hit), true);
  assert.equal(enemy.attackPending, false);
  assert.equal(enemy.state, "staggered");
  director.resolveCombatHit(enemy, hit);
  assert.equal(events.filter((event) => event.type === "enemyStaggered").length, 1);
  assert.equal(events.filter((event) => event.type === "enemyPoiseChanged").length, 1);

  const player = { position: { x: 12, z: 0 }, radius: 0.58 };
  director.update(1, player, () => {});
  assert.equal(enemy.poise, 0);
  director.update(0.1, player, () => {});
  assert.ok(enemy.poise > 0 && enemy.poise <= enemy.maxPoise);
  assert.notEqual(enemy.state, "staggered");

  const dasher = director.spawnEnemy("thrall", { x: 1, z: 0 }, 4);
  director.startDash(dasher, "lunge", { dashDuration: 0.5, dashSpeed: 12 });
  director.resolveCombatHit(dasher, { ...hit, actionId: "claim-dash", poiseDamage: dasher.maxPoise });
  assert.equal(dasher.state, "staggered");
  assert.equal(dasher.actionSpeed, 0);
  assert.equal(dasher.actionHit, false);
  assert.equal(dasher.attackKind, null);
});

test("Claim pull is bounded, collision-safe, and reduced by heavy and boss resistance", () => {
  const blockedArena = {
    ...arena,
    obstacles: [{ x: 0, z: 0, width: 1, depth: 8 }],
  };
  const { director } = createDirector("PULL");
  director.arena = blockedArena;
  const light = director.spawnEnemy("thrall", { x: 2.2, z: 0 }, 3);
  const heavy = director.spawnEnemy("boneguard", { x: 2.2, z: 3 }, 3);
  const boss = director.spawnEnemy("queen", { x: 2.2, z: -3 }, 10);
  const lightPull = director.pullEnemyToward(light, { x: -3, z: 0 }, 9);
  const heavyPull = director.pullEnemyToward(heavy, { x: -3, z: 3 }, 3.2);
  const bossPull = director.pullEnemyToward(boss, { x: -3, z: -3 }, 3.2);

  assert.ok(lightPull.applied > 0);
  assert.ok(light.position.x >= 0.5 + light.radius - 0.001, "light target crossed the obstacle");
  assert.ok(heavyPull.applied < lightPull.requested);
  assert.equal(bossPull.applied, 0);
  assert.equal(lightPull.requested, 9);
  assert.ok(lightPull.applied <= 3.2);
});

test("heavy and boss hits acknowledge health and poise without unrestricted displacement", () => {
  const { director, events } = createDirector("BOSS-HIT");
  const heavy = director.spawnEnemy("boneguard", { x: 3, z: 0 }, 5);
  const queen = director.spawnEnemy("queen", { x: 0, z: 0 }, 10);
  const hit = {
    actionId: "claim-boss",
    damage: 12,
    critical: false,
    direction: { x: 1, z: 0 },
    knockback: 12,
    poiseDamage: 30,
    pullStrength: 7,
    sourcePosition: { x: -3, z: 0 },
    origin: "player",
  };
  const heavyResult = director.resolveCombatHit(heavy, hit);
  const result = director.resolveCombatHit(queen, hit);
  assert.equal(heavyResult.health, heavy.maxHealth - 12);
  assert.equal(heavyResult.poise, heavy.maxPoise - 30);
  assert.ok(heavyResult.hit.knockback > 0 && heavyResult.hit.knockback < hit.knockback);
  assert.equal(result.health, queen.maxHealth - 12);
  assert.equal(result.poise, queen.maxPoise - 30);
  assert.equal(result.hit.knockback, 0);
  assert.equal(result.hit.enemyOrigin, queen.origin);
  assert.ok(events.some((event) => event.type === "enemyHit"));
  assert.ok(events.some((event) => event.type === "enemyPoiseChanged"));
});

test("structured hits emit one immutable enemyHit linked to the returned CombatHit", () => {
  const { director, events } = createDirector("HIT-LINKAGE");
  const enemy = director.spawnEnemy("reaver", { x: 2, z: 1 }, 4);
  const result = director.resolveCombatHit(enemy, {
    actionId: "claim-recall-8",
    damage: 17,
    critical: true,
    direction: { x: 1, z: 0 },
    knockback: 5,
    poiseDamage: 23,
    pullStrength: 2.4,
    sourcePosition: { x: -1, z: 1 },
    origin: "player",
  });
  const hitEvents = events.filter((event) => event.type === "enemyHit");
  assert.equal(hitEvents.length, 1);
  const detail = hitEvents[0].detail;
  assert.equal(Object.isFrozen(detail), true);
  assert.equal(Object.isFrozen(detail.position), true);
  assert.equal(Object.isFrozen(detail.sourcePosition), true);
  assert.equal(Object.isFrozen(detail.direction), true);
  assert.equal(detail.hit, result.hit);
  assert.equal(detail.actionId, result.hit.actionId);
  assert.equal(detail.damage, result.hit.damage);
  assert.equal(detail.poiseDamage, result.hit.poiseDamage);
  assert.equal(detail.knockback, result.hit.knockback);
  assert.equal(detail.pullStrength, result.hit.pullStrength);
  assert.deepEqual(detail.sourcePosition, result.hit.sourcePosition);
  assert.equal(detail.hitOrigin, result.hit.origin);
  assert.equal(detail.sourceOrigin, result.hit.origin);
  assert.equal(detail.enemyOrigin, result.hit.enemyOrigin);
  assert.equal(detail.origin, enemy.origin, "event origin remains the enemy gameplay variant");
});

test("structured damage remains single-application and rejects an inactive second defeat", () => {
  const { director, events } = createDirector("STRUCTURED-DAMAGE");
  const enemy = director.spawnEnemy("thrall", { x: 0, z: 0 }, 1);
  const before = enemy.health;
  const first = director.resolveCombatHit(enemy, combatHit("structured-first", {
    damage: 10,
    critical: true,
    knockback: 2,
  }));
  assert.equal(first.accepted, true);
  assert.equal(first.defeated, false);
  assert.equal(enemy.health, before - 10);
  assert.equal(enemy.poise, enemy.maxPoise);
  assert.equal(enemy.knockback.x, 2);
  const hitEvent = events.find((event) => event.type === "enemyHit")?.detail;
  assert.equal(hitEvent.actionId, "structured-first");
  assert.equal(hitEvent.hit.actionId, "structured-first");
  assert.equal(hitEvent.hitOrigin, "player");
  assert.equal(Object.isFrozen(hitEvent), true);
  const lethal = director.resolveCombatHit(enemy, combatHit("structured-lethal", { damage: enemy.maxHealth }));
  const inactive = director.resolveCombatHit(enemy, combatHit("structured-repeat", { damage: enemy.maxHealth }));
  assert.equal(lethal.accepted, true);
  assert.equal(lethal.defeated, true);
  assert.deepEqual(inactive, { accepted: false, reason: "inactive", defeated: false, hit: null });
  assert.equal(events.filter((event) => event.type === "enemyDefeated").length, 1);
  assert.equal(events.filter((event) => event.type === "enemyHit").length, 2);
});
