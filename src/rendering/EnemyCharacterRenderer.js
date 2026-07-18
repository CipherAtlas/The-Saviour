import * as THREE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ENEMY_ARCHETYPES } from "../game/enemyArchetypes.js";
import { createEnemyEquipment } from "./createEnemyEquipment.js";
import {
  detailedEnemyLimit,
  ENEMY_LOD_CONFIG,
  ENEMY_MODEL_KEYS,
  ENEMY_VISUAL_PROFILES,
  getEnemyAttackVisual,
  getEnemyOriginVisualProfile,
  getEnemyVisualProfile,
} from "./enemyVisualProfiles.js";

const SPAWN_DURATION = 0.56;
const SPAWN_START_SCALE_XZ = 0.94;
const SPAWN_START_SCALE_Y = 0.86;
const SPAWN_RISE_DEPTH = 0.16;
const DEATH_DURATION = 0.82;
const DISMISS_DURATION = 0.36;
const HIT_DURATION = 0.12;
const FLASH_COLOR = new THREE.Color(0xffffff);
const FLASH_EMISSIVE = new THREE.Color(0xff3b55);
const PROXY_CAPACITY_PER_TYPE = 64;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

function proxyPart(source, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  for (const attribute of Object.keys(geometry.attributes)) {
    if (attribute !== "position" && attribute !== "normal") geometry.deleteAttribute(attribute);
  }
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  source.dispose();
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

export function createEnemyProxyGeometry(type) {
  const profile = getEnemyVisualProfile(type);
  const parts = [
    proxyPart(new THREE.CapsuleGeometry(0.31, 0.58, 2, 6), [0, 1.02, 0]),
    proxyPart(new THREE.IcosahedronGeometry(0.27, 0), [0, 1.72, 0.01]),
    proxyPart(new THREE.CylinderGeometry(0.09, 0.12, 0.62, 6), [-0.17, 0.35, 0]),
    proxyPart(new THREE.CylinderGeometry(0.09, 0.12, 0.62, 6), [0.17, 0.35, 0]),
    proxyPart(new THREE.CylinderGeometry(0.075, 0.095, 0.58, 6), [-0.39, 1.05, 0], [1, 1, 1], [0, 0, -0.22]),
    proxyPart(new THREE.CylinderGeometry(0.075, 0.095, 0.58, 6), [0.39, 1.05, 0], [1, 1, 1], [0, 0, 0.22]),
  ];

  if (profile.equipment === "rustSword") {
    parts.push(proxyPart(new THREE.BoxGeometry(0.09, 0.82, 0.055), [0.5, 0.78, 0.04], [1, 1, 1], [0, 0, -0.12]));
  }
  if (profile.equipment === "twinBlades" || profile.equipment === "wraithBlades") {
    parts.push(proxyPart(new THREE.BoxGeometry(0.085, 0.62, 0.045), [-0.51, 0.83, 0.08], [1, 1, 1], [0, 0, 0.22]));
    parts.push(proxyPart(new THREE.BoxGeometry(0.085, 0.62, 0.045), [0.51, 0.83, 0.08], [1, 1, 1], [0, 0, -0.22]));
  }
  if (profile.equipment === "shieldAxe") {
    parts.push(proxyPart(new THREE.CylinderGeometry(0.38, 0.38, 0.09, 8), [-0.48, 1.02, 0.16], [1, 1, 1], [Math.PI / 2, 0, 0]));
    parts.push(proxyPart(new THREE.CylinderGeometry(0.045, 0.055, 0.88, 6), [0.5, 0.87, 0]));
    parts.push(proxyPart(new THREE.ConeGeometry(0.22, 0.44, 3), [0.61, 1.28, 0], [1, 1, 1], [0, 0, Math.PI / 2]));
  }
  if (profile.equipment === "hexStaff" || profile.equipment === "queenRegalia") {
    parts.push(proxyPart(new THREE.CylinderGeometry(0.04, 0.055, 1.45, 7), [0.5, 0.9, 0]));
    parts.push(proxyPart(new THREE.IcosahedronGeometry(profile.equipment === "queenRegalia" ? 0.22 : 0.16, 0), [0.5, 1.66, 0]));
  }
  if (profile.equipment === "cinderBomb") {
    parts.push(proxyPart(new THREE.IcosahedronGeometry(0.25, 1), [0.48, 0.92, 0.12]));
    parts.push(proxyPart(new THREE.IcosahedronGeometry(0.3, 0), [0, 1.0, -0.31], [1.05, 1.2, 0.7]));
  }
  if (profile.equipment === "queenRegalia") {
    parts.push(proxyPart(new THREE.TorusGeometry(0.26, 0.045, 6, 16), [0, 2.01, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2;
      parts.push(proxyPart(
        new THREE.ConeGeometry(0.055, 0.28, 4),
        [Math.cos(angle) * 0.2, 2.16, Math.sin(angle) * 0.2],
      ));
    }
  }
  if (type === "boneguard") parts[0].scale(1.16, 1.08, 1.16);
  if (type === "wraith") parts.push(proxyPart(new THREE.ConeGeometry(0.46, 0.82, 8, 1, true), [0, 0.53, 0]));
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error(`Unable to create 3D proxy geometry for ${type}`);
  merged.computeBoundingSphere();
  return merged;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutBack(value) {
  const shifted = value - 1;
  return 1 + 2.70158 * shifted * shifted * shifted + 1.70158 * shifted * shifted;
}

function interpolated(previous, current, alpha) {
  return previous + (current - previous) * alpha;
}

function configureAction(action, once, desiredDuration) {
  action.enabled = true;
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = once;
  const clipDuration = action.getClip().duration;
  action.setEffectiveTimeScale(desiredDuration ? clipDuration / Math.max(0.05, desiredDuration) : 1);
}

function cloneAndTintMaterials(root, tint) {
  const replacements = new Map();
  const states = [];
  const prepare = (source) => {
    if (!source) return source;
    if (replacements.has(source)) return replacements.get(source);
    const material = source.clone();
    if (material.color) material.color.multiply(new THREE.Color(tint.color));
    if (material.emissive) material.emissive.set(tint.emissive);
    if ("emissiveIntensity" in material) material.emissiveIntensity = tint.emissiveIntensity;
    if (tint.opacity != null) {
      material.transparent = true;
      material.opacity = tint.opacity;
      material.depthWrite = false;
    }
    replacements.set(source, material);
    states.push({
      material,
      color: material.color?.clone() ?? null,
      emissive: material.emissive?.clone() ?? null,
      emissiveIntensity: material.emissiveIntensity ?? 0,
      opacity: material.opacity,
    });
    return material;
  };
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.material = Array.isArray(object.material)
      ? object.material.map(prepare)
      : prepare(object.material);
  });
  return states;
}

function queenAura() {
  const material = new THREE.MeshBasicMaterial({
    color: 0xd267ff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const geometry = new THREE.RingGeometry(0.75, 1, 48);
  geometry.rotateX(-Math.PI / 2);
  const aura = new THREE.Mesh(geometry, material);
  aura.name = "QueenAura";
  aura.position.y = 0.055;
  aura.scale.setScalar(1.55);
  aura.renderOrder = 4;
  return aura;
}

export class EnemyCharacterRenderer {
  constructor(scene, catalog) {
    this.scene = scene;
    this.catalog = catalog;
    this.assets = new Map();
    this.clips = new Map();
    this.actors = new Map();
    this.freeByType = new Map();
    this.pendingEvents = new Map();
    this.proxyMeshes = new Map();
    this.proxyCounts = new Map();
    this.detailedIds = new Set();
    this.playerActor = null;
    this.proxyMatrix = new THREE.Matrix4();
    this.proxyPosition = new THREE.Vector3();
    this.proxyScale = new THREE.Vector3();
    this.proxyRotation = new THREE.Quaternion();
    this.proxyLeanRotation = new THREE.Quaternion();
    this.proxyColor = new THREE.Color();
    this.originColor = new THREE.Color();
    this.originEmissive = new THREE.Color();
    this.clockTime = 0;
    this.createdActors = 0;
  }

  async initialize() {
    const loaded = await Promise.all(ENEMY_MODEL_KEYS.map(async (key) => [key, await this.catalog.loadCharacter(key)]));
    for (const [key, gltf] of loaded) {
      this.assets.set(key, gltf);
      for (const clip of gltf.animations) this.clips.set(clip.name, clip);
    }
    this.createProxyMeshes();
  }

  createProxyMeshes() {
    for (const type of Object.keys(ENEMY_VISUAL_PROFILES)) {
      const profile = getEnemyVisualProfile(type);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: profile.tint.emissive,
        emissiveIntensity: Math.max(0.12, profile.tint.emissiveIntensity * 0.72),
        metalness: type === "boneguard" || type === "queen" ? 0.48 : 0.2,
        roughness: 0.48,
        transparent: profile.tint.opacity != null,
        opacity: profile.tint.opacity ?? 1,
        depthWrite: profile.tint.opacity == null,
      });
      const mesh = new THREE.InstancedMesh(createEnemyProxyGeometry(type), material, PROXY_CAPACITY_PER_TYPE);
      mesh.name = `enemy-proxy-${type}`;
      mesh.count = 0;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.baseColor = new THREE.Color(profile.tint.color);
      this.proxyMeshes.set(type, mesh);
      this.proxyCounts.set(type, 0);
      this.scene.add(mesh);
    }
  }

  createActor(type) {
    const profile = getEnemyVisualProfile(type);
    const asset = this.assets.get(profile.modelKey);
    if (!asset) throw new Error(`Enemy model was not loaded: ${profile.modelKey}`);
    const root = new THREE.Group();
    root.name = `enemy-${type}`;
    root.visible = false;
    const model = cloneSkeleton(asset.scene);
    model.scale.setScalar(profile.scale);
    createEnemyEquipment(model, profile.equipment);
    const materialStates = cloneAndTintMaterials(model, profile.tint);
    let skinnedMeshCount = 0;
    model.traverse((object) => {
      if (!object.isMesh) return;
      if (object.isSkinnedMesh) skinnedMeshCount += 1;
      object.castShadow = Boolean(profile.castShadow);
      object.receiveShadow = false;
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    model.position.y = -box.min.y + (profile.floatHeight ?? 0);
    root.add(model);
    const aura = type === "queen" ? queenAura() : null;
    if (aura) root.add(aura);
    model.updateMatrixWorld(true);
    const groundedBox = new THREE.Box3().setFromObject(model);
    const visualHeight = groundedBox.getSize(new THREE.Vector3()).y + (profile.floatHeight ?? 0);
    const mixer = new THREE.AnimationMixer(model);
    this.scene.add(root);
    this.createdActors += 1;
    return {
      type,
      root,
      model,
      mixer,
      actions: new Map(),
      currentAction: null,
      stateKey: null,
      materialStates,
      visualHeight,
      skinnedMeshCount,
      aura,
      detailed: false,
      id: null,
      age: 0,
      deathAge: -1,
      releaseKind: null,
      releaseTime: 0,
      forcedClip: null,
      forcedTime: 0,
      eventSerial: 0,
      idlePhase: Math.random(),
    };
  }

  acquire(type, id) {
    const pool = this.freeByType.get(type) ?? [];
    this.freeByType.set(type, pool);
    const record = pool.pop() ?? this.createActor(type);
    record.id = id;
    record.root.visible = true;
    record.root.scale.set(1, 1, 1);
    record.age = 0;
    record.deathAge = -1;
    record.releaseKind = null;
    record.releaseTime = 0;
    record.forcedClip = null;
    record.forcedTime = 0;
    record.stateKey = null;
    record.currentAction = null;
    record.detailed = false;
    record.mixer.stopAllAction();
    const pending = this.pendingEvents.get(id);
    if (pending) {
      this.applyEvent(record, pending);
      this.pendingEvents.delete(id);
    }
    return record;
  }

  release(record) {
    record.root.visible = false;
    record.mixer.stopAllAction();
    record.detailed = false;
    record.id = null;
    const pool = this.freeByType.get(record.type) ?? [];
    pool.push(record);
    this.freeByType.set(record.type, pool);
  }

  sync(enemies, alpha, dt, { allowProxies = false } = {}) {
    this.clockTime += dt;
    const incomingIds = new Set(enemies.map((enemy) => enemy.id));
    for (const [id, record] of this.actors) {
      if (incomingIds.has(id)) continue;
      this.actors.delete(id);
      this.release(record);
    }
    const detailedIds = this.selectDetailedActors(enemies, { allowProxies });
    for (const type of this.proxyCounts.keys()) this.proxyCounts.set(type, 0);
    for (const enemy of enemies) {
      let record = this.actors.get(enemy.id);
      if (!record) {
        record = this.acquire(enemy.type, enemy.id);
        this.actors.set(enemy.id, record);
      }
      if (detailedIds.has(enemy.id)) {
        if (!record.detailed) {
          record.mixer.stopAllAction();
          record.currentAction = null;
          record.stateKey = null;
        }
        record.detailed = true;
        record.root.visible = true;
        this.syncActor(record, enemy, alpha, dt);
      } else {
        if (record.detailed) {
          record.mixer.stopAllAction();
          record.currentAction = null;
          record.stateKey = null;
        }
        record.detailed = false;
        record.root.visible = false;
        this.syncProxyActor(record, enemy, alpha, dt);
      }
    }
    this.finalizeProxyMeshes();
    this.detailedIds = detailedIds;
  }

  selectDetailedActors(enemies, { allowProxies = false } = {}) {
    if (!allowProxies) return new Set(enemies.map((enemy) => enemy.id));
    if (!this.playerActor) this.playerActor = this.scene.getObjectByName("player-actor");
    const playerX = this.playerActor?.position.x ?? 0;
    const playerZ = this.playerActor?.position.z ?? 0;
    const living = enemies.filter((enemy) => enemy.active && enemy.type !== "queen");
    const limit = detailedEnemyLimit(living.length);
    const selected = new Set();
    const candidates = [];

    for (const enemy of enemies) {
      if (enemy.type === "queen") {
        selected.add(enemy.id);
        continue;
      }
      if (!enemy.active) {
        const record = this.actors.get(enemy.id);
        if (record?.detailed && record.deathAge < DEATH_DURATION) selected.add(enemy.id);
        continue;
      }
      const distance = Math.hypot(enemy.position.x - playerX, enemy.position.z - playerZ);
      const wasDetailed = this.detailedIds.has(enemy.id);
      const threshold = wasDetailed ? ENEMY_LOD_CONFIG.detailExitDistance : ENEMY_LOD_CONFIG.detailEnterDistance;
      if (distance > threshold) continue;
      const threatBias = enemy.attackPending || enemy.state === "dash" ? 0.9 : 0;
      const hysteresisBias = wasDetailed ? 0.65 : 0;
      candidates.push({ id: enemy.id, score: distance - threatBias - hysteresisBias });
    }

    candidates.sort((a, b) => a.score - b.score || a.id - b.id);
    for (const candidate of candidates.slice(0, limit)) selected.add(candidate.id);
    return selected;
  }

  syncProxyActor(record, enemy, alpha, dt) {
    const profile = getEnemyVisualProfile(enemy.type);
    const originProfile = getEnemyOriginVisualProfile(enemy.origin ?? "witch");
    record.age += dt;
    if (!enemy.active) record.deathAge = record.deathAge < 0 ? 0 : record.deathAge + dt;
    const index = this.proxyCounts.get(enemy.type) ?? 0;
    const mesh = this.proxyMeshes.get(enemy.type);
    if (!mesh || index >= PROXY_CAPACITY_PER_TYPE) return;

    const x = interpolated(enemy.previousPosition.x, enemy.position.x, alpha);
    const z = interpolated(enemy.previousPosition.z, enemy.position.z, alpha);
    const moving = Math.hypot(
      enemy.position.x - enemy.previousPosition.x,
      enemy.position.z - enemy.previousPosition.z,
    ) > 0.002;
    const phase = this.clockTime * (enemy.type === "reaver" ? 10 : 7.2) + enemy.id * 1.618;
    const stride = moving ? Math.sin(phase) : Math.sin(phase * 0.32) * 0.35;
    let scaleX = 1 + stride * (moving ? 0.035 : 0.018);
    let scaleY = 1 - Math.abs(stride) * (moving ? 0.055 : 0.02);
    let scaleZ = 1;
    let lean = 0;
    const originPulse = Math.sin(this.clockTime * originProfile.pulseSpeed + (enemy.originPhase ?? 0));
    let roll = stride * (moving ? 0.045 : 0.018) + originPulse * originProfile.sway;
    let y = (profile.floatHeight ?? 0) + (moving ? Math.abs(stride) * 0.055 : 0);

    if (record.age < SPAWN_DURATION) {
      const progress = clamp01(record.age / SPAWN_DURATION);
      const spawnScale = easeOutBack(progress);
      const spawnScaleXZ = SPAWN_START_SCALE_XZ + spawnScale * (1 - SPAWN_START_SCALE_XZ);
      scaleX *= spawnScaleXZ;
      scaleY *= SPAWN_START_SCALE_Y + spawnScale * (1 - SPAWN_START_SCALE_Y);
      scaleZ *= spawnScaleXZ;
      y -= (1 - progress) ** 2 * SPAWN_RISE_DEPTH;
      roll += (1 - progress) * originProfile.spawnLean * Math.sign(Math.sin((enemy.originPhase ?? 0) + 0.5));
    }
    if (enemy.attackPending || record.releaseTime > 0) {
      const attack = getEnemyAttackVisual(enemy.type, enemy.attackKind ?? record.releaseKind);
      const totalWindup = ENEMY_ARCHETYPES[enemy.type]?.attacks[enemy.attackKind]?.windup ?? 0.45;
      const windup = enemy.attackPending ? 1 - clamp01(enemy.attackWindup / Math.max(0.05, totalWindup)) : 1;
      lean = -Math.sin(windup * Math.PI * 0.5) * (attack ? 0.13 : 0.08);
      scaleY *= 1 - windup * 0.08;
      scaleZ *= 1 + windup * 0.14;
    }
    if (enemy.state === "dash") {
      lean = -0.2;
      scaleY *= 0.82;
      scaleZ *= 1.3;
    }
    if (enemy.hitFlash > 0) {
      const impact = clamp01(enemy.hitFlash / HIT_DURATION);
      scaleX *= 1 + impact * 0.13;
      scaleY *= 1 - impact * 0.1;
    }
    if (!enemy.active) {
      const duration = enemy.dismissed ? DISMISS_DURATION : DEATH_DURATION;
      const progress = clamp01(record.deathAge / duration);
      if (enemy.dismissed) {
        const dismissalScale = Math.max(0.025, 1 - progress ** 2);
        scaleX *= dismissalScale;
        scaleY *= dismissalScale;
        scaleZ *= dismissalScale;
        y += progress * 0.3;
      } else {
        scaleX *= 1 + Math.sin(progress * Math.PI) * 0.2;
        scaleY *= Math.max(0.025, 1 - progress ** 2);
        roll += progress * (enemy.id % 2 === 0 ? 0.5 : -0.5);
      }
    }
    if (enemy.type === "wraith") y += Math.sin(this.clockTime * 3.3 + enemy.id) * 0.08;

    const facingX = enemy.facing?.x ?? 0;
    const facingZ = enemy.facing?.z ?? 1;
    const yaw = Math.hypot(facingX, facingZ) > 0.001 ? Math.atan2(facingX, facingZ) : 0;
    this.proxyPosition.set(x, y, z);
    this.proxyRotation.setFromAxisAngle(UP_AXIS, yaw);
    this.proxyLeanRotation.setFromEuler(new THREE.Euler(lean, 0, roll));
    this.proxyRotation.multiply(this.proxyLeanRotation);
    this.proxyScale.set(scaleX * profile.scale, scaleY * profile.scale, scaleZ * profile.scale);
    this.proxyMatrix.compose(this.proxyPosition, this.proxyRotation, this.proxyScale);
    mesh.setMatrixAt(index, this.proxyMatrix);
    const flash = clamp01(enemy.hitFlash / HIT_DURATION);
    this.originColor.set(originProfile.color);
    this.proxyColor.copy(mesh.userData.baseColor)
      .lerp(this.originColor, originProfile.colorMix)
      .lerp(FLASH_COLOR, flash * 0.76);
    const pulseBrightness = 1 + originProfile.pulseAmount * originPulse;
    this.proxyColor.multiplyScalar(Math.max(0.78, pulseBrightness));
    if (!enemy.active) {
      const duration = enemy.dismissed ? DISMISS_DURATION : DEATH_DURATION;
      this.proxyColor.multiplyScalar(Math.max(0.18, 1 - record.deathAge / duration));
    }
    mesh.setColorAt(index, this.proxyColor);
    this.proxyCounts.set(enemy.type, index + 1);

    this.advancePresentationTimers(record, dt);
  }

  finalizeProxyMeshes() {
    for (const [type, mesh] of this.proxyMeshes) {
      mesh.count = this.proxyCounts.get(type) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  syncActor(record, enemy, alpha, dt) {
    const profile = getEnemyVisualProfile(enemy.type);
    record.age += dt;
    if (!enemy.active) record.deathAge = record.deathAge < 0 ? 0 : record.deathAge + dt;
    const x = interpolated(enemy.previousPosition.x, enemy.position.x, alpha);
    const z = interpolated(enemy.previousPosition.z, enemy.position.z, alpha);
    let y = profile.floatHeight ? Math.sin(this.clockTime * 3.2 + enemy.id) * 0.06 : 0;
    if (record.age < SPAWN_DURATION) {
      const progress = clamp01(record.age / SPAWN_DURATION);
      y -= (1 - progress) ** 2 * SPAWN_RISE_DEPTH;
    }
    record.root.position.set(x, y, z);
    const facingX = enemy.facing?.x ?? 0;
    const facingZ = enemy.facing?.z ?? 1;
    if (Math.hypot(facingX, facingZ) > 0.001) record.root.rotation.y = Math.atan2(facingX, facingZ);

    const movement = Math.hypot(
      enemy.position.x - enemy.previousPosition.x,
      enemy.position.z - enemy.previousPosition.z,
    );
    const animation = this.resolveAnimation(record, enemy, movement > 0.002);
    this.playAnimation(record, animation);
    record.mixer.update(dt);
    this.syncPose(record, enemy);
    this.syncMaterials(record, enemy);

    this.advancePresentationTimers(record, dt);
  }

  advancePresentationTimers(record, dt) {
    record.releaseTime = Math.max(0, record.releaseTime - dt);
    if (record.releaseTime <= 0) record.releaseKind = null;
    record.forcedTime = Math.max(0, record.forcedTime - dt);
    if (record.forcedTime <= 0) record.forcedClip = null;
  }

  resolveAnimation(record, enemy, moving) {
    const profile = getEnemyVisualProfile(enemy.type);
    if (!enemy.active && enemy.dismissed) return { clip: profile.idleClip, once: false, duration: null, key: "dismissed" };
    if (!enemy.active) return { clip: profile.deathClip, once: true, duration: DEATH_DURATION, key: "death" };
    if (record.age < SPAWN_DURATION) return { clip: profile.spawnClip, once: true, duration: SPAWN_DURATION, key: "spawn" };
    if (enemy.hitFlash > HIT_DURATION * 0.38) return { clip: profile.hitClip, once: true, duration: 0.24, key: `hit:${record.eventSerial}` };
    if (record.forcedClip) return { clip: record.forcedClip, once: true, duration: Math.max(0.2, record.forcedTime), key: `forced:${record.eventSerial}` };
    if (enemy.state === "dash" && profile.dashClip) {
      return { clip: profile.dashClip, once: true, duration: Math.max(0.18, enemy.actionTimer || 0.22), key: `dash:${enemy.attackKind ?? "move"}` };
    }
    const attackKind = enemy.attackPending ? enemy.attackKind : record.releaseKind;
    if (attackKind) {
      const visual = getEnemyAttackVisual(enemy.type, attackKind);
      if (visual) {
        const windup = ENEMY_ARCHETYPES[enemy.type]?.attacks[attackKind]?.windup ?? 0.4;
        const duration = Math.max(windup / visual.impactRatio, windup + visual.recovery);
        return { clip: visual.clip, once: true, duration, key: `attack:${attackKind}` };
      }
    }
    if (moving) return { clip: profile.runClip, once: false, duration: 0.8, key: "run" };
    return { clip: profile.idleClip, once: false, duration: null, key: "idle" };
  }

  playAnimation(record, animation) {
    if (record.stateKey === animation.key) return;
    const clip = this.clips.get(animation.clip);
    if (!clip) return;
    let action = record.actions.get(animation.clip);
    if (!action) {
      action = record.mixer.clipAction(clip);
      record.actions.set(animation.clip, action);
    }
    configureAction(action, animation.once, animation.duration);
    action.reset().fadeIn(0.08).play();
    if (animation.key === "idle") action.time = clip.duration * record.idlePhase;
    if (record.currentAction && record.currentAction !== action) record.currentAction.fadeOut(0.08);
    record.currentAction = action;
    record.stateKey = animation.key;
  }

  syncPose(record, enemy) {
    const originProfile = getEnemyOriginVisualProfile(enemy.origin ?? "witch");
    const originPulse = Math.sin(this.clockTime * originProfile.pulseSpeed + (enemy.originPhase ?? 0));
    let scaleX = 1;
    let scaleY = 1;
    if (record.age < SPAWN_DURATION) {
      const progress = clamp01(record.age / SPAWN_DURATION);
      const scale = easeOutBack(progress);
      scaleX = SPAWN_START_SCALE_XZ + scale * (1 - SPAWN_START_SCALE_XZ);
      scaleY = SPAWN_START_SCALE_Y + scale * (1 - SPAWN_START_SCALE_Y);
    }
    if (!enemy.active) {
      const duration = enemy.dismissed ? DISMISS_DURATION : DEATH_DURATION;
      const progress = clamp01(record.deathAge / duration);
      if (enemy.dismissed) {
        scaleX = Math.max(0.03, 1 - progress ** 2);
        scaleY = scaleX;
        record.root.position.y += progress * 0.3;
        record.root.rotation.z = 0;
      } else {
        scaleX = 1 + Math.sin(progress * Math.PI) * 0.18;
        scaleY = Math.max(0.03, 1 - progress ** 2);
        record.root.rotation.z = progress * (enemy.id % 2 === 0 ? 0.35 : -0.35);
      }
      if (record.deathAge >= duration) record.root.visible = false;
    } else {
      record.root.rotation.z = originPulse * originProfile.sway;
      if (record.age < SPAWN_DURATION) {
        const progress = clamp01(record.age / SPAWN_DURATION);
        record.root.rotation.z += (1 - progress) * originProfile.spawnLean * Math.sign(Math.sin((enemy.originPhase ?? 0) + 0.5));
      }
      if (enemy.hitFlash > 0) {
        const impact = clamp01(enemy.hitFlash / HIT_DURATION);
        scaleX *= 1 + impact * 0.08;
        scaleY *= 1 - impact * 0.055;
      }
    }
    record.root.scale.set(scaleX, scaleY, scaleX);
    if (record.aura) {
      const phaseScale = enemy.bossPhase === 2 ? 1.24 : 1;
      const pulse = 1 + Math.sin(this.clockTime * 4.5) * 0.055;
      record.aura.scale.setScalar(1.55 * phaseScale * pulse);
      record.aura.material.opacity = (enemy.bossPhase === 2 ? 0.43 : 0.25) + Math.sin(this.clockTime * 5.2) * 0.05;
      record.aura.rotation.z += 0.01;
    }
  }

  syncMaterials(record, enemy) {
    const flash = clamp01(enemy.hitFlash / HIT_DURATION);
    const originProfile = getEnemyOriginVisualProfile(enemy.origin ?? "witch");
    const pulse = Math.sin(this.clockTime * originProfile.pulseSpeed + (enemy.originPhase ?? 0));
    this.originColor.set(originProfile.color);
    this.originEmissive.set(originProfile.emissive);
    for (const state of record.materialStates) {
      if (state.color) state.material.color.copy(state.color).lerp(this.originColor, originProfile.colorMix).lerp(FLASH_COLOR, flash * 0.68);
      if (state.emissive) state.material.emissive.copy(state.emissive).lerp(this.originEmissive, originProfile.emissiveMix).lerp(FLASH_EMISSIVE, flash * 0.7);
      if ("emissiveIntensity" in state.material) {
        state.material.emissiveIntensity = state.emissiveIntensity
          + originProfile.emissiveBoost
          + originProfile.pulseAmount * (0.5 + pulse * 0.5)
          + flash * 2.4;
      }
      state.material.opacity = state.opacity;
    }
  }

  handleEvent(event) {
    const { type, detail = {} } = event;
    const id = detail.enemyId ?? detail.id;
    if (type === "enemyAttack" && id != null) {
      const record = this.actors.get(id);
      const payload = { type: "release", kind: detail.attack };
      if (record) this.applyEvent(record, payload);
      else this.pendingEvents.set(id, payload);
    }
    if (type === "enemyBlock" && id != null) {
      const record = this.actors.get(id);
      const payload = { type: "forced", clip: "Block", duration: 0.32 };
      if (record) this.applyEvent(record, payload);
      else this.pendingEvents.set(id, payload);
    }
    if (type === "queenSummon") this.forceQueen("Spellcast_Summon", 0.82);
    if (type === "queenTeleport") this.forceQueen("Dodge_Forward", 0.36);
  }

  forceQueen(clip, duration) {
    const queen = [...this.actors.values()].find((record) => record.type === "queen");
    if (queen) this.applyEvent(queen, { type: "forced", clip, duration });
  }

  applyEvent(record, payload) {
    record.eventSerial += 1;
    if (payload.type === "release") {
      const visual = getEnemyAttackVisual(record.type, payload.kind);
      record.releaseKind = payload.kind;
      record.releaseTime = visual?.recovery ?? 0.22;
    }
    if (payload.type === "forced") {
      record.forcedClip = payload.clip;
      record.forcedTime = payload.duration;
    }
  }

  actorHeight(id) {
    const record = this.actors.get(id);
    if (!record) return 2.5;
    if (!record.detailed) return getEnemyVisualProfile(record.type).healthBar.height;
    return record.visualHeight * Math.max(0.08, record.root.scale.y) + record.root.position.y;
  }

  metrics() {
    let activeMixers = 0;
    let skinnedMeshes = 0;
    for (const record of this.actors.values()) {
      if (!record.detailed || !record.root.visible) continue;
      activeMixers += 1;
      skinnedMeshes += record.skinnedMeshCount;
    }
    const proxyActors = [...this.proxyCounts.values()].reduce((sum, count) => sum + count, 0);
    return {
      activeActors: activeMixers + proxyActors,
      activeMixers,
      skinnedMeshes,
      proxyActors,
      pooledActors: this.createdActors,
    };
  }
}
