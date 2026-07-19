import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  EnemyCharacterRenderer,
  enemyResponseContract,
} from "../src/rendering/EnemyCharacterRenderer.js";
import {
  ENEMY_MODEL_KEYS,
  getEnemyVisualProfile,
} from "../src/rendering/enemyVisualProfiles.js";

const RESPONSE_CLIPS = [
  "Idle_Combat",
  "Running_A",
  "Skeletons_Awaken_Standing",
  "Hit_A",
  "Block",
  "Death_C_Skeletons",
];

function createRenderer({ proxies = false } = {}) {
  const scene = new THREE.Scene();
  const player = new THREE.Group();
  player.name = "player-actor";
  scene.add(player);
  const renderer = new EnemyCharacterRenderer(scene, {});
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.8, 0.5),
    new THREE.MeshStandardMaterial(),
  ));
  for (const key of ENEMY_MODEL_KEYS) renderer.assets.set(key, { scene: template, animations: [] });
  for (const name of RESPONSE_CLIPS) renderer.clips.set(name, new THREE.AnimationClip(name, 1, []));
  if (proxies) renderer.createProxyMeshes();
  return renderer;
}

function enemy(id, type = "thrall", overrides = {}) {
  const position = overrides.position ?? { x: 2, z: 1 };
  const previousPosition = overrides.previousPosition ?? { ...position };
  return {
    id,
    type,
    origin: "witch",
    originPhase: 0,
    active: true,
    dismissed: false,
    position,
    previousPosition,
    facing: { x: 0, z: 1 },
    maxHealth: 10,
    health: 10,
    hitFlash: 0,
    state: "chase",
    actionTimer: 0,
    attackPending: false,
    attackKind: null,
    attackWindup: 0,
    resistanceClass: type === "boneguard" ? "heavy" : type === "queen" ? "boss" : "light",
    ...overrides,
  };
}

function decomposeProxy(renderer, type) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  renderer.proxyMeshes.get(type).getMatrixAt(0, matrix);
  matrix.decompose(position, rotation, scale);
  return { position, rotation, scale };
}

test("pull contracts distinguish light drag from heavy and boss resistance braces", () => {
  const light = enemyResponseContract("claimPulled", { resistanceClass: "light", applied: 2.4 });
  const medium = enemyResponseContract("claimPulled", { resistanceClass: "medium", applied: 1.2 });
  const heavy = enemyResponseContract("claimPulled", { resistanceClass: "heavy", applied: 0.4 });
  const boss = enemyResponseContract("claimPulled", { resistanceClass: "boss", applied: 0 });

  assert.equal(light.kind, "pull");
  assert.equal(medium.kind, "pull");
  assert.equal(light.clipRole, "hit");
  assert.ok(light.lean > medium.lean);
  assert.equal(heavy.kind, "brace");
  assert.equal(boss.kind, "brace");
  assert.equal(heavy.clipRole, "brace");
  assert.ok(heavy.duration > 0 && boss.duration >= heavy.duration);
  assert.equal(enemyResponseContract("enemyHit", {}), null);
});

test("detailed pull response follows interpolated mechanical displacement and recovers", () => {
  const renderer = createRenderer();
  const target = enemy(1);
  renderer.sync([target], 1, 0.6);
  const record = renderer.actors.get(target.id);

  target.previousPosition = { x: 4, z: 1 };
  target.position = { x: 2, z: 1 };
  target.facing = { x: 1, z: 0 };
  const mechanicalPrevious = { ...target.previousPosition };
  const mechanicalCurrent = { ...target.position };
  renderer.handleEvent({
    type: "claimPulled",
    detail: { targetId: target.id, resistanceClass: "light", applied: 2 },
  });
  renderer.sync([target], 0.5, 0);

  assert.equal(record.response.kind, "pull");
  assert.equal(record.root.position.x, 3, "the renderer must retain normal root interpolation");
  assert.notEqual(record.root.rotation.x, 0);
  assert.ok(record.root.scale.y < 1);
  assert.match(record.stateKey, /^response:pull:/);
  assert.deepEqual(target.previousPosition, mechanicalPrevious);
  assert.deepEqual(target.position, mechanicalCurrent);

  renderer.advancePresentationTimers(record, record.responseDuration);
  target.previousPosition = { ...target.position };
  renderer.sync([target], 1, 0);
  assert.equal(record.response, null);
  assert.equal(record.root.rotation.x, 0);
  assert.deepEqual(record.root.scale.toArray(), [1, 1, 1]);
  assert.equal(renderer.resolveAnimation(record, target, false).key, "idle");
});

test("stagger uses a loaded profile hit clip for the authoritative duration and interrupts attack presentation", () => {
  const renderer = createRenderer();
  const target = enemy(2, "thrall", { state: "staggered", actionTimer: 0.73 });
  renderer.sync([target], 1, 0.6);
  const record = renderer.actors.get(target.id);
  record.releaseKind = "lunge";
  record.releaseTime = 0.2;
  record.forcedClip = "Block";
  record.forcedTime = 0.2;

  renderer.handleEvent({
    type: "enemyStaggered",
    detail: { enemyId: target.id, resistanceClass: "light", duration: 0.73 },
  });

  const animation = renderer.resolveAnimation(record, target, false);
  assert.equal(record.response.kind, "stagger");
  assert.equal(record.responseDuration, 0.73);
  assert.equal(record.releaseKind, null);
  assert.equal(record.releaseTime, 0);
  assert.equal(record.forcedClip, null);
  assert.equal(animation.clip, getEnemyVisualProfile("thrall").hitClip);
  assert.equal(animation.duration, 0.73);
  assert.match(animation.key, /^response:stagger:/);

  renderer.clips.clear();
  assert.doesNotThrow(() => renderer.resolveAnimation(record, target, false));
  renderer.advancePresentationTimers(record, 0.73);
  target.state = "chase";
  target.actionTimer = 0;
  assert.equal(record.response, null);
  assert.equal(renderer.resolveAnimation(record, target, false).key, "idle");
});

test("response events route by enemy ID and survive pending actor acquisition", () => {
  const renderer = createRenderer();
  renderer.handleEvent({
    type: "claimPulled",
    detail: { targetId: 11, resistanceClass: "light", applied: 1.4 },
  });
  renderer.handleEvent({
    type: "enemyStaggered",
    detail: { enemyId: 12, resistanceClass: "medium", duration: 0.62 },
  });
  renderer.handleEvent({
    type: "claimPulled",
    detail: { targetId: 12, resistanceClass: "medium", applied: 1 },
  });

  const pulled = enemy(11);
  const staggered = enemy(12, "thrall", { state: "staggered", actionTimer: 0.62 });
  const untouched = enemy(13);
  renderer.sync([pulled, staggered, untouched], 1, 0);

  assert.equal(renderer.actors.get(11).response.kind, "pull");
  assert.equal(renderer.actors.get(12).response.kind, "stagger", "pending stagger must outrank a later pull");
  assert.equal(renderer.actors.get(12).responseDuration, 0.62);
  assert.equal(renderer.actors.get(13).response, null);
  assert.match(renderer.actors.get(11).stateKey, /^response:pull:/);
  assert.match(renderer.actors.get(12).stateKey, /^response:stagger:/);
  assert.equal(renderer.pendingEvents.has(11), false);
  assert.equal(renderer.pendingEvents.has(12), false);
});

test("proxy actors show bounded drag and brace silhouettes without inventing root displacement", () => {
  const renderer = createRenderer({ proxies: true });
  const light = enemy(21, "thrall", { position: { x: 20, z: 1 } });
  const heavy = enemy(22, "boneguard", { position: { x: 24, z: 1 }, resistanceClass: "heavy" });
  renderer.sync([light, heavy], 1, 0.6, { allowProxies: true });

  light.previousPosition = { x: 22, z: 1 };
  light.position = { x: 20, z: 1 };
  renderer.handleEvent({
    type: "claimPulled",
    detail: { targetId: light.id, resistanceClass: "light", applied: 2 },
  });
  renderer.handleEvent({
    type: "claimPulled",
    detail: { targetId: heavy.id, resistanceClass: "heavy", applied: 0.3 },
  });
  renderer.sync([light, heavy], 0.5, 0, { allowProxies: true });

  const lightPose = decomposeProxy(renderer, "thrall");
  const heavyPose = decomposeProxy(renderer, "boneguard");
  const lightScale = getEnemyVisualProfile("thrall").scale;
  const heavyScale = getEnemyVisualProfile("boneguard").scale;
  assert.equal(lightPose.position.x, 21, "proxy root remains on the interpolated mechanical path");
  assert.ok(lightPose.scale.y / lightScale < 0.94);
  assert.ok(lightPose.rotation.angleTo(new THREE.Quaternion()) > 0.04);
  assert.ok(heavyPose.scale.x / heavyScale > 1.04);
  assert.ok(heavyPose.scale.y / heavyScale < 0.94);
  assert.ok(heavyPose.rotation.angleTo(new THREE.Quaternion()) > 0.04);
  assert.ok(lightPose.scale.y / lightScale > 0.7 && heavyPose.scale.x / heavyScale < 1.3);
});

test("death, dismissal, and uninterruptible states retain precedence and incomplete events do not throw", () => {
  const renderer = createRenderer();
  const target = enemy(31, "thrall", { state: "staggered", actionTimer: 0.5 });
  renderer.sync([target], 1, 0.6);
  const record = renderer.actors.get(target.id);
  renderer.handleEvent({
    type: "enemyStaggered",
    detail: { enemyId: target.id, resistanceClass: "light", duration: 0.5 },
  });

  const dead = { ...target, active: false, dismissed: false };
  const dismissed = { ...target, active: false, dismissed: true };
  const uninterruptible = { ...target, active: true, state: "phaseTransition" };
  assert.equal(renderer.resolveAnimation(record, dead, false).key, "death");
  assert.equal(renderer.resolveAnimation(record, dismissed, false).key, "dismissed");
  assert.doesNotMatch(renderer.resolveAnimation(record, uninterruptible, false).key, /^response:/);

  record.deathAge = 0.2;
  renderer.syncPose(record, dead);
  assert.equal(record.root.rotation.x, 0);
  assert.doesNotThrow(() => renderer.handleEvent());
  assert.doesNotThrow(() => renderer.handleEvent({ type: "claimPulled", detail: null }));
  assert.doesNotThrow(() => renderer.handleEvent({ type: "enemyStaggered", detail: {} }));
});
