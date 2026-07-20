import assert from "node:assert/strict";
import test from "node:test";
import { circleIntersectsArc, circleIntersectsLine, moveCircle, moveCircleDetailed } from "../src/game/collision.js";
import { BLESSINGS } from "../src/game/blessings.js";
import { Game } from "../src/game/Game.js";
import { DASH_ATTACK, HEAVY_ATTACK, PLAYER_CONFIG, PORTAL_CONFIG, RUN_CONFIG, SCYTHE_ATTACKS, STRAIGHT_CHARGE_ATTACK } from "../src/game/gameConfig.js";
import { PlayerCombat } from "../src/game/PlayerCombat.js";

function createGameInput(movement) {
  return {
    settings: { get: (path) => path === "gameplay.chargeMode" ? "hold" : null },
    movement: () => movement,
    isDown: () => false,
    consume: () => false,
  };
}

function createGameSettings() {
  const values = {
    "gameplay.difficulty": "standard",
    "gameplay.autoTarget": 0,
    "gameplay.aimAssist": 0,
  };
  return { get: (path) => values[path] };
}

function finishOpening(game) {
  while (game.phase === "bookend") game.continueBookend();
}

test("the scythe combo maintains long reach and grows through the chain", () => {
  assert.ok(SCYTHE_ATTACKS.every((attack) => attack.range >= 4));
  assert.ok(SCYTHE_ATTACKS[2].range > SCYTHE_ATTACKS[0].range);
  assert.ok(SCYTHE_ATTACKS[2].damage > SCYTHE_ATTACKS[1].damage);
  assert.ok(DASH_ATTACK.range > SCYTHE_ATTACKS[2].range);
});

test("the heavy reap covers the complete circle", () => {
  assert.equal(HEAVY_ATTACK.arc, Math.PI * 2);
  const origin = { x: 0, z: 0 };
  for (const target of [{ x: 5, z: 0 }, { x: -5, z: 0 }, { x: 0, z: 5 }, { x: 0, z: -5 }]) {
    assert.equal(circleIntersectsArc(origin, 0, HEAVY_ATTACK.range, HEAVY_ATTACK.arc, target, 0.3), true);
  }
});

test("attack events expose the same timeline used by hit detection", () => {
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));

  combat.startAttack(SCYTHE_ATTACKS[0], 0);

  assert.equal(events[0].type, "attack");
  assert.equal(events[0].detail.duration, SCYTHE_ATTACKS[0].duration);
  assert.equal(events[0].detail.activeStart, SCYTHE_ATTACKS[0].activeStart);
  assert.equal(events[0].detail.activeEnd, SCYTHE_ATTACKS[0].activeEnd);
  assert.equal(events[0].detail.range, SCYTHE_ATTACKS[0].range);
  assert.equal(events[0].detail.arc, SCYTHE_ATTACKS[0].arc);
});

test("arc collision rejects targets behind a forward sweep", () => {
  const origin = { x: 0, z: 0 };
  assert.equal(circleIntersectsArc(origin, 0, 4.5, Math.PI / 2, { x: 3.5, z: 0 }, 0.5), true);
  assert.equal(circleIntersectsArc(origin, 0, 4.5, Math.PI / 2, { x: -2, z: 0 }, 0.5), false);
  assert.equal(circleIntersectsArc(origin, 0, 4.5, Math.PI / 2, { x: 6, z: 0 }, 0.5), false);
});

test("Grave Line collision is a thick forward rectangle with no curved side coverage", () => {
  const origin = { x: 0, z: 0 };
  const attack = STRAIGHT_CHARGE_ATTACK;
  assert.equal(circleIntersectsLine(origin, 0, attack.range, attack.width, { x: 8.8, z: 0 }, 0.3), true);
  assert.equal(circleIntersectsLine(origin, 0, attack.range, attack.width, { x: 5, z: attack.width / 2 + 0.31 }, 0.3), false);
  assert.equal(circleIntersectsLine(origin, 0, attack.range, attack.width, { x: -1, z: 0 }, 0.3), false);
  assert.equal(circleIntersectsLine(origin, Math.PI / 2, attack.range, attack.width, { x: 0, z: 7 }, 0.3), true);
  assert.equal(circleIntersectsLine(origin, Math.PI / 2, attack.range, attack.width, { x: 4, z: 4 }, 0.3), false);
});

test("dash invulnerability outlasts the movement burst", () => {
  assert.ok(PLAYER_CONFIG.dash.invulnerability > PLAYER_CONFIG.dash.duration);
  assert.ok(PLAYER_CONFIG.dash.speed > PLAYER_CONFIG.speed * 2);
});

test("circle movement stays inside walls and cannot pass through obstacles", () => {
  const arena = {
    width: 20,
    depth: 14,
    obstacles: [{ x: 2, z: 0, width: 2, depth: 2 }],
  };
  const wallResult = moveCircle({ x: 8, z: 0 }, { x: 20, z: 0 }, 1, 0.5, arena);
  assert.equal(wallResult.x, 8.5);
  const obstacleResult = moveCircle({ x: 0, z: 0 }, { x: 5, z: 0 }, 0.4, 0.5, arena);
  assert.ok(obstacleResult.x <= 0.5);

  const detailed = moveCircleDetailed({ x: 8.4, z: 0 }, { x: 20, z: 2 }, 0.2, 0.5, arena);
  assert.equal(detailed.blockedX, true);
  assert.equal(detailed.blockedZ, false);
  assert.deepEqual(moveCircle({ x: 8.4, z: 0 }, { x: 20, z: 2 }, 0.2, 0.5, arena), detailed.position);
});

test("player attacks use their committed facing rather than live mouse rotation", () => {
  const pressed = new Set();
  const input = createGameInput({ x: 0, y: 0 });
  input.consume = (action) => pressed.delete(action);
  const game = new Game(input, createGameSettings());
  game.startRun("COMMITTED-FACING");
  finishOpening(game);
  for (const actor of game.director.enemies) actor.active = false;
  game.director.pendingWaves.length = 0;
  game.player.position = { x: 0, z: 0 };
  game.player.previousPosition = { x: 0, z: 0 };
  game.player.criticalChance = 0;
  const committedTarget = game.director.spawnEnemy("thrall", { x: 3, z: 0 }, 1);
  const liveAimTarget = game.director.spawnEnemy("thrall", { x: 0, z: 3 }, 1);
  committedTarget.speed = 0;
  liveAimTarget.speed = 0;
  committedTarget.attackCooldown = 999;
  liveAimTarget.attackCooldown = 999;
  const events = [];
  game.on((event) => events.push(event));

  game.setAimPoint({ x: 10, z: 0 });
  pressed.add("attack");
  game.updateFixed(RUN_CONFIG.fixedStep);
  const action = events.find((event) => event.type === "attack");
  game.setAimPoint({ x: 0, z: 10 });
  for (let step = 0; step < 20 && events.every((event) => event.type !== "enemyHit"); step += 1) {
    game.updateFixed(RUN_CONFIG.fixedStep);
  }

  const hits = events.filter((event) => event.type === "enemyHit");
  assert.deepEqual(hits.map((event) => event.detail.id), [committedTarget.id]);
  assert.equal(hits[0].detail.actionId, action.detail.actionId);
  assert.equal(hits[0].detail.hit.actionId, action.detail.actionId);
  assert.equal(Object.isFrozen(hits[0].detail), true);
  assert.equal(Object.isFrozen(hits[0].detail.hit), true);
  assert.equal(liveAimTarget.health, liveAimTarget.maxHealth);
});

test("screen-up movement reaches the player through the complete simulation path", () => {
  const game = new Game(createGameInput({ x: 0, y: 1 }), createGameSettings());
  game.startRun("MOVEMENT-REGRESSION");
  finishOpening(game);
  const before = { ...game.player.position };

  game.updateFixed(1 / 60);

  const dx = game.player.position.x - before.x;
  const dz = game.player.position.z - before.z;
  assert.ok(Number.isFinite(dx) && Number.isFinite(dz));
  assert.ok(Math.hypot(dx, dz) > 0.1);
  assert.ok(dx < 0 && dz < 0, "W should move toward the top of the 45-degree camera view");
});

test("clearing a room grants bounded threshold recovery before the next encounter", () => {
  const game = new Game(createGameInput({ x: 0, y: 0 }), createGameSettings());
  const recoveries = [];
  game.on((event) => { if (event.type === "roomRecovered") recoveries.push(event.detail); });
  game.startRun("RECOVERY-CHECK");
  finishOpening(game);
  game.player.health = 40;
  game.director.enemies.length = 0;

  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);

  assert.equal(game.player.health, 61);
  assert.equal(game.portalActive, true);
  assert.equal(game.phase, "playing");
  assert.equal(game.activeBookend, null);
  assert.equal(recoveries[0].amount, 21);

  assert.equal(game.beginPortalTraversal(), true);
  game.updatePortalTraversal(PORTAL_CONFIG.traversalDuration);
  assert.equal(game.phase, "reward");
});

test("the Moonwell floor blessing increases percentage recovery on later chamber clears", () => {
  const game = new Game(createGameInput({ x: 0, y: 0 }), createGameSettings());
  game.startRun("RECOVERY-BLESSING");
  finishOpening(game);
  BLESSINGS.find((blessing) => blessing.id === "moonwell-renewal").apply(game.player);
  game.player.health = 40;
  game.director.enemies.length = 0;

  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);

  assert.equal(game.player.health, 72);
});

test("Final Mercy converts one lethal hit into a bounded Death Defiance recovery", () => {
  const game = new Game(createGameInput({ x: 0, y: 0 }), createGameSettings());
  const revivals = [];
  game.on((event) => { if (event.type === "playerRevived") revivals.push(event.detail); });
  game.startRun("FINAL-MERCY");
  finishOpening(game);
  BLESSINGS.find((blessing) => blessing.id === "final-mercy").apply(game.player);
  game.player.health = 5;

  game.damagePlayer(20, "testLethalHit");

  assert.equal(game.phase, "playing");
  assert.equal(game.player.health, 49);
  assert.equal(game.player.deathDefiance, 0);
  assert.equal(game.player.invulnerable, 1.2);
  assert.equal(revivals.length, 1);

  game.player.invulnerable = 0;
  game.damagePlayer(80, "testSecondLethalHit");
  assert.equal(game.phase, "dead");
});

test("direct system damage remains a normal seam and cannot infer a perfect dash", () => {
  const game = new Game(createGameInput({ x: 0, y: 0 }), createGameSettings());
  const events = [];
  game.on((event) => events.push(event));
  game.startRun("DIRECT-DAMAGE-NO-PERFECT-DASH");
  finishOpening(game);
  game.combat.startDash(game.player, { x: 1, y: 0 }, { timeStamp: 50 });
  game.player.invulnerable = 0;
  const beforeHealth = game.player.health;
  const beforeHarvest = game.combat.harvest.snapshot().units;

  game.damagePlayer(10, "systemTest");

  assert.equal(game.player.health, beforeHealth - 10);
  assert.equal(game.combat.harvest.snapshot().units, beforeHarvest);
  assert.equal(events.some((event) => event.type === "perfectDash"), false);
  assert.equal(events.filter((event) => event.type === "playerHit").at(-1).detail.source, "systemTest");
});
