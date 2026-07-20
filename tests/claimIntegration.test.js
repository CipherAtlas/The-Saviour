import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import {
  CHARGE_CONFIG,
  CLAIM_CONFIG,
  HARVEST_CONFIG,
  HEAVY_ATTACK,
  HIT_STOP_CONFIG,
  PLAYER_CONFIG,
  RUN_CONFIG,
  SCYTHE_ATTACKS,
  STRAIGHT_CHARGE_ATTACK,
} from "../src/game/gameConfig.js";

function createInput() {
  const pressed = new Map();
  const released = new Map();
  const down = new Set();
  const flushed = [];
  return {
    flushed,
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: (action) => down.has(action),
    consume(action) { return Boolean(pressed.delete(action)); },
    consumePressed(action) {
      const value = pressed.get(action) ?? null;
      pressed.delete(action);
      return value;
    },
    consumeReleased(action) {
      const value = released.get(action) ?? null;
      released.delete(action);
      return value;
    },
    press(action, timeStamp = 100, held = false) {
      pressed.set(action, { action, timeStamp });
      if (held) down.add(action);
    },
    release(action, timeStamp = 100) {
      down.delete(action);
      released.set(action, { action, timeStamp });
    },
    flushActions(actions) {
      flushed.push([...actions]);
      for (const action of actions) {
        pressed.delete(action);
        released.delete(action);
        down.delete(action);
      }
    },
  };
}

function createSettings() {
  const values = { "gameplay.difficulty": "standard", "gameplay.autoTarget": 0, "gameplay.aimAssist": 0 };
  return { get: (path) => values[path] };
}

function createGame(seed = "CLAIM-INTEGRATION") {
  const input = createInput();
  const game = new Game(input, createSettings());
  const events = [];
  game.on((event) => events.push(event));
  game.startRun(seed);
  while (game.phase === "bookend") game.continueBookend();
  return { game, input, events };
}

function activateClaim(game, input, inputTime = 10) {
  game.phase = "playing";
  input.press("claim", inputTime);
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(game.combat.claim.phase, "outbound");
}

function assertCancelledOnce(game, events) {
  assert.equal(game.combat.claim.phase, "idle");
  assert.equal(game.claimSnapshots.previous, game.claimSnapshots.current);
  assert.equal(Object.isFrozen(game.claimSnapshots), true);
  assert.equal(events.filter((event) => event.type === "claimCompleted" && event.detail.result === "cancelled").length, 1);
}

function runNormalAttack(game, input, inputTime = 500) {
  input.press("attack", inputTime);
  for (let step = 0; step < 36; step += 1) game.updateFixed(RUN_CONFIG.fixedStep);
}

function chargedAttack(quality, actionId = `charge-${quality}`) {
  const values = CHARGE_CONFIG.qualities[quality];
  return Object.freeze({
    ...HEAVY_ATTACK,
    damage: HEAVY_ATTACK.damage * values.damageMultiplier,
    range: HEAVY_ATTACK.range * values.rangeMultiplier,
    poiseDamage: values.poiseDamage,
    harvestUnits: values.harvestUnits,
    chargeQuality: quality,
    chargeActionId: actionId,
  });
}

function prepareStationaryArena(game, positions = [{ x: 4, z: 0 }]) {
  for (const actor of game.director.enemies) actor.active = false;
  game.director.pendingWaves.length = 0;
  game.phase = "playing";
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.setAimPoint({ x: 10, z: 0 });
  return positions.map((position) => {
    const enemy = game.director.spawnEnemy("reaver", position, 1);
    enemy.health = 1_000;
    enemy.maxHealth = 1_000;
    enemy.speed = 0;
    enemy.attackCooldown = 999;
    return enemy;
  });
}

test("Harvest grants once on an empty floor and persists unspent units across rooms and floors", () => {
  const { game, events } = createGame("HARVEST-PERSISTENCE");
  assert.equal(game.combat.harvest.snapshot().units, HARVEST_CONFIG.floorMinimumUnits);
  assert.equal(events.filter((event) => event.type === "harvestChanged" && event.detail.reason === "floorMinimum").length, 1);

  game.applyHarvestGain("closeHit", "persistence:hit");
  const carried = game.combat.harvest.snapshot().units;
  game.room = 2;
  game.loadRoom();
  assert.equal(game.combat.harvest.snapshot().units, carried);
  game.floor = 2;
  game.room = 1;
  game.loadRoom();
  assert.equal(game.combat.harvest.snapshot().units, carried);

  const empty = createGame("HARVEST-EMPTY-FLOOR");
  const spent = empty.game.combat.harvest.trySpend(1, "testFloorTransition");
  empty.game.harvestSnapshot = spent.snapshot;
  empty.game.floor = 2;
  empty.game.room = 1;
  empty.game.loadRoom();
  empty.game.loadRoom();
  assert.equal(empty.game.combat.harvest.snapshot().units, HARVEST_CONFIG.floorMinimumUnits);
  assert.equal(empty.events.filter((event) => event.type === "harvestChanged" && event.detail.reason === "floorMinimum").length, 2);
});

test("Grave Line spends the Claim bar before hitting only enemies inside its committed lane", () => {
  const { game, input, events } = createGame("GRAVE-LINE-INTEGRATION");
  const [center, edge, side, behind] = prepareStationaryArena(game, [
    { x: 7, z: 0 },
    { x: 6, z: 1.7 },
    { x: 6, z: 2.4 },
    { x: -2, z: 0 },
  ]);
  game.rng = { chance: () => false };
  events.length = 0;
  input.press("attack", 1_000, true);
  for (let frame = 0; frame < 150 && !events.some((event) => event.type === "lineChargeReleased"); frame += 1) {
    game.updateFixed(RUN_CONFIG.fixedStep);
  }
  const spendIndex = events.findIndex((event) => event.type === "harvestChanged" && event.detail.reason === "lineCharge");
  const releaseIndex = events.findIndex((event) => event.type === "lineChargeReleased");
  assert.ok(spendIndex >= 0 && spendIndex < releaseIndex);
  assert.equal(game.combat.harvest.snapshot().units, 0);
  assert.equal(events[releaseIndex].detail.forced, true);
  assert.equal(events.find((event) => event.type === "attack")?.detail.shape, "line");

  for (let frame = 0; frame < 50 && events.filter((event) => event.type === "enemyHit").length < 2; frame += 1) {
    game.updateFixed(RUN_CONFIG.fixedStep);
  }
  const hitIds = events.filter((event) => event.type === "enemyHit").map((event) => event.detail.id);
  assert.deepEqual(hitIds.sort(), [center.id, edge.id].sort());
  assert.equal(side.health, side.maxHealth);
  assert.equal(behind.health, behind.maxHealth);
});

test("Claim spend precedes startup and swept outbound/recall hits retain action linkage and pull order", () => {
  const { game, input, events } = createGame("CLAIM-SWEEP");
  for (const actor of game.director.enemies) actor.active = false;
  game.director.pendingWaves.length = 0;
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.player.aimAngle = 0;
  game.setAimPoint({ x: 10, z: 0 });
  const enemy = game.director.spawnEnemy("thrall", { x: 4, z: 0 }, 1);
  enemy.health = 140;
  enemy.maxHealth = 140;
  enemy.speed = 0;
  enemy.attackCooldown = 999;
  const beforeX = enemy.position.x;

  input.press("claim", 250);
  game.updateFixed(RUN_CONFIG.fixedStep);
  const spendIndex = events.findIndex((event) => event.type === "harvestChanged" && event.detail.reason === "claim");
  const startedIndex = events.findIndex((event) => event.type === "claimStarted");
  assert.ok(spendIndex >= 0 && spendIndex < startedIndex);
  assert.equal(events[spendIndex].detail.delta, -HARVEST_CONFIG.unitsPerSegment);
  assert.equal(Object.isFrozen(events[spendIndex].detail), true);
  assert.equal(game.claimSnapshots.previous.phase, "idle");
  assert.equal(game.claimSnapshots.current.phase, "outbound");
  assert.equal(Object.isFrozen(game.claimSnapshots), true);

  let followupPressed = false;
  for (let step = 0; step < 70; step += 1) {
    if (!followupPressed && game.combat.claim.phase === "empoweredWindow") {
      input.press("attack", 800);
      followupPressed = true;
    }
    game.updateFixed(RUN_CONFIG.fixedStep);
  }
  const started = events[startedIndex].detail;
  const hitEvents = events.filter((event) => event.type === "enemyHit" && event.detail.actionId === started.actionId);
  assert.equal(hitEvents.length, 3);
  assert.ok(hitEvents.every((event) => event.detail.hit.actionId === started.actionId));
  const recallHitIndex = events.findIndex((event) => event.type === "enemyHit" && event.detail.actionId === started.actionId && event.detail.poiseDamage === 38);
  const pullIndex = events.findIndex((event) => event.type === "claimPulled" && event.detail.actionId === started.actionId);
  assert.ok(recallHitIndex >= 0 && recallHitIndex < pullIndex);
  assert.ok(enemy.position.x < beforeX);
  assert.equal(enemy.active, false);
  assert.equal(game.combat.harvest.snapshot().units, HARVEST_CONFIG.gainUnits.kill);
});

test("a Claim queen kill defers terminal cancellation, preserves its ID, and terminates the pass", () => {
  const { game, input, events } = createGame("CLAIM-QUEEN-TERMINAL");
  for (const actor of game.director.enemies) actor.active = false;
  game.director.pendingWaves.length = 0;
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.setAimPoint({ x: 10, z: 0 });
  const queen = game.director.spawnEnemy("queen", { x: 1, z: 0 }, 10);
  queen.health = 1;
  queen.maxHealth = 1;
  queen.state = "chase";
  const second = game.director.spawnEnemy("thrall", { x: 1.1, z: 0 }, 10);
  second.health = 200;
  second.maxHealth = 200;
  second.speed = 0;
  const secondHealth = second.health;
  events.length = 0;

  input.press("claim", 300);
  for (let step = 0; step < 12 && !events.some((event) => event.type === "endingSequenceStarted"); step += 1) {
    game.updateFixed(RUN_CONFIG.fixedStep);
  }

  const started = events.find((event) => event.type === "claimStarted");
  const queenHit = events.find((event) => event.type === "enemyHit" && event.detail.id === queen.id);
  const claimHit = events.find((event) => event.type === "claimHit" && event.detail.targetId === queen.id);
  assert.ok(started && queenHit && claimHit);
  assert.equal(queenHit.detail.actionId, started.detail.actionId);
  assert.equal(claimHit.detail.actionId, started.detail.actionId);
  assert.equal(claimHit.detail.hit.actionId, started.detail.actionId);
  assert.equal(second.health, secondHealth);
  assert.equal(events.some((event) => event.type === "enemyHit" && event.detail.id === second.id), false);
  assert.equal(events.filter((event) => event.type === "claimCompleted").length, 1);
  assert.equal(events.filter((event) => event.type === "endingSequenceStarted").length, 1);
  assert.ok(events.findIndex((event) => event.type === "enemyDefeated" && event.detail.id === queen.id)
    < events.findIndex((event) => event.type === "claimHit" && event.detail.targetId === queen.id));
  assert.ok(events.findIndex((event) => event.type === "claimHit" && event.detail.targetId === queen.id)
    < events.findIndex((event) => event.type === "claimCompleted"));
  assert.equal(game.claimSnapshots.previous, game.claimSnapshots.current);
  assert.equal(game.claimSnapshots.current.phase, "idle");
});

test("recall kills emit no false pull while a surviving light target is pulled after damage", () => {
  const { game, input, events } = createGame("CLAIM-RECALL-PULL");
  for (const actor of game.director.enemies) actor.active = false;
  game.director.pendingWaves.length = 0;
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.setAimPoint({ x: 10, z: 0 });
  const killed = game.director.spawnEnemy("thrall", { x: 4, z: 0 }, 1);
  killed.health = 70;
  killed.maxHealth = 70;
  const survivor = game.director.spawnEnemy("thrall", { x: 4, z: 0.2 }, 1);
  survivor.health = 500;
  survivor.maxHealth = 500;
  for (const enemy of [killed, survivor]) {
    enemy.speed = 0;
    enemy.attackCooldown = 999;
  }
  events.length = 0;

  input.press("claim", 350);
  for (let step = 0; step < 44; step += 1) game.updateFixed(RUN_CONFIG.fixedStep);

  const killedRecall = events.findIndex((event) => event.type === "enemyHit"
    && event.detail.id === killed.id && event.detail.poiseDamage === 38);
  const survivorRecall = events.findIndex((event) => event.type === "enemyHit"
    && event.detail.id === survivor.id && event.detail.poiseDamage === 38);
  const survivorPull = events.findIndex((event) => event.type === "claimPulled" && event.detail.targetId === survivor.id);
  assert.ok(killedRecall >= 0 && survivorRecall >= 0 && survivorPull > survivorRecall);
  assert.equal(events.some((event) => event.type === "claimPulled" && event.detail.targetId === killed.id), false);
  assert.ok(events[survivorPull].detail.applied > 0);
});

test("normal hits use real input, structured action IDs, multipliers, and kill healing", () => {
  const { game, input, events } = createGame("NORMAL-HIT-INTEGRATION");
  for (const actor of game.director.enemies) actor.active = false;
  game.director.pendingWaves.length = 0;
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.setAimPoint({ x: 10, z: 0 });
  game.player.damageMultiplier = 1.5;
  game.player.reachMultiplier = 1.2;
  game.player.criticalChance = 1;
  game.player.health = game.player.maxHealth - 20;
  game.player.healthOnKill = 7;
  const enemy = game.director.spawnEnemy("reaver", { x: 5, z: 0 }, 1);
  enemy.health = 20;
  enemy.speed = 0;
  enemy.attackCooldown = 999;
  const harvestBefore = game.combat.harvest.snapshot().units;

  runNormalAttack(game, input);
  const action = events.findLast((event) => event.type === "attack").detail;
  const enemyHits = events.filter((event) => event.type === "enemyHit" && event.detail.actionId === action.actionId);
  assert.equal(enemyHits.length, 1);
  assert.ok(enemyHits[0].detail.hit);
  assert.equal(enemyHits[0].detail.damage, SCYTHE_ATTACKS[0].damage * 1.5 * 1.75);
  assert.equal(game.combat.harvest.snapshot().units - harvestBefore,
    HARVEST_CONFIG.gainUnits.critical + HARVEST_CONFIG.gainUnits.kill);
  assert.equal(game.player.health, game.player.maxHealth - 13);
  const afterDefeat = game.combat.harvest.snapshot().units;
  game.phase = "playing";
  runNormalAttack(game, input, 900);
  assert.equal(game.combat.harvest.snapshot().units, afterDefeat);
});

test("selective hit-stop applies the exact finisher, critical, charge, and Claim-recall policies", () => {
  const normal = createGame("HIT-STOP-ORDINARY");
  prepareStationaryArena(normal.game);
  normal.events.length = 0;
  normal.game.rng = { chance: () => false };
  normal.game.nextNormalActionId();
  normal.game.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);
  assert.equal(normal.game.hitStop.remaining(), 0);
  assert.equal(normal.events.some((event) => event.type === "hitStopRequested"), false);

  const cases = [
    ["finisher", SCYTHE_ATTACKS[2], false, "comboFinisher"],
    ["critical", SCYTHE_ATTACKS[0], true, "critical"],
    ["partial", chargedAttack("partial"), false, "chargePartial"],
    ["full", chargedAttack("full"), false, "chargeFull"],
    ["perfect-overlap", chargedAttack("perfect"), true, "chargePerfect"],
    ["line", Object.freeze({ ...STRAIGHT_CHARGE_ATTACK, chargeKind: "line" }), false, "lineCharge"],
  ];
  for (const [name, attack, critical, policyName] of cases) {
    const { game, events } = createGame(`HIT-STOP-${name}`);
    prepareStationaryArena(game);
    events.length = 0;
    game.rng = { chance: () => critical };
    const actionId = game.nextNormalActionId();
    game.resolvePlayerAttack(attack, new Set(), 0);
    const requested = events.filter((event) => event.type === "hitStopRequested");
    const policy = HIT_STOP_CONFIG.policies[policyName];
    assert.equal(requested.length, 1, name);
    assert.deepEqual(requested[0].detail, {
      tier: policy.tier,
      duration: policy.duration,
      remaining: policy.duration,
      actionId,
      reason: policyName,
    });
    assert.equal(Object.isFrozen(requested[0].detail), true);
  }

  const claim = createGame("HIT-STOP-CLAIM-RECALL");
  const [target] = prepareStationaryArena(claim.game);
  claim.events.length = 0;
  claim.game.resolveClaimHit({ actionId: "claim-recall-policy", pass: "recall", target, definition: CLAIM_CONFIG.recall });
  const recall = claim.events.filter((event) => event.type === "hitStopRequested");
  const recallPolicy = HIT_STOP_CONFIG.policies.claimRecall;
  assert.equal(recall.length, 1);
  assert.deepEqual(recall[0].detail, {
    tier: recallPolicy.tier,
    duration: recallPolicy.duration,
    remaining: recallPolicy.duration,
    actionId: "claim-recall-policy",
    reason: "claimRecall",
  });
});

test("multi-target qualifying hits request one max duration rather than summing", () => {
  const { game, events } = createGame("HIT-STOP-MULTI");
  prepareStationaryArena(game, [{ x: 4, z: -0.2 }, { x: 4, z: 0.2 }]);
  events.length = 0;
  game.rng = { chance: () => false };
  game.nextNormalActionId();
  game.resolvePlayerAttack(SCYTHE_ATTACKS[2], new Set(), 0);
  const requested = events.filter((event) => event.type === "hitStopRequested");
  assert.equal(requested.length, 1);
  assert.equal(game.hitStop.remaining(), HIT_STOP_CONFIG.policies.comboFinisher.duration);
});

test("hit-stop captures input while every gameplay timer and actor freezes, then resumes", () => {
  const { game, input } = createGame("HIT-STOP-FREEZE");
  const [enemy] = prepareStationaryArena(game, [{ x: 8, z: 6 }]);
  game.player.invulnerable = 0.4;
  game.combat.startAttack(SCYTHE_ATTACKS[0], 0, false, 0);
  const projectile = game.director.spawnProjectile({ x: 7, z: 6 }, 0, 1, 0, 2, "violet");
  const frozen = {
    playerPosition: { ...game.player.position },
    invulnerable: game.player.invulnerable,
    attackTime: game.combat.attackTime,
    enemyPosition: { ...enemy.position },
    enemyCooldown: enemy.attackCooldown,
    projectilePosition: { ...projectile.position },
    projectileLife: projectile.life,
  };
  let captureCalls = 0;
  const captureInput = game.combat.captureInput.bind(game.combat);
  game.combat.captureInput = (source) => {
    captureCalls += 1;
    return captureInput(source);
  };
  input.press("attack", 1);
  input.press("dash", 2);
  input.press("heavy", 3, true);
  input.press("claim", 4);
  game.hitStop.request(RUN_CONFIG.fixedStep * 2, "medium");

  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(captureCalls, 1);
  assert.deepEqual(game.player.position, frozen.playerPosition);
  assert.equal(game.player.invulnerable, frozen.invulnerable);
  assert.equal(game.combat.attackTime, frozen.attackTime);
  assert.deepEqual(enemy.position, frozen.enemyPosition);
  assert.equal(enemy.attackCooldown, frozen.enemyCooldown);
  assert.deepEqual(projectile.position, frozen.projectilePosition);
  assert.equal(projectile.life, frozen.projectileLife);
  assert.equal(game.combat.attackBuffer, PLAYER_CONFIG.combat.attackBuffer);
  assert.equal(game.combat.dashBuffer, PLAYER_CONFIG.combat.dashBuffer);
  assert.equal(game.combat.heavyBuffer, PLAYER_CONFIG.combat.heavyBuffer);
  assert.equal(game.combat.claimBuffer, CLAIM_CONFIG.inputBuffer);

  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(captureCalls, 2);
  assert.equal(game.hitStop.remaining(), 0);
  assert.equal(game.combat.attackTime, frozen.attackTime);
  assert.equal(enemy.attackCooldown, frozen.enemyCooldown);
  assert.equal(projectile.life, frozen.projectileLife);

  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.ok(game.combat.attackTime > frozen.attackTime);
  assert.ok(game.player.invulnerable < frozen.invulnerable);
  assert.ok(enemy.attackCooldown < frozen.enemyCooldown);
  assert.ok(projectile.life < frozen.projectileLife);
});

test("paused and non-playing updates preserve hit-stop while run, room, and terminal transitions clear it", () => {
  const { game } = createGame("HIT-STOP-PHASES");
  const duration = HIT_STOP_CONFIG.policies.chargeFull.duration;
  game.hitStop.request(duration, "medium");
  game.phase = "paused";
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(game.hitStop.remaining(), duration);
  game.phase = "bookend";
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(game.hitStop.remaining(), duration);
  game.phase = "playing";
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.ok(game.hitStop.remaining() < duration);

  game.startRun("HIT-STOP-RUN-RESET");
  assert.equal(game.hitStop.remaining(), 0);
  game.hitStop.request(duration, "medium");
  game.loadRoom();
  assert.equal(game.hitStop.remaining(), 0);
  game.hitStop.request(duration, "medium");
  game.setPhase("dead");
  assert.equal(game.hitStop.remaining(), 0);
});

test("perfect charged reap uses core poise and grants its Harvest bonus once per action", () => {
  const { game, input, events } = createGame("PERFECT-CHARGE-IMPACT");
  const enemies = prepareStationaryArena(game, [{ x: 4, z: -0.3 }, { x: 4.5, z: 0.3 }]);
  game.player.criticalChance = 0;
  const beforeHarvest = game.combat.harvest.snapshot().units;
  const beforePoise = enemies.map((enemy) => enemy.poise);
  events.length = 0;
  const startTime = 1_000;
  input.press("heavy", startTime, true);
  game.updateFixed(RUN_CONFIG.fixedStep);
  input.release("heavy", startTime + CHARGE_CONFIG.timing.perfectOpen * 1_000);
  for (let step = 0; step < 60 && events.filter((event) => event.type === "enemyHit").length < 2; step += 1) {
    game.updateFixed(RUN_CONFIG.fixedStep);
  }

  const attack = events.find((event) => event.type === "attack")?.detail;
  assert.equal(attack.chargeQuality, "perfect");
  assert.equal(attack.poiseDamage, CHARGE_CONFIG.qualities.perfect.poiseDamage);
  assert.equal(attack.harvestUnits, HARVEST_CONFIG.gainUnits.perfectCharge);
  assert.equal(Object.isFrozen(attack), true);
  for (let index = 0; index < enemies.length; index += 1) {
    assert.equal(enemies[index].poise, beforePoise[index] - CHARGE_CONFIG.qualities.perfect.poiseDamage);
  }
  assert.equal(
    game.combat.harvest.snapshot().units - beforeHarvest,
    HARVEST_CONFIG.gainUnits.perfectCharge,
  );
  assert.equal(events.filter((event) => event.type === "harvestChanged" && event.detail.reason === "perfectCharge").length, 1);
  assert.equal(events.filter((event) => event.type === "hitStopRequested" && event.detail.reason === "chargePerfect").length, 1);
});

test("close-hit Harvest uses the configured inclusive boundary and deduplicates active frames", () => {
  const { game, input, events } = createGame("CLOSE-HIT-BOUNDARY");
  for (const actor of game.director.enemies) actor.active = false;
  game.director.pendingWaves.length = 0;
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.player.criticalChance = 0;
  game.setAimPoint({ x: 10, z: 0 });
  const inside = game.director.spawnEnemy("reaver", { x: HARVEST_CONFIG.closeHitRange, z: 0 }, 1);
  const outside = game.director.spawnEnemy("reaver", { x: HARVEST_CONFIG.closeHitRange + 0.01, z: 0 }, 1);
  for (const enemy of [inside, outside]) {
    enemy.health = 500;
    enemy.maxHealth = 500;
    enemy.speed = 0;
    enemy.attackCooldown = 999;
  }
  const before = game.combat.harvest.snapshot().units;

  runNormalAttack(game, input);

  const normalHits = events.filter((event) => event.type === "enemyHit" && event.detail.actionId?.startsWith("attack-"));
  assert.equal(normalHits.length, 2);
  assert.equal(events.filter((event) => event.type === "harvestChanged" && event.detail.reason === "closeHit").length, 1);
  assert.equal(game.combat.harvest.snapshot().units - before, HARVEST_CONFIG.gainUnits.closeHit);
});

test("run and room replacement flush stale raw Claim presses before simulation", () => {
  const input = createInput();
  const game = new Game(input, createSettings());
  const events = [];
  game.on((event) => events.push(event));
  input.press("claim", 1);
  game.startRun("STALE-RUN-EDGE");
  while (game.phase === "bookend") game.continueBookend();
  events.length = 0;
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(events.some((event) => event.type === "claimStarted"), false);
  assert.equal(game.combat.harvest.snapshot().units, HARVEST_CONFIG.floorMinimumUnits);

  input.press("claim", 2);
  game.loadRoom();
  while (game.phase === "bookend") game.continueBookend();
  events.length = 0;
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(events.some((event) => event.type === "claimStarted"), false);
  assert.equal(game.combat.harvest.snapshot().units, HARVEST_CONFIG.floorMinimumUnits);
});

test("representative normal combat gain schedule supports approximately two to four Claims", () => {
  const representativeUnits = 6 * HARVEST_CONFIG.gainUnits.kill
    + 12 * HARVEST_CONFIG.gainUnits.closeHit
    + HARVEST_CONFIG.gainUnits.critical;
  const claimSegments = representativeUnits / HARVEST_CONFIG.unitsPerSegment;
  assert.ok(claimSegments >= 2 && claimSegments <= 4, `representative schedule produced ${claimSegments} Claim segments`);
  assert.ok(HARVEST_CONFIG.closeHitRange < SCYTHE_ATTACKS[0].range);
  assert.equal(Object.isFrozen(HARVEST_CONFIG), true);
});

test("run, room, death, portal, title, and ending entry cancel Claim idempotently", () => {
  const cases = [
    ["runReset", ({ game }) => game.startRun("RESET-REPLACEMENT")],
    ["roomReplacement", ({ game }) => game.loadRoom()],
    ["death", ({ game }) => { game.phase = "playing"; game.player.health = 1; game.player.invulnerable = 0; game.damagePlayer(2, "test"); }],
    ["portal", ({ game }) => { game.phase = "playing"; game.portalActive = true; game.roomRewardPending = false; game.beginPortalTraversal(); }],
    ["title", ({ game }) => game.returnToTitle()],
    ["ending", ({ game }) => game.startEndingFlow()],
  ];
  for (const [name, invoke] of cases) {
    const harness = createGame(`CANCEL-${name}`);
    harness.events.length = 0;
    activateClaim(harness.game, harness.input);
    invoke(harness);
    assertCancelledOnce(harness.game, harness.events);
  }
});

test("both terminal ending resolutions cancel Claim once without duplicate completion", () => {
  for (const ending of ["kill", "timeout"]) {
    const { game, input, events } = createGame(`ENDING-${ending}`);
    events.length = 0;
    activateClaim(game, input, 1);
    game.beginEndingDecision(0);
    if (ending === "kill") game.tryKillPrincess(1);
    else game.updateEndingClock(5_000);
    game.beginEndingFade(6_000);
    game.completeEnding();
    game.completeEnding();
    assertCancelledOnce(game, events);
    assert.equal(events.filter((event) => event.type === "endingCompleted").length, 1);
  }
});
