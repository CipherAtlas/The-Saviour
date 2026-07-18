import assert from "node:assert/strict";
import test from "node:test";
import { circleIntersectsArc, moveCircle, moveCircleDetailed } from "../src/game/collision.js";
import { BLESSINGS } from "../src/game/blessings.js";
import { Game } from "../src/game/Game.js";
import { DASH_ATTACK, HEAVY_ATTACK, PLAYER_CONFIG, RUN_CONFIG, SCYTHE_ATTACKS } from "../src/game/gameConfig.js";
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
  while (game.phase === "dialogue") game.skipDialogue();
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
  const game = new Game(createGameInput({ x: 0, y: 0 }), createGameSettings());
  game.player = {
    position: { x: 0, z: 0 },
    aimAngle: Math.PI / 2,
    reachMultiplier: 1,
    damageMultiplier: 1,
    criticalChance: 0,
    healthOnKill: 0,
  };
  game.rng = { chance: () => false };
  game.director.enemies = [
    { id: 1, active: true, position: { x: 3, z: 0 }, radius: 0.4 },
    { id: 2, active: true, position: { x: 0, z: 3 }, radius: 0.4 },
  ];
  const hits = [];
  game.director.damageEnemy = (enemy) => {
    hits.push(enemy.id);
    return false;
  };

  game.resolvePlayerAttack(SCYTHE_ATTACKS[0], new Set(), 0);

  assert.deepEqual(hits, [1]);
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
  assert.equal(game.portalActive, false);
  assert.equal(game.phase, "reward");
  assert.equal(recoveries[0].amount, 21);
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
