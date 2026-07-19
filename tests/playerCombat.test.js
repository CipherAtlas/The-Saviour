import assert from "node:assert/strict";
import test from "node:test";
import { moveCircleDetailed } from "../src/game/collision.js";
import {
  CHARGE_CONFIG,
  CLAIM_CONFIG,
  DASH_ATTACK,
  HARVEST_CONFIG,
  HEAVY_ATTACK,
  PLAYER_CONFIG,
  SCYTHE_ATTACKS,
} from "../src/game/gameConfig.js";
import { PlayerCombat } from "../src/game/PlayerCombat.js";

const STEP = 1 / 60;

function createInput(chargeMode = "hold") {
  const pressed = new Set();
  const pressedAt = new Map();
  const released = new Set();
  const releasedAt = new Map();
  const down = new Set();
  return {
    settings: { get: (path) => path === "gameplay.chargeMode" ? chargeMode : null },
    press(action, held = false, timeStamp = performance.now()) {
      pressed.add(action);
      pressedAt.set(action, timeStamp);
      if (held) down.add(action);
    },
    release(action, timeStamp = performance.now()) {
      if (down.delete(action)) {
        released.add(action);
        releasedAt.set(action, timeStamp);
      }
    },
    consume(action) {
      const consumed = pressed.delete(action);
      if (consumed) pressedAt.delete(action);
      return consumed;
    },
    consumePressed(action) {
      if (!pressed.delete(action)) return null;
      const timeStamp = pressedAt.get(action) ?? performance.now();
      pressedAt.delete(action);
      return { action, binding: `Test:${action}`, timeStamp };
    },
    consumeReleased(action) {
      if (!released.delete(action)) return null;
      const timeStamp = releasedAt.get(action) ?? performance.now();
      releasedAt.delete(action);
      return { action, binding: `Test:${action}`, timeStamp };
    },
    flushActions(actions) {
      for (const action of actions) {
        pressed.delete(action);
        pressedAt.delete(action);
        released.delete(action);
        releasedAt.delete(action);
      }
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

function resolveHoldChargeAt(elapsed, { coarseStep = STEP } = {}) {
  const input = createInput("hold");
  const player = createPlayer();
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  const startTime = 1_000;
  input.press("heavy", true, startTime);
  combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  input.release("heavy", startTime + elapsed * 1_000);
  for (let step = 0; step < 80 && !events.some((event) => event.type === "chargeReleased"); step += 1) {
    combat.update(step === 0 ? coarseStep : STEP, input, player, { x: 0, y: 0 }, callbacks());
  }
  return { combat, events, release: events.find((event) => event.type === "chargeReleased")?.detail };
}

test("charged-reap timing and quality configuration is frozen, ordered, and useful", () => {
  const timing = CHARGE_CONFIG.timing;
  assert.ok(0 < timing.minimumRelease);
  assert.ok(timing.minimumRelease < timing.fullThreshold);
  assert.ok(timing.fullThreshold <= timing.perfectOpen);
  assert.ok(timing.perfectOpen < timing.perfectClose);
  assert.ok(timing.perfectClose < timing.forcedRelease);
  assert.equal(Object.isFrozen(CHARGE_CONFIG), true);
  assert.equal(Object.isFrozen(timing), true);
  assert.equal(Object.isFrozen(CHARGE_CONFIG.qualities), true);
  for (const quality of ["partial", "full", "perfect"]) {
    const values = CHARGE_CONFIG.qualities[quality];
    assert.equal(Object.isFrozen(values), true);
    assert.ok(HEAVY_ATTACK.damage * values.damageMultiplier > 0);
    assert.ok(HEAVY_ATTACK.range * values.rangeMultiplier > PLAYER_CONFIG.radius);
    assert.ok(values.poiseDamage > 0);
    assert.ok(values.harvestUnits >= 0);
  }
  assert.equal(CHARGE_CONFIG.qualities.perfect.harvestUnits, HARVEST_CONFIG.gainUnits.perfectCharge);
});

test("captured release timestamps classify every charged-reap boundary exactly once", () => {
  const { minimumRelease, fullThreshold, perfectOpen, perfectClose } = CHARGE_CONFIG.timing;
  const epsilon = 0.001;
  const cases = [
    [minimumRelease - epsilon, "partial"],
    [minimumRelease, "partial"],
    [fullThreshold - epsilon, "partial"],
    [fullThreshold, "full"],
    [perfectOpen - epsilon, "full"],
    [perfectOpen, "perfect"],
    [perfectClose - epsilon, "perfect"],
    [perfectClose, "full"],
  ];
  for (const [elapsed, quality] of cases) {
    const result = resolveHoldChargeAt(elapsed);
    assert.equal(result.release.quality, quality, `elapsed ${elapsed}`);
    assert.equal(result.events.filter((event) => event.type === "chargeReleased").length, 1);
  }
});

test("timestamp classification beats a coarse fixed step and forced release is full", () => {
  const captured = CHARGE_CONFIG.timing.perfectOpen + 0.01;
  const coarse = resolveHoldChargeAt(captured, { coarseStep: CHARGE_CONFIG.timing.fullThreshold });
  assert.equal(coarse.release.quality, "perfect");
  assert.equal(coarse.release.elapsed, captured);

  const input = createInput("hold");
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  input.press("heavy", true, 2_000);
  for (let step = 0; step < 80 && !events.some((event) => event.type === "chargeReleased"); step += 1) {
    combat.update(STEP, input, createPlayer(), { x: 0, y: 0 }, callbacks());
  }
  const forced = events.find((event) => event.type === "chargeReleased")?.detail;
  assert.equal(forced.quality, "full");
  assert.equal(forced.forced, true);
  assert.equal(forced.elapsed, CHARGE_CONFIG.timing.forcedRelease);
  assert.equal(events.filter((event) => event.type === "chargeReleased").length, 1);
});

test("hold release and toggle second-press share quality while toggle key-up is ignored", () => {
  const elapsed = CHARGE_CONFIG.timing.fullThreshold + 0.03;
  const hold = resolveHoldChargeAt(elapsed).release;
  const input = createInput("toggle");
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  const player = createPlayer();
  input.press("heavy", true, 3_000);
  combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  input.release("heavy", 3_100);
  combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  assert.equal(combat.chargingHeavy, true);
  assert.equal(events.some((event) => event.type === "chargeReleased"), false);
  input.press("heavy", true, 3_000 + elapsed * 1_000);
  combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  const toggled = events.find((event) => event.type === "chargeReleased")?.detail;
  assert.equal(toggled.quality, hold.quality);
  assert.equal(toggled.elapsed, hold.elapsed);
});

test("chargeReleased is immutable, linked to one action, and carries resolved attack values", () => {
  const { combat, events, release } = resolveHoldChargeAt(CHARGE_CONFIG.timing.perfectOpen);
  const attack = combat.attack;
  const attackEvent = events.find((event) => event.type === "attack")?.detail;
  assert.equal(Object.isFrozen(release), true);
  assert.equal(Object.isFrozen(attackEvent), true);
  assert.equal(events.filter((event) => event.type === "chargeReleased").length, 1);
  assert.equal(release.actionId, attack.chargeActionId);
  assert.equal(release.releaseTime, release.inputTime);
  assert.equal(release.damage, attack.damage);
  assert.equal(release.range, attack.range);
  assert.equal(release.poiseDamage, attack.poiseDamage);
  assert.equal(release.harvestUnits, attack.harvestUnits);
  assert.equal(release.quality, "perfect");
  assert.equal(attackEvent.chargeActionId, attack.chargeActionId);
  assert.equal(attackEvent.chargeQuality, attack.chargeQuality);
  assert.equal(attackEvent.poiseDamage, attack.poiseDamage);
  assert.equal(attackEvent.harvestUnits, attack.harvestUnits);
});

test("no fixed update freezes charge time and flushed release edges cannot fire later", () => {
  const input = createInput("hold");
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  const player = createPlayer();
  input.press("heavy", true, 4_000);
  combat.update(0.1, input, player, { x: 0, y: 0 }, callbacks());
  const beforePause = combat.heavyCharge;
  input.release("heavy", 9_000);
  input.flushActions(["heavy"]);
  assert.equal(combat.heavyCharge, beforePause);
  combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  assert.equal(events.some((event) => event.type === "chargeReleased"), false);
  assert.equal(combat.heavyCharge, beforePause + STEP);
});

test("perfect-dash timing is frozen, ordered, and contained by dash protection", () => {
  const dash = PLAYER_CONFIG.dash;
  assert.equal(Object.isFrozen(dash), true);
  assert.equal(dash.perfectOpen, 0);
  assert.equal(dash.perfectClose, 0.12);
  assert.ok(0 <= dash.perfectOpen);
  assert.ok(dash.perfectOpen < dash.perfectClose);
  assert.ok(dash.perfectClose <= dash.duration);
  assert.ok(dash.duration < dash.invulnerability);
});

test("dash consumes a timestamped press and emits deeply frozen action provenance", () => {
  const input = createInput();
  const player = createPlayer();
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  input.press("dash", false, 7_777);
  combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());

  const dash = events.find((event) => event.type === "dash")?.detail;
  assert.equal(dash.actionId, "dash-1");
  assert.equal(dash.inputTime, 7_777);
  assert.equal(dash.elapsed, 0);
  assert.equal(dash.perfectOpen, PLAYER_CONFIG.dash.perfectOpen);
  assert.equal(dash.perfectClose, PLAYER_CONFIG.dash.perfectClose);
  assert.deepEqual(dash.direction, { x: 1, z: 0 });
  assert.equal(Object.isFrozen(dash), true);
  assert.equal(Object.isFrozen(dash.position), true);
  assert.equal(Object.isFrozen(dash.direction), true);
});

test("perfect dash qualifies exactly on [open, close), once, and only while active", () => {
  const qualifyAt = (elapsed) => {
    const combat = new PlayerCombat(() => {});
    combat.startDash(createPlayer(), { x: 1, y: 0 }, { timeStamp: 100 });
    if (elapsed > 0) combat.advanceDash(elapsed, { x: 0, y: 0 });
    return { combat, result: combat.qualifyPerfectDash() };
  };

  const open = qualifyAt(PLAYER_CONFIG.dash.perfectOpen);
  assert.equal(open.result.accepted, true);
  assert.equal(open.result.elapsed, PLAYER_CONFIG.dash.perfectOpen);
  assert.equal(Object.isFrozen(open.result), true);
  assert.equal(Object.isFrozen(open.result.direction), true);
  assert.equal(open.combat.qualifyPerfectDash().reason, "alreadyResolved");
  assert.equal(qualifyAt(PLAYER_CONFIG.dash.perfectClose - 0.000001).result.accepted, true);
  assert.equal(qualifyAt(PLAYER_CONFIG.dash.perfectClose).result.reason, "outsideWindow");
  assert.equal(new PlayerCombat(() => {}).qualifyPerfectDash().reason, "inactive");
});

test("inherited protection must expire before qualification and dash cancellation closes eligibility", () => {
  const protectedPlayer = createPlayer();
  protectedPlayer.invulnerable = 0.05;
  const protectedCombat = new PlayerCombat(() => {});
  protectedCombat.startDash(protectedPlayer, { x: 1, y: 0 }, { timeStamp: 200 });
  assert.equal(protectedCombat.qualifyPerfectDash().reason, "inheritedInvulnerability");
  protectedCombat.advanceDash(0.05, { x: 0, y: 0 });
  assert.equal(protectedCombat.qualifyPerfectDash().accepted, true);

  const ended = new PlayerCombat(() => {});
  ended.startDash(createPlayer(), { x: 1, y: 0 });
  ended.advanceDash(PLAYER_CONFIG.dash.duration, { x: 0, y: 0 });
  assert.equal(ended.qualifyPerfectDash().reason, "inactive");

  const walled = new PlayerCombat(() => {});
  walled.startDash(createPlayer(), { x: 1, y: 0 });
  walled.resolveMovement({ blockedX: true, blockedZ: true });
  assert.equal(walled.qualifyPerfectDash().reason, "inactive");

  const reset = new PlayerCombat(() => {});
  reset.startDash(createPlayer(), { x: 1, y: 0 });
  reset.reset();
  assert.equal(reset.qualifyPerfectDash().reason, "inactive");
});

test("every active dash emits one deeply frozen dashEnded event across completion, wall, and reset", () => {
  const cases = [
    ["ended", (combat) => combat.advanceDash(PLAYER_CONFIG.dash.duration, { x: 0, y: 0 })],
    ["wall", (combat) => combat.resolveMovement({ blockedX: true, blockedZ: true })],
    ["reset", (combat) => combat.reset()],
  ];
  for (const [reason, finish] of cases) {
    const events = [];
    const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
    combat.startDash(createPlayer(), { x: 1, y: 0 }, { timeStamp: 321 });
    finish(combat);
    combat.cancelDash("duplicate", true);
    const ended = events.filter((event) => event.type === "dashEnded");
    assert.equal(ended.length, 1, reason);
    assert.equal(ended[0].detail.actionId, "dash-1");
    assert.equal(ended[0].detail.inputTime, 321);
    assert.equal(ended[0].detail.duration, PLAYER_CONFIG.dash.duration);
    assert.equal(ended[0].detail.reason, reason);
    assert.deepEqual(ended[0].detail.direction, { x: 1, z: 0 });
    assert.equal(Object.isFrozen(ended[0].detail), true);
    assert.equal(Object.isFrozen(ended[0].detail.direction), true);
  }
});

test("terminal cancellation clears attacks, charge, dash, and buffers without owning Claim", () => {
  const combat = new PlayerCombat(() => {});
  combat.claim.requestStart({ origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, inputTime: 1 });
  combat.startAttack(SCYTHE_ATTACKS[0], 0);
  combat.startHeavyCharge(createPlayer(), 2, "hold");
  combat.startDash(createPlayer(), { x: 1, y: 0 }, { timeStamp: 3 });
  combat.attackBuffer = 1;
  combat.heavyBuffer = 1;
  combat.dashBuffer = 1;
  combat.claimBuffer = 1;

  const first = combat.cancelPlayerActions("terminal");
  const second = combat.cancelPlayerActions("terminal");
  assert.equal(first.attackCancelled, true);
  assert.equal(first.chargeCancelled, true);
  assert.equal(first.dashCancelled, true);
  assert.deepEqual(second, {
    reason: "terminal",
    attackCancelled: false,
    chargeCancelled: false,
    dashCancelled: false,
    dash: second.dash,
  });
  assert.equal(combat.claim.phase, "outbound");
  assert.equal(combat.attack, null);
  assert.equal(combat.chargingHeavy, false);
  assert.equal(combat.isDashing, false);
  assert.deepEqual([combat.attackBuffer, combat.heavyBuffer, combat.dashBuffer, combat.claimBuffer], [0, 0, 0, 0]);
});

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

test("Claim spends one segment and blocks normal weapon actions until recovery completes", () => {
  const input = createInput();
  const player = createPlayer(0);
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  combat.harvest.ensureFloorMinimum();

  input.press("claim");
  combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  assert.equal(combat.harvest.snapshot().units, 0);
  assert.equal(combat.claim.snapshot().weaponDetached, true);
  assert.equal(events.find((event) => event.type === "claimStarted").detail.harvestUnits, 0);

  input.press("attack");
  input.press("heavy", true);
  combat.update(STEP, input, player, { x: 0, y: 0 }, callbacks());
  assert.equal(combat.attack, null);
  assert.equal(combat.chargingHeavy, false);

  combat.claim.update(
    CLAIM_CONFIG.outbound.duration + CLAIM_CONFIG.recall.duration + CLAIM_CONFIG.empoweredWindow
      + CLAIM_CONFIG.recoveryDuration,
    () => [],
  );
  input.release("heavy");
  assert.equal(combat.claim.snapshot().phase, "idle");
});

test("Claim permits dash cancellation only after the physical scythe is caught", () => {
  const input = createInput();
  const player = createPlayer();
  const combat = new PlayerCombat(() => {});
  combat.harvest.ensureFloorMinimum();
  input.press("claim");
  combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());

  input.press("dash");
  combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  assert.equal(combat.isDashing, false);
  for (let frame = 0; frame < 60 && combat.claim.snapshot().weaponDetached; frame += 1) {
    combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  }
  assert.equal(combat.dashBuffer, 0);
  assert.equal(combat.isDashing, false);
  assert.equal(combat.claim.snapshot().phase, "empoweredWindow");

  input.press("dash");
  combat.update(STEP, input, player, { x: 1, y: 0 }, callbacks());
  assert.equal(combat.isDashing, true);
  assert.equal(combat.claim.snapshot().phase, "idle");
});

test("Claim start validation cannot spend Harvest and insufficient rejection details are frozen", () => {
  const input = createInput();
  const invalidPlayer = createPlayer(Number.NaN);
  const invalidEvents = [];
  const invalidCombat = new PlayerCombat((type, detail) => invalidEvents.push({ type, detail }));
  invalidCombat.harvest.ensureFloorMinimum();
  input.press("claim");
  invalidCombat.update(STEP, input, invalidPlayer, { x: 0, y: 0 }, callbacks());
  assert.equal(invalidCombat.harvest.snapshot().units, CLAIM_CONFIG.costSegments * 100);
  assert.equal(invalidCombat.claim.snapshot().phase, "idle");
  assert.equal(invalidEvents.find((event) => event.type === "claimRejected").detail.reason, "invalidRequest");

  const insufficientInput = createInput();
  const insufficientEvents = [];
  const insufficientCombat = new PlayerCombat((type, detail) => insufficientEvents.push({ type, detail }));
  insufficientInput.press("claim");
  insufficientCombat.update(STEP, insufficientInput, createPlayer(), { x: 0, y: 0 }, callbacks());
  const rejection = insufficientEvents.find((event) => event.type === "claimRejected");
  assert.equal(rejection.detail.reason, "insufficientHarvest");
  assert.equal(Object.isFrozen(rejection.detail), true);
});

test("dash cancellation during Claim recovery does not duplicate completion", () => {
  const input = createInput();
  const events = [];
  const combat = new PlayerCombat((type, detail) => events.push({ type, detail }));
  combat.harvest.ensureFloorMinimum();
  input.press("claim");
  combat.update(STEP, input, createPlayer(), { x: 1, y: 0 }, callbacks());
  for (let frame = 0; frame < 90 && combat.claim.snapshot().phase !== "recovery"; frame += 1) {
    combat.update(STEP, input, createPlayer(), { x: 1, y: 0 }, callbacks());
  }
  assert.equal(combat.claim.snapshot().phase, "recovery");
  input.press("dash");
  combat.update(STEP, input, createPlayer(), { x: 1, y: 0 }, callbacks());
  assert.equal(combat.isDashing, true);
  assert.equal(events.filter((event) => event.type === "claimCompleted").length, 1);
});
