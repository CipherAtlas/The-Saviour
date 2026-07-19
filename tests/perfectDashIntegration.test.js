import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import { CLAIM_CONFIG, HARVEST_CONFIG, RUN_CONFIG } from "../src/game/gameConfig.js";

function createInput() {
  const pressed = new Map();
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume(action) { return this.consumePressed(action) !== null; },
    consumePressed(action) {
      const detail = pressed.get(action) ?? null;
      pressed.delete(action);
      return detail;
    },
    consumeReleased: () => null,
    press(action, timeStamp = 0) { pressed.set(action, { action, binding: `Test:${action}`, timeStamp }); },
    flushActions(actions) { for (const action of actions) pressed.delete(action); },
  };
}

function createSettings() {
  const values = { "gameplay.difficulty": "standard", "gameplay.autoTarget": 0, "gameplay.aimAssist": 0 };
  return { get: (path) => values[path] };
}

function createGame(seed) {
  const input = createInput();
  const game = new Game(input, createSettings());
  const events = [];
  game.on((event) => events.push(event));
  game.startRun(seed);
  while (game.phase === "dialogue") game.skipDialogue();
  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves.length = 0;
  game.phase = "playing";
  events.length = 0;
  return { game, input, events };
}

function damageAttempt(overrides = {}) {
  return Object.freeze({
    attemptId: overrides.attemptId ?? "player-damage-test-1",
    actionId: overrides.actionId ?? "enemy-action-test-1",
    amount: overrides.amount ?? 20,
    source: overrides.source ?? "crosscut",
    family: overrides.family ?? "circle",
    enemyId: overrides.enemyId ?? 41,
    enemyType: overrides.enemyType ?? "reaver",
    enemyOrigin: overrides.enemyOrigin ?? "witch",
    projectileId: overrides.projectileId ?? null,
  });
}

function startDash(game, input, timeStamp = 500) {
  input.press("dash", timeStamp);
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.equal(game.combat.isDashing, true);
  return game.combat.dashActionId;
}

test("a qualifying hostile attempt grants perfect dash once without health loss, playerHit, or hit-stop", () => {
  const { game, input, events } = createGame("PERFECT-DASH-SUCCESS");
  const beforeHealth = game.player.health;
  const beforeHarvest = game.combat.harvest.snapshot().units;
  const dashActionId = startDash(game, input, 777);
  const attempt = damageAttempt({
    attemptId: "player-damage-perfect",
    actionId: "enemy-action-crosscut",
    source: "crosscut",
    family: "circle",
    enemyId: 7,
  });

  const result = game.resolvePlayerDamageAttempt(attempt);

  assert.equal(result.perfectDash, true);
  assert.equal(result.damaged, false);
  assert.equal(game.player.health, beforeHealth);
  assert.equal(game.combat.harvest.snapshot().units - beforeHarvest, HARVEST_CONFIG.gainUnits.perfectDash);
  assert.equal(events.some((event) => event.type === "playerHit"), false);
  assert.equal(events.some((event) => event.type === "hitStopRequested"), false);
  const perfect = events.find((event) => event.type === "perfectDash")?.detail;
  assert.equal(perfect.actionId, dashActionId);
  assert.equal(perfect.inputTime, 777);
  assert.equal(perfect.elapsed, 0);
  assert.equal(perfect.windowOpen, 0);
  assert.equal(perfect.windowClose, 0.12);
  assert.equal(perfect.attemptId, attempt.attemptId);
  assert.equal(perfect.sourceActionId, attempt.actionId);
  assert.equal(perfect.source, attempt.source);
  assert.equal(perfect.family, attempt.family);
  assert.equal(perfect.enemyId, attempt.enemyId);
  assert.equal(perfect.floor, game.floor);
  assert.equal(perfect.room, game.room);
  assert.equal(Object.isFrozen(perfect), true);
  assert.equal(Object.isFrozen(perfect.position), true);
  assert.equal(Object.isFrozen(perfect.direction), true);
});

test("near misses, late dash iframes, inherited protection, and no-dash attempts never infer rewards", () => {
  const noDash = createGame("PERFECT-DASH-NONE");
  const noDashHealth = noDash.game.player.health;
  noDash.game.resolvePlayerDamageAttempt(damageAttempt());
  assert.equal(noDash.game.player.health, noDashHealth - 20);
  assert.equal(noDash.events.some((event) => event.type === "perfectDash"), false);

  const late = createGame("PERFECT-DASH-LATE");
  startDash(late.game, late.input);
  late.game.combat.advanceDash(0.12, { x: 0, y: 0 });
  const lateHealth = late.game.player.health;
  late.game.resolvePlayerDamageAttempt(damageAttempt());
  assert.equal(late.game.player.health, lateHealth);
  assert.equal(late.events.some((event) => event.type === "perfectDash"), false);
  assert.equal(late.events.some((event) => event.type === "playerHit"), false);

  const inherited = createGame("PERFECT-DASH-INHERITED");
  inherited.game.player.invulnerable = 0.2;
  startDash(inherited.game, inherited.input);
  inherited.game.resolvePlayerDamageAttempt(damageAttempt());
  assert.equal(inherited.events.some((event) => event.type === "perfectDash"), false);
  assert.equal(inherited.events.some((event) => event.type === "playerHit"), false);
});

test("a full Harvest cap still consumes the dash reward and simultaneous attempts cannot duplicate it", () => {
  const { game, input, events } = createGame("PERFECT-DASH-CAP");
  game.combat.harvest.units = HARVEST_CONFIG.maxUnits;
  game.harvestSnapshot = game.combat.harvest.snapshot();
  startDash(game, input);
  const beforeHealth = game.player.health;

  const first = game.resolvePlayerDamageAttempt(damageAttempt({ attemptId: "player-damage-simultaneous-1" }));
  const second = game.resolvePlayerDamageAttempt(damageAttempt({ attemptId: "player-damage-simultaneous-2" }));

  assert.equal(first.perfectDash, true);
  assert.equal(second.perfectDash, false);
  assert.equal(second.reason, "invulnerable");
  assert.equal(game.player.health, beforeHealth);
  assert.equal(game.combat.harvest.snapshot().units, HARVEST_CONFIG.maxUnits);
  assert.equal(events.filter((event) => event.type === "perfectDash").length, 1);
  assert.equal(events.filter((event) => event.type === "harvestGainRejected" && event.detail.reason === "capOverflow").length, 1);
  assert.equal(events.some((event) => event.type === "playerHit"), false);
});

test("ordinary hostile damage preserves immutable provenance and direct damage remains separate", () => {
  const { game, events } = createGame("PLAYER-DAMAGE-PROVENANCE");
  const attempt = damageAttempt({
    attemptId: "player-damage-projectile",
    actionId: "enemy-action-lance",
    source: "queenLance",
    family: "directProjectile",
    enemyId: 99,
    enemyType: "queen",
    projectileId: "projectile-12",
  });
  const beforeHealth = game.player.health;

  const result = game.resolvePlayerDamageAttempt(attempt);

  assert.equal(result.damaged, true);
  assert.equal(game.player.health, beforeHealth - attempt.amount);
  const playerHit = events.find((event) => event.type === "playerHit")?.detail;
  assert.equal(playerHit.attemptId, attempt.attemptId);
  assert.equal(playerHit.actionId, attempt.actionId);
  assert.equal(playerHit.family, attempt.family);
  assert.equal(playerHit.enemyId, attempt.enemyId);
  assert.equal(playerHit.enemyType, attempt.enemyType);
  assert.equal(playerHit.enemyOrigin, attempt.enemyOrigin);
  assert.equal(playerHit.projectileId, attempt.projectileId);
  assert.equal(Object.isFrozen(playerHit), true);

  game.player.invulnerable = 0;
  const eventCount = events.filter((event) => event.type === "perfectDash").length;
  game.damagePlayer(5, "systemHazard");
  assert.equal(events.filter((event) => event.type === "perfectDash").length, eventCount);
});

test("pause and hit-stop freeze dash eligibility until fixed-step play resumes", () => {
  const { game, input } = createGame("PERFECT-DASH-FREEZE");
  startDash(game, input);
  const elapsed = game.combat.dashElapsed;
  const inherited = game.combat.dashInheritedInvulnerability;
  game.phase = "paused";
  game.updateFixed(0.05);
  assert.equal(game.combat.dashElapsed, elapsed);
  assert.equal(game.combat.dashInheritedInvulnerability, inherited);

  game.phase = "playing";
  game.hitStop.request(0.05, "medium");
  game.updateFixed(0.05);
  assert.equal(game.combat.dashElapsed, elapsed);
  assert.equal(game.combat.dashInheritedInvulnerability, inherited);
  game.updateFixed(RUN_CONFIG.fixedStep);
  assert.ok(game.combat.dashElapsed > elapsed);
});

test("terminal and wall cancellation close eligibility while Claim and charge dash-cancels stay valid", () => {
  const terminal = createGame("PERFECT-DASH-TERMINAL");
  startDash(terminal.game, terminal.input);
  terminal.game.setPhase("dead");
  assert.equal(terminal.game.combat.qualifyPerfectDash().reason, "inactive");

  const wall = createGame("PERFECT-DASH-WALL");
  startDash(wall.game, wall.input);
  wall.game.combat.resolveMovement({ blockedX: true, blockedZ: true });
  assert.equal(wall.game.combat.qualifyPerfectDash().reason, "inactive");

  const charge = createGame("PERFECT-DASH-CHARGE-CANCEL");
  charge.game.combat.startHeavyCharge(charge.game.player, 10, "hold");
  startDash(charge.game, charge.input, 20);
  assert.equal(charge.game.combat.chargingHeavy, false);
  assert.equal(charge.game.combat.qualifyPerfectDash().accepted, true);

  const claim = createGame("PERFECT-DASH-CLAIM-CANCEL");
  claim.input.press("claim", 30);
  claim.game.updateFixed(RUN_CONFIG.fixedStep);
  claim.game.combat.claim.update(
    CLAIM_CONFIG.outbound.duration + CLAIM_CONFIG.recall.duration,
    { querySweep: () => [], resolveHit: () => null },
  );
  assert.equal(claim.game.combat.claim.phase, "empoweredWindow");
  startDash(claim.game, claim.input, 40);
  assert.equal(claim.game.combat.claim.phase, "idle");
  assert.equal(claim.game.combat.qualifyPerfectDash().accepted, true);
});
