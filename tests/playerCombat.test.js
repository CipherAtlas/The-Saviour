import assert from "node:assert/strict";
import test from "node:test";
import { moveCircleDetailed } from "../src/game/collision.js";
import { DASH_ATTACK, PLAYER_CONFIG, SCYTHE_ATTACKS } from "../src/game/gameConfig.js";
import { PlayerCombat } from "../src/game/PlayerCombat.js";

const STEP = 1 / 60;

function createInput(chargeMode = "hold") {
  const pressed = new Set();
  const down = new Set();
  return {
    settings: { get: (path) => path === "gameplay.chargeMode" ? chargeMode : null },
    press(action, held = false) {
      pressed.add(action);
      if (held) down.add(action);
    },
    release(action) {
      down.delete(action);
    },
    consume(action) {
      return pressed.delete(action);
    },
    isDown(action) {
      return down.has(action);
    },
  };
}

function createPlayer(aimAngle = 0) {
  return {
    position: { x: 0, z: 0 },
    aimAngle,
    invulnerable: 0,
    dashCooldownMultiplier: 1,
  };
}

function callbacks(overrides = {}) {
  return { onDash: () => {}, onActiveAttack: () => {}, ...overrides };
}

test("dash exits into decaying momentum instead of a one-frame stop", () => {
  const input = createInput();
  const player = createPlayer();
  const combat = new PlayerCombat(() => {});
  input.press("dash");

  const dashVelocity = combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  assert.equal(dashVelocity.x, PLAYER_CONFIG.dash.speed);

  let exitVelocity = null;
  for (let frame = 0; frame < 20; frame += 1) {
    const velocity = combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
    if (!combat.isDashing) {
      exitVelocity = velocity;
      break;
    }
  }

  assert.ok(exitVelocity.x > PLAYER_CONFIG.speed);
  assert.ok(exitVelocity.x < PLAYER_CONFIG.dash.speed);

  let previous = exitVelocity.x;
  for (let frame = 0; frame < 20; frame += 1) {
    const velocity = combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
    assert.ok(velocity.x <= previous + 0.0001);
    previous = velocity.x;
  }
  assert.equal(previous, 0);
});

test("dash steering is bounded and reverse input brakes carry faster", () => {
  const input = createInput();
  const player = createPlayer();
  const combat = new PlayerCombat(() => {});
  input.press("dash");
  combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());

  for (let frame = 0; frame < 6; frame += 1) {
    combat.update(STEP, input, player, { x: 0, y: 1 }, callbacks());
  }

  assert.ok(combat.dashDirection.x > 0.7);
  assert.ok(combat.dashDirection.z > 0.2);

  const neutral = new PlayerCombat(() => {});
  neutral.dashMomentum = { x: PLAYER_CONFIG.dash.exitSpeed, z: 0 };
  neutral.dashMomentumTime = PLAYER_CONFIG.dash.momentumDuration;
  neutral.movementVelocity(STEP, { x: 0, y: 0 });

  const braking = new PlayerCombat(() => {});
  braking.dashMomentum = { x: PLAYER_CONFIG.dash.exitSpeed, z: 0 };
  braking.dashMomentumTime = PLAYER_CONFIG.dash.momentumDuration;
  braking.movementVelocity(STEP, { x: -1, y: 0 });

  assert.ok(braking.dashMomentum.x < neutral.dashMomentum.x * 0.8);
});

test("wall collision clears only the blocked carry axis", () => {
  const arena = { width: 20, depth: 14, obstacles: [] };
  const result = moveCircleDetailed({ x: 8.4, z: 0 }, { x: 14, z: 4 }, 0.2, 0.5, arena);
  assert.equal(result.blockedX, true);
  assert.equal(result.blockedZ, false);

  const combat = new PlayerCombat(() => {});
  combat.dashMomentum = { x: 10, z: 4 };
  combat.dashMomentumTime = 0.2;
  combat.resolveMovement(result);
  assert.equal(combat.dashMomentum.x, 0);
  assert.equal(combat.dashMomentum.z, 4);
});

test("buffered light attacks chain before recovery and stop at the finisher", () => {
  const input = createInput();
  const player = createPlayer();
  let elapsed = 0;
  const attackEvents = [];
  const combat = new PlayerCombat((type, detail) => {
    if (type === "attack") attackEvents.push({ ...detail, elapsed });
  });
  const step = () => {
    combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
    elapsed += STEP;
  };

  input.press("attack");
  step();
  for (let frame = 0; frame < 4; frame += 1) step();
  input.press("attack");
  while (attackEvents.length < 2) step();

  assert.equal(attackEvents[1].name, SCYTHE_ATTACKS[1].name);
  assert.ok(attackEvents[1].elapsed < SCYTHE_ATTACKS[0].duration);

  for (let frame = 0; frame < 4; frame += 1) step();
  input.press("attack");
  while (attackEvents.length < 3) step();
  assert.equal(attackEvents[2].name, SCYTHE_ATTACKS[2].name);

  input.press("attack");
  for (let frame = 0; frame < 40; frame += 1) step();
  assert.equal(combat.attack, null);
  assert.equal(attackEvents.length, 3);

  input.press("attack");
  step();
  assert.equal(attackEvents[3].name, SCYTHE_ATTACKS[0].name);
});

test("dash attack accepts a buffered follow-up instead of swallowing it", () => {
  const input = createInput();
  const player = createPlayer();
  const attacks = [];
  const combat = new PlayerCombat((type, detail) => {
    if (type === "attack") attacks.push(detail.name);
  });

  input.press("dash");
  input.press("attack");
  combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  assert.equal(attacks[0], DASH_ATTACK.name);

  input.press("attack");
  for (let frame = 0; frame < 30 && attacks.length < 2; frame += 1) {
    combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  }

  assert.equal(attacks[1], SCYTHE_ATTACKS[1].name);
});

test("a buffered dash waits for recovery and then cancels deliberately", () => {
  const input = createInput();
  const player = createPlayer();
  const cancelled = [];
  const combat = new PlayerCombat((type, detail) => {
    if (type === "attackCancelled") cancelled.push(detail);
  });
  combat.startAttack(SCYTHE_ATTACKS[0], 0, false, player.aimAngle);

  while (combat.attackTime < 0.15) {
    combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  }
  input.press("dash");
  combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  assert.equal(combat.isDashing, false);
  assert.ok(combat.attack);

  for (let frame = 0; frame < 5 && !combat.isDashing; frame += 1) {
    combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  }
  assert.equal(combat.isDashing, true);
  assert.deepEqual(cancelled, [{ name: SCYTHE_ATTACKS[0].name, reason: "dash" }]);
});

test("heavy input remains buffered when an attack is about to recover", () => {
  const input = createInput();
  const player = createPlayer();
  const combat = new PlayerCombat(() => {});
  combat.startAttack(SCYTHE_ATTACKS[0], 0, false, player.aimAngle);

  while (combat.attackTime < 0.24) {
    combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  }
  input.press("heavy", true);
  for (let frame = 0; frame < 10 && !combat.chargingHeavy; frame += 1) {
    combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  }

  assert.equal(combat.chargingHeavy, true);
});

test("active hit callbacks retain the facing committed at attack start", () => {
  const input = createInput();
  const player = createPlayer(0);
  const facings = [];
  const combat = new PlayerCombat(() => {});
  combat.startAttack(SCYTHE_ATTACKS[0], 0, false, 0);
  player.aimAngle = Math.PI;

  for (let frame = 0; frame < 12; frame += 1) {
    combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks({
      onActiveAttack: (_attack, _hitIds, facing) => facings.push(facing),
    }));
  }

  assert.ok(facings.length > 0);
  assert.ok(facings.every((facing) => facing === 0));
});
