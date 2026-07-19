import assert from "node:assert/strict";
import test from "node:test";
import { BLESSINGS } from "../src/game/blessings.js";
import { Game } from "../src/game/Game.js";
import {
  CHARGE_CONFIG,
  CLAIM_CONFIG,
  DASH_ATTACK,
  HARVEST_CONFIG,
  PROGRESSION_TRANSFORMATION_CONFIG,
  RUN_CONFIG,
  SCYTHE_ATTACKS,
} from "../src/game/gameConfig.js";
import { PlayerCombat } from "../src/game/PlayerCombat.js";
import { applyRunUpgrade } from "../src/game/runUpgrades.js";

function createInput() {
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume: () => false,
    consumePressed: () => null,
    consumeReleased: () => null,
    flushActions: () => {},
  };
}

function createSettings() {
  const values = { "gameplay.difficulty": "standard", "gameplay.autoTarget": 0, "gameplay.aimAssist": 0 };
  return { get: (path) => values[path] };
}

function createGame(seed) {
  const game = new Game(createInput(), createSettings());
  const events = [];
  game.on((event) => events.push(event));
  game.startRun(seed);
  while (game.phase === "dialogue") game.skipDialogue();
  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves.length = 0;
  game.phase = "playing";
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.setAimPoint({ x: 10, z: 0 });
  events.length = 0;
  return { game, events };
}

function grant(game, id, ranks = 1) {
  const blessing = BLESSINGS.find((candidate) => candidate.id === id);
  for (let rank = 0; rank < ranks; rank += 1) {
    assert.ok(applyRunUpgrade(blessing, game.player, game.upgradeRanks));
  }
}

function spawnEnemy(game, position, health = 1_000) {
  const enemy = game.director.spawnEnemy("reaver", position, 1);
  enemy.health = health;
  enemy.maxHealth = health;
  enemy.speed = 0;
  enemy.attackCooldown = 999;
  return enemy;
}

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} must equal ${expected}`);
}

function hostileAttempt(id = "moonwell-hit") {
  return Object.freeze({
    attemptId: `attempt-${id}`,
    actionId: `enemy-action-${id}`,
    amount: 20,
    source: "crosscut",
    family: "circle",
    enemyId: 7,
    enemyType: "reaver",
    enemyOrigin: "witch",
    projectileId: null,
  });
}

test("Far-Reaching Moon scales frozen Claim queries from base values and strengthens recall pull", () => {
  const { game, events } = createGame("TRANSFORM-FAR-REACH");
  grant(game, "far-reach", 2);
  const seen = [];
  game.director.querySweep = (query) => { seen.push(query); return []; };

  const outbound = Object.freeze({ pass: "outbound", radius: CLAIM_CONFIG.outbound.radius });
  game.claimCollisionAdapter.querySweep(outbound);
  game.claimCollisionAdapter.querySweep(Object.freeze({ pass: "recall", radius: CLAIM_CONFIG.recall.radius }));
  game.claimCollisionAdapter.querySweep(Object.freeze({ pass: "cleave", radius: CLAIM_CONFIG.empoweredCleave.radius }));

  assert.equal(seen[0], outbound);
  closeTo(seen[1].radius, CLAIM_CONFIG.recall.radius * (1 + 2 * PROGRESSION_TRANSFORMATION_CONFIG.farReachClaim.recallRadiusPerRank));
  closeTo(seen[2].radius, CLAIM_CONFIG.empoweredCleave.radius * (1 + 2 * PROGRESSION_TRANSFORMATION_CONFIG.farReachClaim.cleaveRadiusPerRank));
  assert.ok(seen.every(Object.isFrozen));

  const enemy = spawnEnemy(game, { x: 3, z: 0 });
  let pullStrength = null;
  const pullEnemyToward = game.director.pullEnemyToward.bind(game.director);
  game.director.pullEnemyToward = (target, origin, strength) => {
    pullStrength = strength;
    return pullEnemyToward(target, origin, strength);
  };
  game.resolveClaimHit({ actionId: "claim-far", pass: "recall", target: enemy, definition: CLAIM_CONFIG.recall });
  closeTo(pullStrength, CLAIM_CONFIG.recall.pullStrength * (1 + 2 * PROGRESSION_TRANSFORMATION_CONFIG.farReachClaim.recallPullPerRank));
  assert.equal(events.filter((event) => event.type === "progressionTransformationTriggered" && event.detail.hookId === "farReachClaim").length, 1);
});

test("Harvest Crown grants its configured Harvest once per Claim recall action", () => {
  const { game, events } = createGame("TRANSFORM-HARVEST-CROWN");
  grant(game, "harvest-crown", 2);
  const [first, second] = [spawnEnemy(game, { x: 3, z: 0 }), spawnEnemy(game, { x: 3.2, z: 0.2 })];
  const before = game.combat.harvest.snapshot().units;

  game.resolveClaimHit({ actionId: "claim-crown-1", pass: "recall", target: first, definition: CLAIM_CONFIG.recall });
  game.resolveClaimHit({ actionId: "claim-crown-1", pass: "recall", target: second, definition: CLAIM_CONFIG.recall });
  assert.equal(game.combat.harvest.snapshot().units - before, 2 * HARVEST_CONFIG.gainUnits.upgradeModifier);
  game.resolveClaimHit({ actionId: "claim-crown-2", pass: "recall", target: first, definition: CLAIM_CONFIG.recall });
  assert.equal(game.combat.harvest.snapshot().units - before, 4 * HARVEST_CONFIG.gainUnits.upgradeModifier);
  const triggers = events.filter((event) => event.type === "progressionTransformationTriggered" && event.detail.hookId === "harvestCrownClaim");
  assert.deepEqual(triggers.map((event) => event.detail.actionId), ["claim-crown-1", "claim-crown-2"]);
});

test("Grave-Tempered Edge publishes and uses the same charged-reap poise value", () => {
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  const player = {
    position: { x: 0, z: 0 },
    aimAngle: 0,
    invulnerable: 0,
    dashCooldownMultiplier: 1,
    transformationRanks: { graveEdgeCharge: 1 },
  };
  combat.startHeavyCharge(player, 1_000, "hold");
  combat.queueHeavyRelease(1_600);
  assert.equal(combat.releaseHeavy(player), true);
  const released = events.find((event) => event.type === "chargeReleased").detail;
  const expected = CHARGE_CONFIG.qualities.full.poiseDamage * (1 + PROGRESSION_TRANSFORMATION_CONFIG.graveEdgeCharge.poiseDamagePerRank);
  closeTo(released.poiseDamage, expected);
  closeTo(combat.attack.poiseDamage, expected);
  assert.equal(released.quality, "full");
});

test("Hollow Step afterimage is synchronized to dash attacks and never modifies normal scythe actions", () => {
  const { game, events } = createGame("TRANSFORM-HOLLOW-STEP");
  grant(game, "hollow-step");
  game.player.criticalChance = 0;
  const dashTarget = spawnEnemy(game, { x: 3, z: 0 });
  const dashBefore = dashTarget.health;
  game.nextNormalActionId();
  game.resolvePlayerAttack(DASH_ATTACK, new Set(), 0);
  closeTo(dashBefore - dashTarget.health, DASH_ATTACK.damage * (1 + PROGRESSION_TRANSFORMATION_CONFIG.hollowStepAfterimage.damagePerRank));
  assert.equal(events.filter((event) => event.type === "progressionTransformationTriggered" && event.detail.hookId === "hollowStepAfterimage").length, 1);

  const normalTarget = spawnEnemy(game, { x: 3, z: 0.25 });
  const normalBefore = normalTarget.health;
  game.nextNormalActionId();
  game.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  closeTo(normalBefore - normalTarget.health, SCYTHE_ATTACKS[0].damage);
});

test("Perfect Eclipse adds Harvest, survives a whiff, then guarantees one complete action's critical hits", () => {
  const { game, events } = createGame("TRANSFORM-PERFECT-ECLIPSE");
  grant(game, "perfect-eclipse");
  game.player.criticalChance = 0;
  const beforeHarvest = game.combat.harvest.snapshot().units;
  game.combat.startDash(game.player, { x: 1, y: 0 }, { timeStamp: 100 });
  const result = game.resolvePlayerDamageAttempt(hostileAttempt("perfect-eclipse"));
  assert.equal(result.perfectDash, true);
  assert.equal(
    game.combat.harvest.snapshot().units - beforeHarvest,
    HARVEST_CONFIG.gainUnits.perfectDash + HARVEST_CONFIG.gainUnits.upgradeModifier,
  );

  game.nextNormalActionId();
  game.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  assert.equal(game.eclipseCriticalReady, 1);

  const first = spawnEnemy(game, { x: 3, z: -0.25 });
  const second = spawnEnemy(game, { x: 3, z: 0.25 });
  const criticalActionId = game.nextNormalActionId();
  game.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  const criticalHits = events.filter((event) => event.type === "enemyHit" && event.detail.actionId === criticalActionId);
  assert.equal(criticalHits.length, 2);
  assert.ok(criticalHits.every((event) => event.detail.critical));
  assert.equal(game.eclipseCriticalReady, 0);
  assert.equal(first.health, second.health);

  const laterActionId = game.nextNormalActionId();
  game.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  assert.ok(events.filter((event) => event.type === "enemyHit" && event.detail.actionId === laterActionId).every((event) => !event.detail.critical));
});

test("Reaping Passage expands only dash-attack damage and arc", () => {
  const angle = 1.15;
  const position = { x: Math.cos(angle) * 5, z: Math.sin(angle) * 5 };
  const baseline = createGame("TRANSFORM-PASSAGE-BASE").game;
  baseline.player.criticalChance = 0;
  const baselineTarget = spawnEnemy(baseline, position);
  baseline.nextNormalActionId();
  baseline.resolvePlayerAttack(DASH_ATTACK, new Set(), 0);
  assert.equal(baselineTarget.health, baselineTarget.maxHealth);

  const { game, events } = createGame("TRANSFORM-PASSAGE-LIVE");
  grant(game, "reaping-passage");
  game.player.criticalChance = 0;
  const target = spawnEnemy(game, position);
  game.nextNormalActionId();
  game.resolvePlayerAttack(DASH_ATTACK, new Set(), 0);
  closeTo(
    target.maxHealth - target.health,
    DASH_ATTACK.damage * game.player.damageMultiplier * (1 + PROGRESSION_TRANSFORMATION_CONFIG.reapingPassageDashAttack.damagePerRank),
  );
  assert.equal(events.filter((event) => event.type === "progressionTransformationTriggered" && event.detail.hookId === "reapingPassageDashAttack").length, 1);
});

test("Royal Blood activates at the exact wounded boundary for damage and poise", () => {
  const wounded = createGame("TRANSFORM-ROYAL-WOUNDED").game;
  grant(wounded, "royal-blood");
  wounded.player.criticalChance = 0;
  wounded.player.health = wounded.player.maxHealth * PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded.healthThreshold;
  const woundedTarget = spawnEnemy(wounded, { x: 3, z: 0 });
  const poiseBefore = woundedTarget.poise;
  wounded.nextNormalActionId();
  wounded.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  closeTo(woundedTarget.maxHealth - woundedTarget.health, SCYTHE_ATTACKS[0].damage * PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded.damagePerRank + SCYTHE_ATTACKS[0].damage);
  closeTo(poiseBefore - woundedTarget.poise, 15 * (1 + PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded.poisePerRank));

  const healthy = createGame("TRANSFORM-ROYAL-HEALTHY").game;
  grant(healthy, "royal-blood");
  healthy.player.criticalChance = 0;
  healthy.player.health = healthy.player.maxHealth * PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded.healthThreshold + 0.01;
  const healthyTarget = spawnEnemy(healthy, { x: 3, z: 0 });
  healthy.nextNormalActionId();
  healthy.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  closeTo(healthyTarget.maxHealth - healthyTarget.health, SCYTHE_ATTACKS[0].damage);
});

test("Soul Siphon heals from normal and Claim hits under one action-scoped cap", () => {
  const { game, events } = createGame("TRANSFORM-SOUL-SIPHON");
  grant(game, "soul-siphon");
  game.player.criticalChance = 0;
  game.player.health = 50;
  spawnEnemy(game, { x: 2.5, z: -0.5 });
  spawnEnemy(game, { x: 3, z: 0 });
  spawnEnemy(game, { x: 2.5, z: 0.5 });
  const sweepingAttack = Object.freeze({ ...SCYTHE_ATTACKS[0], damage: 200, range: 5, arc: Math.PI * 2 });
  const firstAction = game.nextNormalActionId();
  game.resolvePlayerAttack(sweepingAttack, new Set(), 0);
  assert.equal(game.player.health, 60);
  assert.equal(game.soulSiphonHealingByAction.get(firstAction), 10);

  const secondAction = game.nextNormalActionId();
  game.resolvePlayerAttack(sweepingAttack, new Set(), 0);
  assert.equal(game.player.health, 70);
  assert.equal(game.soulSiphonHealingByAction.get(secondAction), 10);

  const claimTarget = spawnEnemy(game, { x: 3.5, z: 0 });
  game.resolveClaimHit({ actionId: "claim-siphon", pass: "outbound", target: claimTarget, definition: CLAIM_CONFIG.outbound });
  assert.ok(game.player.health > 70);
  assert.ok(events.some((event) => event.type === "playerHealed" && event.detail.sourceActionId === "claim-siphon"));
});

test("Moonwell Renewal arms only from accepted damage and empowers only the next accepted hit", () => {
  const { game, events } = createGame("TRANSFORM-MOONWELL");
  grant(game, "moonwell-renewal");
  game.player.invulnerable = 0;
  assert.equal(game.resolvePlayerDamageAttempt(hostileAttempt()).damaged, true);
  assert.equal(game.moonwellRetaliationReady, 1);

  game.nextNormalActionId();
  game.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  assert.equal(game.moonwellRetaliationReady, 1);

  const first = spawnEnemy(game, { x: 3, z: -0.2 });
  const second = spawnEnemy(game, { x: 3, z: 0.2 });
  const poiseBefore = [first.poise, second.poise];
  const attack = Object.freeze({ ...SCYTHE_ATTACKS[0], damage: 50, arc: Math.PI * 2 });
  game.player.criticalChance = 0;
  game.nextNormalActionId();
  game.resolvePlayerAttack(attack, new Set(), 0);
  assert.deepEqual(
    [first.maxHealth - first.health, second.maxHealth - second.health].sort((left, right) => left - right),
    [50, 50 + PROGRESSION_TRANSFORMATION_CONFIG.moonwellRenewalRetaliation.damagePerRank],
  );
  assert.deepEqual(
    [poiseBefore[0] - first.poise, poiseBefore[1] - second.poise].sort((left, right) => left - right),
    [28, 28 + PROGRESSION_TRANSFORMATION_CONFIG.moonwellRenewalRetaliation.poiseDamagePerRank],
  );
  assert.equal(game.moonwellRetaliationReady, 0);
  assert.equal(events.filter((event) => event.type === "progressionTransformationTriggered" && event.detail.hookId === "moonwellRenewalRetaliation").length, 2);

  game.player.invulnerable = 1;
  assert.equal(game.resolvePlayerDamageAttempt(hostileAttempt("rejected")).accepted, false);
  assert.equal(game.moonwellRetaliationReady, 0);
});

test("room replacement clears transient proc state without removing owned transformation ranks", () => {
  const { game } = createGame("TRANSFORM-RESET");
  grant(game, "perfect-eclipse");
  grant(game, "moonwell-renewal");
  game.eclipseCriticalReady = 1;
  game.moonwellRetaliationReady = 1;
  game.harvestCrownActionIds.add("old-claim");
  game.soulSiphonHealingByAction.set("old-attack", 10);
  game.loadRoom();
  assert.equal(game.eclipseCriticalReady, 0);
  assert.equal(game.moonwellRetaliationReady, 0);
  assert.equal(game.harvestCrownActionIds.size, 0);
  assert.equal(game.soulSiphonHealingByAction.size, 0);
  assert.equal(game.transformationRank("perfectEclipsePerfectDash"), 1);
  assert.equal(game.transformationRank("moonwellRenewalRetaliation"), 1);
});
