import assert from "node:assert/strict";
import test from "node:test";
import { particleDensityForSettings } from "../src/rendering/EffectsPool.js";
import {
  applyCombatPresentation,
  combatPresentationDescriptor,
  GameRenderer,
} from "../src/rendering/GameRenderer.js";

function recordingPool() {
  return {
    bursts: [],
    rings: [],
    spawnBurst(position, color, count, force) {
      this.bursts.push({ position, color, count, force });
    },
    spawnRing(position, radius, color, duration) {
      this.rings.push({ position, radius, color, duration });
    },
  };
}

function recordingCamera() {
  return {
    trauma: [],
    addTrauma(value) {
      this.trauma.push(value);
    },
  };
}

function rendererHarness(settingOverrides = {}) {
  const effects = recordingPool();
  const cameraSystem = recordingCamera();
  const settings = {
    "accessibility.screenFlashes": true,
    "camera.reducedMotion": false,
    ...settingOverrides,
  };
  const renderer = Object.create(GameRenderer.prototype);
  renderer.actorRenderer = null;
  renderer.lastEnemyHitPresentation = null;
  renderer.effects = effects;
  renderer.cameraSystem = cameraSystem;
  renderer.settings = { get: (key) => settings[key] };
  return { renderer, effects, cameraSystem };
}

const playerPosition = Object.freeze({ x: 2, z: -3 });

test("Harvest gain and spend have distinct readable player-position accents", () => {
  const gain = combatPresentationDescriptor("harvestChanged", { delta: 12 }, { playerPosition });
  const spend = combatPresentationDescriptor("harvestChanged", { delta: -100 }, { playerPosition });

  assert.deepEqual(gain.bursts[0].position, playerPosition);
  assert.deepEqual(spend.bursts[0].position, playerPosition);
  assert.notEqual(gain.bursts[0].color, spend.bursts[0].color);
  assert.equal(gain.rings.length, 1);
  assert.equal(spend.rings.length, 2);
  assert.deepEqual(combatPresentationDescriptor("harvestChanged", { delta: 0 }, { playerPosition }).rings, []);
});

test("Claim throw, recall, catch, ready, consumed, and completion phases all carry bounded accents", () => {
  const phaseEvents = [
    ["claimStarted", { origin: { x: 1, z: 1 } }],
    ["claimRecallStarted", { position: { x: 7, z: 1 } }],
    ["claimCaught", { position: playerPosition }],
    ["claimFollowupReady", {}],
    ["claimFollowupConsumed", {}],
    ["claimCompleted", { result: "cleave" }],
    ["claimCompleted", { result: "expired" }],
    ["claimCompleted", { result: "cancelled" }],
  ];

  for (const [type, detail] of phaseEvents) {
    const descriptor = combatPresentationDescriptor(type, detail, { playerPosition });
    assert.ok(descriptor.bursts.length + descriptor.rings.length > 0, `${type} needs an accent`);
    assert.ok(descriptor.bursts.length <= 1, `${type} must remain pool-bounded`);
    assert.ok(descriptor.rings.length <= 2, `${type} must remain pool-bounded`);
  }
});

test("Harvest and Claim descriptors stay within the approved Zephyr presentation palette", () => {
  const approvedColors = new Set([
    0xd9aa52,
    0xffd985,
    0x74e2ff,
    0xe3fbff,
    0x82e6a1,
    0x9aa3ad,
    0x6f747c,
  ]);
  const enemyPosition = { x: -5, z: 4 };
  const events = [
    ["harvestChanged", { delta: 12 }, { playerPosition }],
    ["harvestChanged", { delta: -100 }, { playerPosition }],
    ["claimStarted", { origin: playerPosition }, { playerPosition }],
    ["claimRecallStarted", { position: enemyPosition }, { playerPosition }],
    ["claimCaught", { position: playerPosition }, { playerPosition }],
    ["claimFollowupReady", {}, { playerPosition }],
    ["claimFollowupConsumed", {}, { playerPosition }],
    ["claimCompleted", { result: "cleave" }, { playerPosition }],
    ["claimCompleted", { result: "expired" }, { playerPosition }],
    ["claimCompleted", { result: "cancelled" }, { playerPosition }],
    ["claimHit", { pass: "outbound" }, { resolvedEnemyPosition: enemyPosition }],
    ["claimHit", { pass: "recall" }, { resolvedEnemyPosition: enemyPosition }],
    ["claimPulled", {}, { resolvedEnemyPosition: enemyPosition }],
  ];

  const colors = events.flatMap(([type, detail, options]) => {
    const descriptor = combatPresentationDescriptor(type, detail, options);
    return [...descriptor.bursts, ...descriptor.rings].map((effect) => effect.color);
  });

  assert.ok(colors.length > 0);
  for (const color of colors) {
    assert.ok(approvedColors.has(color), `0x${color.toString(16)} is outside the Zephyr/Harvest/neutral palette`);
  }

  const outbound = combatPresentationDescriptor("claimHit", { pass: "outbound" }, { resolvedEnemyPosition: enemyPosition });
  const recall = combatPresentationDescriptor("claimHit", { pass: "recall" }, { resolvedEnemyPosition: enemyPosition });
  assert.equal(outbound.rings[0].color, 0xd9aa52);
  assert.equal(recall.rings[0].color, 0x74e2ff);
});

test("Claim hit adds a phase ring at the resolved enemy without duplicating the generic impact burst", () => {
  const { renderer, effects, cameraSystem } = rendererHarness();
  const game = { player: { position: playerPosition } };
  const enemyPosition = { x: 5, z: 4 };

  renderer.handleEvent({
    type: "enemyHit",
    detail: {
      id: "enemy-1",
      actionId: "claim-1",
      position: enemyPosition,
      critical: false,
    },
  }, game);
  assert.equal(effects.bursts.length, 1);
  assert.equal(cameraSystem.trauma.length, 1);

  renderer.handleEvent({
    type: "claimHit",
    detail: { actionId: "claim-1", targetId: "enemy-1", pass: "outbound" },
  }, game);

  assert.equal(effects.bursts.length, 1, "the generic enemyHit burst must remain the only hit burst");
  assert.equal(cameraSystem.trauma.length, 1, "the generic enemyHit trauma must remain the only hit trauma");
  assert.equal(effects.rings.length, 1);
  assert.deepEqual(effects.rings[0].position, enemyPosition);

  const outbound = combatPresentationDescriptor("claimHit", { pass: "outbound" }, { resolvedEnemyPosition: enemyPosition });
  const recall = combatPresentationDescriptor("claimHit", { pass: "recall" }, { resolvedEnemyPosition: enemyPosition });
  assert.notEqual(outbound.rings[0].color, recall.rings[0].color);
  assert.notEqual(outbound.rings[0].radius, recall.rings[0].radius);
  assert.equal(outbound.bursts.length, 0);
  assert.equal(recall.bursts.length, 0);
});

test("pull and stagger accents resolve at the affected enemy position", () => {
  const enemyPosition = { x: -4, z: 6 };
  const effects = recordingPool();
  const camera = recordingCamera();
  const pull = combatPresentationDescriptor("claimPulled", {}, { resolvedEnemyPosition: enemyPosition });
  const stagger = combatPresentationDescriptor("enemyStaggered", { position: enemyPosition });

  applyCombatPresentation(pull, effects, camera);
  applyCombatPresentation(stagger, effects, camera);

  assert.deepEqual(effects.bursts.map((burst) => burst.position), [enemyPosition, enemyPosition]);
  assert.deepEqual(effects.rings.map((ring) => ring.position), [enemyPosition, enemyPosition]);
  assert.deepEqual(camera.trauma, [stagger.trauma]);

  const harness = rendererHarness();
  const pulledPosition = { x: -1, z: 2 };
  const game = {
    player: { position: playerPosition },
    director: { enemies: [{ id: "enemy-2", position: pulledPosition }] },
  };
  harness.renderer.handleEvent({
    type: "claimPulled",
    detail: { actionId: "claim-2", targetId: "enemy-2" },
  }, game);
  assert.deepEqual(harness.effects.bursts[0].position, pulledPosition);
  assert.deepEqual(harness.effects.rings[0].position, pulledPosition);
});

test("accessibility settings reduce secondary intensity without removing the gameplay tell", () => {
  const normal = combatPresentationDescriptor("claimCaught", { position: playerPosition }, {
    playerPosition,
    reducedMotion: false,
    screenFlashes: true,
  });
  const reduced = combatPresentationDescriptor("claimCaught", { position: playerPosition }, {
    playerPosition,
    reducedMotion: true,
    screenFlashes: false,
  });

  assert.equal(reduced.bursts.length, normal.bursts.length);
  assert.equal(reduced.rings.length, normal.rings.length);
  assert.equal(reduced.bursts[0].color, normal.bursts[0].color);
  assert.ok(reduced.rings[0].radius > 0 && reduced.rings[0].radius < normal.rings[0].radius);
  assert.ok(reduced.trauma > 0 && reduced.trauma < normal.trauma);

  const settings = (reducedParticles, effectsDensity) => ({
    get(key) {
      return {
        "accessibility.reducedParticles": reducedParticles,
        "graphics.effectsDensity": effectsDensity,
      }[key];
    },
  });
  assert.equal(particleDensityForSettings(settings(false, 0.6)), 0.6);
  assert.equal(particleDensityForSettings(settings(true, 1)), 0.35);
  assert.equal(particleDensityForSettings(undefined), 1);
});

test("unknown events and incomplete Claim details are safe no-ops", () => {
  const { renderer, effects, cameraSystem } = rendererHarness();

  assert.doesNotThrow(() => renderer.handleEvent({ type: "claimHit" }));
  assert.doesNotThrow(() => renderer.handleEvent({ type: "unknownPresentationEvent", detail: null }));
  assert.doesNotThrow(() => applyCombatPresentation(null, effects, cameraSystem));
  assert.deepEqual(combatPresentationDescriptor("claimHit", null), {
    bursts: [],
    rings: [],
    trauma: 0,
  });
  assert.equal(effects.bursts.length, 0);
  assert.equal(effects.rings.length, 0);
  assert.equal(cameraSystem.trauma.length, 0);
});

test("every player action contract has one bounded actor-attached presentation in the approved palette", () => {
  const approvedColors = new Set([
    0xd9aa52,
    0xffd985,
    0x74e2ff,
    0xe3fbff,
    0x82e6a1,
    0x9aa3ad,
    0x6f747c,
    0xef4f62,
    0xf7f2d0,
  ]);
  const events = [
    ["attack", { comboIndex: 0 }],
    ["attack", { comboIndex: 1 }],
    ["attack", { comboIndex: 2 }],
    ["attack", { comboIndex: -1, dash: true }],
    ["attack", { comboIndex: -1, heavy: true }],
    ["chargeStart", {}],
    ["chargeReleased", { quality: "partial" }],
    ["chargeReleased", { quality: "full" }],
    ["chargeReleased", { quality: "perfect" }],
    ["dash", {}],
    ["dashEnded", { reason: "ended" }],
    ["perfectDash", {}],
    ["playerHit", { severity: "light", direction: { x: 1, z: 0 } }],
    ["playerHit", { severity: "heavy", direction: { x: -1, z: 0 } }],
    ["playerHealed", { amount: 8, reason: "kill" }],
    ["playerHealed", { amount: 49, reason: "deathDefiance" }],
    ["endingStrikeStarted", {}],
    ["princessStruck", {}],
    ["endingStrikeCompleted", {}],
  ];

  for (const [type, detail] of events) {
    const descriptor = combatPresentationDescriptor(type, detail, {
      playerPosition,
      endingTargetPosition: { x: 2.5, z: 2.1 },
    });
    assert.ok(descriptor.bursts.length + descriptor.rings.length > 0, `${type} needs attached feedback`);
    assert.ok(descriptor.bursts.length <= 1, `${type} exceeds the burst contract`);
    assert.ok(descriptor.rings.length <= 2, `${type} exceeds the ring contract`);
    for (const effect of [...descriptor.bursts, ...descriptor.rings]) {
      assert.ok(approvedColors.has(effect.color), `${type} uses unapproved color 0x${effect.color.toString(16)}`);
    }
  }
});

test("reduced motion preserves action meaning while reducing only secondary scale and trauma", () => {
  const action = ["chargeReleased", { quality: "perfect" }];
  const normal = combatPresentationDescriptor(...action, {
    playerPosition,
    reducedMotion: false,
    screenFlashes: true,
  });
  const reduced = combatPresentationDescriptor(...action, {
    playerPosition,
    reducedMotion: true,
    screenFlashes: false,
  });
  assert.equal(reduced.bursts.length, normal.bursts.length);
  assert.equal(reduced.rings.length, normal.rings.length);
  assert.equal(reduced.bursts[0].color, normal.bursts[0].color);
  assert.ok(reduced.rings[0].radius < normal.rings[0].radius);
  assert.ok(reduced.trauma < normal.trauma);
});
