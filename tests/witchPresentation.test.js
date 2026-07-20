import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  EnemyCharacterRenderer,
  queenSpecialPresentationContract,
  sampleQueenActorPresentation,
} from "../src/rendering/EnemyCharacterRenderer.js";
import {
  EffectsPool,
  queenTelegraphDescriptors,
} from "../src/rendering/EffectsPool.js";
import { witchPresentationDescriptor } from "../src/rendering/GameRenderer.js";
import { ENEMY_MODEL_KEYS } from "../src/rendering/enemyVisualProfiles.js";

const CLIPS = [
  "Idle_Combat",
  "Running_A",
  "Skeletons_Awaken_Standing",
  "Hit_A",
  "Death_C_Skeletons",
  "Spellcast_Long",
  "Spellcast_Summon",
  "Dodge_Forward",
];

const settings = {
  get(key) {
    return {
      "accessibility.highContrast": false,
      "accessibility.reducedParticles": false,
      "accessibility.screenFlashes": true,
      "camera.reducedMotion": false,
      "gameplay.aimAssist": 0,
      "graphics.effectsDensity": 1,
    }[key] ?? 0;
  },
};

function createRenderer() {
  const scene = new THREE.Scene();
  const renderer = new EnemyCharacterRenderer(scene, {});
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.8, 0.5),
    new THREE.MeshStandardMaterial(),
  ));
  for (const key of ENEMY_MODEL_KEYS) renderer.assets.set(key, { scene: template, animations: [] });
  for (const name of CLIPS) renderer.clips.set(name, new THREE.AnimationClip(name, 1, []));
  return renderer;
}

function enemy(id, type = "queen", overrides = {}) {
  const position = overrides.position ?? { x: 2, z: 1 };
  return {
    id,
    type,
    origin: "stable",
    originPhase: 0,
    active: true,
    dismissed: false,
    position,
    previousPosition: overrides.previousPosition ?? { ...position },
    facing: { x: 0, z: 1 },
    maxHealth: 100,
    health: 100,
    hitFlash: 0,
    state: "chase",
    actionTimer: 0,
    attackPending: false,
    attackKind: null,
    attackWindup: 0,
    bossPhase: type === "queen" ? 1 : null,
    resistanceClass: type === "queen" ? "boss" : "light",
    ...overrides,
  };
}

test("Witch body presentation contracts cover every special stage and return to rest", () => {
  assert.deepEqual(queenSpecialPresentationContract("teleport", "anticipation", 0.48), {
    action: "teleport",
    stage: "anticipation",
    clip: "Spellcast_Long",
    duration: 0.48,
  });
  assert.equal(queenSpecialPresentationContract("teleport", "release").clip, "Dodge_Forward");
  assert.equal(queenSpecialPresentationContract("teleport", "recovery").duration, 0.14);
  assert.equal(queenSpecialPresentationContract("summon", "release").clip, "Spellcast_Summon");
  assert.equal(queenSpecialPresentationContract("summon", "recovery").duration, 0.26);
  assert.ok(Math.abs(
    queenSpecialPresentationContract("teleport", "release").duration
      + queenSpecialPresentationContract("teleport", "recovery").duration
      - 0.24,
  ) < 1e-9);
  assert.ok(Math.abs(
    queenSpecialPresentationContract("summon", "release").duration
      + queenSpecialPresentationContract("summon", "recovery").duration
      - 0.42,
  ) < 1e-9);
  assert.equal(queenSpecialPresentationContract("unknown", "release"), null);

  const teleportCoil = sampleQueenActorPresentation({
    action: "teleport",
    stage: "anticipation",
    duration: 0.48,
    remaining: 0,
  });
  const summonRelease = sampleQueenActorPresentation({
    action: "summon",
    stage: "release",
    duration: 0.16,
    remaining: 0.16,
  });
  const recovered = sampleQueenActorPresentation({
    action: "summon",
    stage: "recovery",
    duration: 0.42,
    remaining: 0,
  });
  assert.ok(teleportCoil.scaleY < 0.9 && teleportCoil.pitch > 0.1);
  assert.ok(summonRelease.scaleX > 1.1 && summonRelease.scaleY < 0.94);
  assert.deepEqual(
    [recovered.scaleX, recovered.scaleY, recovered.scaleZ, recovered.pitch, recovered.yOffset],
    [1, 1, 1, 0, 0],
  );
});

test("Witch specials retain action-ID correlation through actor anticipation, release, recovery, and cancellation", () => {
  const renderer = createRenderer();
  const witch = enemy(40);
  renderer.sync([witch], 1, 0.6);
  const record = renderer.actors.get(witch.id);

  renderer.handleEvent({
    type: "queenSpecialAnticipated",
    detail: {
      actionId: "enemy-action-7",
      enemyId: witch.id,
      action: "teleport",
      stage: "anticipation",
      duration: 0.48,
      target: { x: -3, z: 4 },
      phase: 2,
    },
  });
  assert.equal(record.queenSpecial.actionId, "enemy-action-7");
  assert.equal(record.queenSpecial.stage, "anticipation");
  assert.deepEqual(renderer.resolveAnimation(record, witch, false), {
    clip: "Spellcast_Long",
    once: true,
    duration: 0.48,
    key: "queen-special:teleport:anticipation:enemy-action-7",
  });

  renderer.handleEvent({
    type: "queenSpecialReleased",
    detail: { actionId: "enemy-action-stale", enemyId: witch.id, action: "teleport" },
  });
  assert.equal(record.queenSpecial.stage, "anticipation", "a stale release cannot advance the live action");

  renderer.handleEvent({
    type: "queenSpecialReleased",
    detail: {
      actionId: "enemy-action-7",
      enemyId: witch.id,
      action: "teleport",
      target: { x: -3, z: 4 },
    },
  });
  assert.equal(record.queenSpecial.stage, "release");
  assert.equal(renderer.resolveAnimation(record, witch, false).clip, "Dodge_Forward");
  renderer.advancePresentationTimers(record, 0.1);
  assert.equal(record.queenSpecial.stage, "recovery");
  assert.equal(renderer.resolveAnimation(record, witch, false).clip, "Idle_Combat");

  renderer.handleEvent({
    type: "queenSpecialRecovered",
    detail: { actionId: "enemy-action-7", enemyId: witch.id, action: "teleport" },
  });
  assert.equal(record.queenSpecial, null);

  renderer.handleEvent({
    type: "queenSpecialAnticipated",
    detail: { actionId: "enemy-action-8", enemyId: witch.id, action: "summon", duration: 0.68 },
  });
  assert.equal(record.queenSpecial.action, "summon");
  renderer.handleEvent({
    type: "queenSpecialCancelled",
    detail: { actionId: "enemy-action-8", enemyId: witch.id, action: "summon", reason: "phaseTransition" },
  });
  assert.equal(record.queenSpecial, null);
});

test("phase transitions animate the Witch actor and phase-three guard dismissal remains visible", () => {
  const renderer = createRenderer();
  const witch = enemy(50);
  const firstGuard = enemy(51, "thrall", { maxHealth: 20, health: 20 });
  const secondGuard = enemy(52, "reaver", { maxHealth: 30, health: 30 });
  renderer.sync([witch, firstGuard, secondGuard], 1, 0.6);

  renderer.handleEvent({
    type: "bossPhaseChanged",
    detail: { enemyId: witch.id, phase: 2, duration: 0.82, position: witch.position },
  });
  const witchRecord = renderer.actors.get(witch.id);
  witch.state = "phaseTransition";
  witch.bossPhase = 2;
  witchRecord.phaseTransition.remaining = 0.41;
  renderer.sync([witch, firstGuard, secondGuard], 1, 0);
  assert.equal(renderer.resolveAnimation(witchRecord, witch, false).clip, "Spellcast_Long");
  assert.ok(witchRecord.root.position.y > 0.1);
  assert.ok(witchRecord.root.scale.x > 1.04);

  renderer.handleEvent({
    type: "bossPhaseChanged",
    detail: { enemyId: witch.id, phase: 3, duration: 0.82, position: witch.position },
  });
  witch.bossPhase = 3;
  assert.equal(renderer.resolveAnimation(witchRecord, witch, false).clip, "Spellcast_Summon");

  renderer.handleEvent({
    type: "queenGuardsDismissed",
    detail: {
      enemyId: witch.id,
      phase: 3,
      actors: [
        { id: firstGuard.id, type: firstGuard.type, position: firstGuard.position },
        { id: secondGuard.id, type: secondGuard.type, position: secondGuard.position },
      ],
    },
  });
  firstGuard.active = false;
  firstGuard.dismissed = true;
  secondGuard.active = false;
  secondGuard.dismissed = true;
  const guardRecord = renderer.actors.get(firstGuard.id);
  assert.match(renderer.resolveAnimation(guardRecord, firstGuard, false).key, /^queen-dismissal:/);
  renderer.sync([witch, firstGuard, secondGuard], 1, 0.1);
  assert.equal(guardRecord.root.visible, true);
  assert.ok(guardRecord.root.scale.y > 0.2 && guardRecord.root.scale.y < 1);
  renderer.sync([witch, firstGuard, secondGuard], 1, 0.4);
  assert.equal(guardRecord.root.visible, false);
});

test("Witch teleport and summon telegraphs are distinct, duration-aligned, and resolved only by matching action ID", () => {
  const teleport = {
    actionId: "enemy-action-20",
    enemyId: 60,
    type: "queen",
    attack: "teleport",
    shape: "blink",
    position: { x: 1, z: 2 },
    origin: { x: 1, z: 2 },
    target: { x: -4, z: 5 },
    radius: 1.35,
    duration: 0.48,
  };
  const teleportDescriptors = queenTelegraphDescriptors(teleport);
  assert.deepEqual(teleportDescriptors.map(({ shape, telegraphRole }) => [shape, telegraphRole]), [
    ["ring", "departure"],
    ["circle", "arrival"],
  ]);
  assert.deepEqual(teleportDescriptors[0].position, teleport.origin);
  assert.deepEqual(teleportDescriptors[1].position, teleport.target);

  const pool = new EffectsPool(new THREE.Scene(), settings);
  pool.spawnTelegraph(teleport);
  assert.equal(pool.activeTelegraphCountForAction(teleport.actionId), 2);
  assert.deepEqual(
    pool.telegraphs.filter(({ active }) => active).map(({ key, telegraphRole }) => [key, telegraphRole]),
    [["ring", "departure"], ["circle", "arrival"]],
  );
  assert.equal(pool.alignTelegraphAction(teleport.actionId, 0.42), 2);
  assert.ok(pool.telegraphs.filter(({ active }) => active).every(({ life, maxLife }) => life === 0.42 && maxLife === 0.42));
  assert.equal(pool.resolveTelegraphAction("enemy-action-stale"), 0);
  assert.equal(pool.activeTelegraphCountForAction(teleport.actionId), 2);
  assert.equal(pool.resolveTelegraphAction(teleport.actionId), 2);
  assert.equal(pool.activeTelegraphCountForAction(teleport.actionId), 0);

  pool.spawnTelegraph({
    ...teleport,
    actionId: "enemy-action-21",
    attack: "summon",
    shape: "circle",
    target: teleport.position,
    radius: 3.2,
    duration: 0.68,
  });
  assert.deepEqual(
    pool.telegraphs.filter(({ active }) => active).map(({ key, telegraphRole }) => [key, telegraphRole]),
    [["ring", "summonWard"], ["circle", "summonCore"]],
  );
});

test("Witch event VFX scale by importance and include every dismissed guard", () => {
  const teleport = witchPresentationDescriptor("queenSpecialReleased", {
    action: "teleport",
    position: { x: 1, z: 2 },
    target: { x: -4, z: 5 },
  });
  assert.equal(teleport.bursts.length, 2);
  assert.equal(teleport.rings.length, 2);
  assert.ok(teleport.trauma > 0);

  const phaseTwo = witchPresentationDescriptor("bossPhaseChanged", {
    phase: 2,
    position: { x: 0, z: 0 },
  });
  const phaseThree = witchPresentationDescriptor("bossPhaseChanged", {
    phase: 3,
    position: { x: 0, z: 0 },
  });
  const reducedPhaseThree = witchPresentationDescriptor("bossPhaseChanged", {
    phase: 3,
    position: { x: 0, z: 0 },
  }, { reducedMotion: true, screenFlashes: false });
  assert.ok(phaseThree.trauma > phaseTwo.trauma);
  assert.ok(reducedPhaseThree.trauma < phaseThree.trauma);

  const dismissed = witchPresentationDescriptor("queenGuardsDismissed", {
    actors: [
      { id: 1, position: { x: 1, z: 2 } },
      { id: 2, position: { x: -2, z: 3 } },
    ],
  });
  assert.equal(dismissed.bursts.length, 2);
  assert.equal(dismissed.rings.length, 2);
});
