import * as THREE from "three";
import { DamageNumberLayer } from "./DamageNumberLayer.js";
import { getBiome } from "../generation/biomes.js";
import { PORTAL_CONFIG } from "../game/gameConfig.js";
import { ActorRenderer } from "./ActorRenderer.js";
import { AssetCatalog } from "./AssetCatalog.js";
import { BiomeRenderer } from "./BiomeRenderer.js";
import { EffectsPool } from "./EffectsPool.js";
import { GameCamera } from "./GameCamera.js";

const MAX_PROJECTILES = 96;

export function endingCorruptionUrgency(game) {
  const endingState = game.ending?.snapshot?.();
  if (game.phase === "endingChoice") return endingState?.decision?.urgency ?? 0;
  if (endingState?.result?.id === "timeout" && ["bookend", "endingFade"].includes(game.phase)) return 1;
  return 0;
}

export function presentationDelta(game, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  if (game?.phase === "paused" || game?.hitStop?.remaining?.() > 0) return 0;
  return dt;
}

function interpolated(previous, current, alpha) {
  return previous + (current - previous) * alpha;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutBack(value) {
  const shifted = value - 1;
  return 1 + 2.70158 * shifted * shifted * shifted + 1.70158 * shifted * shifted;
}

const PROJECTILE_COLORS = Object.freeze({
  hexBolt: 0xd65cff,
  hexShard: 0x7cdfff,
  hexRune: 0xf080ff,
  cinderBomb: 0xff782e,
  queenOrb: 0xbc5cff,
});

const EMPTY_COMBAT_PRESENTATION = Object.freeze({
  bursts: Object.freeze([]),
  rings: Object.freeze([]),
  trauma: 0,
});

const ZEPHYR_PRESENTATION_COLORS = Object.freeze({
  gold: 0xd9aa52,
  brightGold: 0xffd985,
  cyan: 0x74e2ff,
  paleCyan: 0xe3fbff,
  harvestGreen: 0x82e6a1,
  expiredNeutral: 0x9aa3ad,
  cancelledNeutral: 0x6f747c,
  hurtRed: 0xef4f62,
  reviveWhite: 0xf7f2d0,
});

const WITCH_PRESENTATION_COLORS = Object.freeze({
  void: 0x8f35bd,
  royal: 0xd75aff,
  bright: 0xf2b5ff,
  summon: 0xff9fdd,
  cancelled: 0x77707f,
});

function presentationPoint(value) {
  if (!Number.isFinite(value?.x) || !Number.isFinite(value?.z)) return null;
  return { x: value.x, z: value.z };
}

function firstPresentationPoint(...values) {
  for (const value of values) {
    const point = presentationPoint(value);
    if (point) return point;
  }
  return null;
}

function presentationScale(options) {
  const motionScale = options.reducedMotion ? 0.58 : 1;
  const flashScale = options.screenFlashes === false ? 0.72 : 1;
  return motionScale * flashScale;
}

function presentation(bursts = [], rings = [], trauma = 0) {
  return { bursts, rings, trauma };
}

export function combatPresentationDescriptor(type, detail = {}, options = {}) {
  const safeDetail = detail ?? {};
  const playerPosition = presentationPoint(options.playerPosition);
  const resolvedEnemyPosition = firstPresentationPoint(
    safeDetail.position,
    safeDetail.targetPosition,
    safeDetail.hit?.targetPosition,
    options.resolvedEnemyPosition,
  );
  const scale = presentationScale(options);
  const radius = (value) => value * scale;
  const trauma = (value) => value * scale;

  if (type === "harvestChanged" && playerPosition) {
    const delta = Number(safeDetail.delta);
    if (delta > 0) {
      return presentation(
        [{ position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.harvestGreen, count: 13, force: 3.6 }],
        [{ position: playerPosition, radius: radius(0.7), color: ZEPHYR_PRESENTATION_COLORS.brightGold, duration: 0.3 }],
      );
    }
    if (delta < 0) {
      return presentation(
        [{ position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.gold, count: 9, force: 2.8 }],
        [
          { position: playerPosition, radius: radius(0.48), color: ZEPHYR_PRESENTATION_COLORS.brightGold, duration: 0.24 },
          { position: playerPosition, radius: radius(0.84), color: ZEPHYR_PRESENTATION_COLORS.gold, duration: 0.34 },
        ],
      );
    }
    return EMPTY_COMBAT_PRESENTATION;
  }

  if (type === "claimStarted") {
    const position = firstPresentationPoint(safeDetail.origin, playerPosition);
    if (!position) return EMPTY_COMBAT_PRESENTATION;
    return presentation(
      [{ position, color: ZEPHYR_PRESENTATION_COLORS.gold, count: 16, force: 4.8 }],
      [{ position, radius: radius(0.82), color: ZEPHYR_PRESENTATION_COLORS.brightGold, duration: 0.24 }],
      trauma(0.04),
    );
  }

  if (type === "claimRecallStarted") {
    const position = firstPresentationPoint(safeDetail.position, playerPosition);
    if (!position) return EMPTY_COMBAT_PRESENTATION;
    return presentation(
      [{ position, color: ZEPHYR_PRESENTATION_COLORS.cyan, count: 11, force: 3.4 }],
      [{ position, radius: radius(0.7), color: ZEPHYR_PRESENTATION_COLORS.paleCyan, duration: 0.28 }],
    );
  }

  if (type === "claimCaught") {
    const position = firstPresentationPoint(safeDetail.position, playerPosition);
    if (!position) return EMPTY_COMBAT_PRESENTATION;
    return presentation(
      [{ position, color: ZEPHYR_PRESENTATION_COLORS.brightGold, count: 18, force: 4.3 }],
      [{ position, radius: radius(0.92), color: ZEPHYR_PRESENTATION_COLORS.paleCyan, duration: 0.32 }],
      trauma(0.07),
    );
  }

  if (type === "claimFollowupReady" && playerPosition) {
    return presentation([], [
      { position: playerPosition, radius: radius(0.62), color: ZEPHYR_PRESENTATION_COLORS.brightGold, duration: 0.34 },
      { position: playerPosition, radius: radius(1.02), color: ZEPHYR_PRESENTATION_COLORS.gold, duration: 0.46 },
    ]);
  }

  if (type === "claimFollowupConsumed" && playerPosition) {
    return presentation(
      [{ position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.gold, count: 19, force: 4.6 }],
      [{ position: playerPosition, radius: radius(1.08), color: ZEPHYR_PRESENTATION_COLORS.brightGold, duration: 0.3 }],
      trauma(0.08),
    );
  }

  if (type === "claimCompleted" && playerPosition) {
    const completion = {
      cleave: { radius: 1.12, color: ZEPHYR_PRESENTATION_COLORS.brightGold, duration: 0.42 },
      expired: { radius: 0.68, color: ZEPHYR_PRESENTATION_COLORS.expiredNeutral, duration: 0.32 },
      cancelled: { radius: 0.52, color: ZEPHYR_PRESENTATION_COLORS.cancelledNeutral, duration: 0.24 },
    }[safeDetail.result];
    if (!completion) return EMPTY_COMBAT_PRESENTATION;
    return presentation([], [{
      position: playerPosition,
      radius: radius(completion.radius),
      color: completion.color,
      duration: completion.duration,
    }]);
  }

  if (type === "claimHit" && ["outbound", "recall"].includes(safeDetail.pass) && resolvedEnemyPosition) {
    const recall = safeDetail.pass === "recall";
    return presentation([], [{
      position: resolvedEnemyPosition,
      radius: radius(recall ? 0.62 : 0.48),
      color: recall ? ZEPHYR_PRESENTATION_COLORS.cyan : ZEPHYR_PRESENTATION_COLORS.gold,
      duration: recall ? 0.24 : 0.18,
    }]);
  }

  if (type === "claimPulled" && resolvedEnemyPosition) {
    return presentation(
      [{ position: resolvedEnemyPosition, color: ZEPHYR_PRESENTATION_COLORS.cyan, count: 10, force: 2.7 }],
      [{ position: resolvedEnemyPosition, radius: radius(0.72), color: ZEPHYR_PRESENTATION_COLORS.paleCyan, duration: 0.28 }],
    );
  }

  if (type === "enemyStaggered" && resolvedEnemyPosition) {
    return presentation(
      [{ position: resolvedEnemyPosition, color: 0xffb05e, count: 15, force: 4.1 }],
      [{ position: resolvedEnemyPosition, radius: radius(0.78), color: 0xffd09a, duration: 0.3 }],
      trauma(0.11),
    );
  }

  if (type === "attack" && playerPosition) {
    const dash = safeDetail.dash === true;
    const heavy = safeDetail.heavy === true;
    const line = safeDetail.line === true;
    const finisher = safeDetail.comboIndex === 2;
    const color = line ? ZEPHYR_PRESENTATION_COLORS.paleCyan : heavy || finisher
      ? ZEPHYR_PRESENTATION_COLORS.brightGold
      : dash ? ZEPHYR_PRESENTATION_COLORS.cyan : ZEPHYR_PRESENTATION_COLORS.paleCyan;
    const accentRadius = line ? 0.94 : heavy ? 0.82 : finisher ? 0.68 : dash ? 0.54 : 0.38;
    return presentation(
      [{ position: playerPosition, color, count: line ? 18 : heavy ? 14 : finisher ? 11 : 7, force: line ? 4.6 : heavy ? 3.8 : 2.7 }],
      line ? [] : [{ position: playerPosition, radius: radius(accentRadius), color, duration: heavy ? 0.34 : 0.22 }],
      trauma(line ? 0.08 : heavy ? 0.06 : finisher ? 0.045 : 0),
    );
  }

  if (type === "lineChargeStart" && playerPosition) {
    return presentation([
      { position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.cyan, count: 9, force: 2.4 },
    ]);
  }

  if (type === "lineChargeReleased" && playerPosition) {
    return presentation(
      [{
        position: playerPosition,
        color: safeDetail.forced ? ZEPHYR_PRESENTATION_COLORS.brightGold : ZEPHYR_PRESENTATION_COLORS.paleCyan,
        count: safeDetail.forced ? 26 : 20,
        force: safeDetail.forced ? 6.2 : 5.1,
      }],
      [],
      trauma(safeDetail.forced ? 0.16 : 0.11),
    );
  }

  if (type === "chargeStart" && playerPosition) {
    return presentation([], [{
      position: playerPosition,
      radius: radius(0.46),
      color: ZEPHYR_PRESENTATION_COLORS.cyan,
      duration: 0.3,
    }]);
  }

  if (type === "chargeReleased" && playerPosition && ["partial", "full", "perfect"].includes(safeDetail.quality)) {
    const perfect = safeDetail.quality === "perfect";
    const full = safeDetail.quality === "full";
    return presentation(
      [{
        position: playerPosition,
        color: perfect ? ZEPHYR_PRESENTATION_COLORS.brightGold : ZEPHYR_PRESENTATION_COLORS.cyan,
        count: perfect ? 20 : full ? 14 : 9,
        force: perfect ? 5.2 : full ? 4.1 : 3.1,
      }],
      [{
        position: playerPosition,
        radius: radius(perfect ? 1.08 : full ? 0.82 : 0.58),
        color: perfect ? ZEPHYR_PRESENTATION_COLORS.brightGold : ZEPHYR_PRESENTATION_COLORS.paleCyan,
        duration: perfect ? 0.42 : 0.3,
      }],
      trauma(perfect ? 0.1 : full ? 0.055 : 0.025),
    );
  }

  if (type === "dash" && playerPosition) {
    return presentation(
      [{ position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.cyan, count: 18, force: 4.8 }],
      [{ position: playerPosition, radius: radius(0.75), color: ZEPHYR_PRESENTATION_COLORS.cyan, duration: 0.18 }],
    );
  }

  if (type === "dashEnded" && playerPosition && safeDetail.reason === "ended") {
    return presentation([], [{
      position: playerPosition,
      radius: radius(0.34),
      color: ZEPHYR_PRESENTATION_COLORS.paleCyan,
      duration: 0.16,
    }]);
  }

  if (type === "perfectDash" && playerPosition) {
    return presentation(
      [{ position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.brightGold, count: 16, force: 4.5 }],
      [
        { position: playerPosition, radius: radius(0.56), color: ZEPHYR_PRESENTATION_COLORS.paleCyan, duration: 0.2 },
        { position: playerPosition, radius: radius(0.92), color: ZEPHYR_PRESENTATION_COLORS.brightGold, duration: 0.34 },
      ],
      trauma(0.04),
    );
  }

  if (type === "playerHit" && playerPosition) {
    const heavy = safeDetail.severity === "heavy";
    return presentation(
      [{ position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.hurtRed, count: heavy ? 28 : 18, force: heavy ? 6.2 : 4.5 }],
      [{ position: playerPosition, radius: radius(heavy ? 0.82 : 0.58), color: ZEPHYR_PRESENTATION_COLORS.hurtRed, duration: heavy ? 0.34 : 0.22 }],
      trauma(heavy ? 0.5 : 0.3),
    );
  }

  if (type === "playerHealed" && playerPosition) {
    const revive = safeDetail.reason === "deathDefiance";
    return presentation(
      [{
        position: playerPosition,
        color: revive ? ZEPHYR_PRESENTATION_COLORS.reviveWhite : ZEPHYR_PRESENTATION_COLORS.harvestGreen,
        count: revive ? 30 : 13,
        force: revive ? 5 : 3,
      }],
      [{
        position: playerPosition,
        radius: radius(revive ? 1.18 : 0.64),
        color: revive ? ZEPHYR_PRESENTATION_COLORS.brightGold : ZEPHYR_PRESENTATION_COLORS.harvestGreen,
        duration: revive ? 0.72 : 0.42,
      }],
      trauma(revive ? 0.09 : 0),
    );
  }

  if (type === "endingStrikeStarted" && playerPosition) {
    return presentation([], [{
      position: playerPosition,
      radius: radius(0.72),
      color: ZEPHYR_PRESENTATION_COLORS.brightGold,
      duration: 0.34,
    }], trauma(0.08));
  }

  if (type === "princessStruck") {
    const position = firstPresentationPoint(safeDetail.position, options.endingTargetPosition);
    if (!position) return EMPTY_COMBAT_PRESENTATION;
    return presentation(
      [{ position, color: ZEPHYR_PRESENTATION_COLORS.brightGold, count: 32, force: 6.8 }],
      [{ position, radius: radius(1.24), color: ZEPHYR_PRESENTATION_COLORS.reviveWhite, duration: 0.48 }],
      trauma(0.36),
    );
  }

  if (type === "endingStrikeCompleted" && playerPosition) {
    return presentation(
      [{ position: playerPosition, color: ZEPHYR_PRESENTATION_COLORS.gold, count: 10, force: 2.2 }],
      [{ position: playerPosition, radius: radius(0.46), color: ZEPHYR_PRESENTATION_COLORS.gold, duration: 0.5 }],
    );
  }

  return EMPTY_COMBAT_PRESENTATION;
}

export function witchPresentationDescriptor(type, detail = {}, options = {}) {
  const safeDetail = detail ?? {};
  const origin = firstPresentationPoint(safeDetail.position, safeDetail.origin);
  const target = firstPresentationPoint(safeDetail.target, safeDetail.position);
  const scale = presentationScale(options);
  const radius = (value) => value * scale;
  const trauma = (value) => value * scale;

  if (type === "queenSpecialAnticipated" && origin) {
    return presentation([], [{
      position: origin,
      radius: radius(safeDetail.action === "summon" ? 0.86 : 0.56),
      color: WITCH_PRESENTATION_COLORS.royal,
      duration: Math.min(0.4, Math.max(0.18, safeDetail.duration ?? 0.3)),
    }]);
  }

  if (type === "queenSpecialReleased" && origin) {
    if (safeDetail.action === "teleport" && target) {
      return presentation(
        [
          { position: origin, color: WITCH_PRESENTATION_COLORS.void, count: 24, force: 5.4 },
          { position: target, color: WITCH_PRESENTATION_COLORS.bright, count: 30, force: 6.2 },
        ],
        [
          { position: origin, radius: radius(1.05), color: WITCH_PRESENTATION_COLORS.void, duration: 0.3 },
          { position: target, radius: radius(1.35), color: WITCH_PRESENTATION_COLORS.bright, duration: 0.34 },
        ],
        trauma(0.18),
      );
    }
    return presentation(
      [{ position: origin, color: WITCH_PRESENTATION_COLORS.summon, count: 34, force: 5.4 }],
      [
        { position: origin, radius: radius(1.2), color: WITCH_PRESENTATION_COLORS.bright, duration: 0.34 },
        { position: origin, radius: radius(2.2), color: WITCH_PRESENTATION_COLORS.royal, duration: 0.48 },
      ],
      trauma(0.14),
    );
  }

  if (type === "queenSpecialRecovered" && origin) {
    return presentation([], [{
      position: origin,
      radius: radius(0.72),
      color: WITCH_PRESENTATION_COLORS.royal,
      duration: 0.24,
    }]);
  }

  if (type === "queenSpecialCancelled" && origin) {
    return presentation([], [{
      position: origin,
      radius: radius(0.62),
      color: WITCH_PRESENTATION_COLORS.cancelled,
      duration: 0.2,
    }]);
  }

  if (type === "bossPhaseChanged" && origin) {
    const finalPhase = safeDetail.phase >= 3;
    return presentation(
      [{
        position: origin,
        color: finalPhase ? WITCH_PRESENTATION_COLORS.bright : WITCH_PRESENTATION_COLORS.royal,
        count: finalPhase ? 56 : 38,
        force: finalPhase ? 7.2 : 5.8,
      }],
      [
        { position: origin, radius: radius(finalPhase ? 1.6 : 1.2), color: WITCH_PRESENTATION_COLORS.bright, duration: 0.44 },
        { position: origin, radius: radius(finalPhase ? 3.4 : 2.5), color: WITCH_PRESENTATION_COLORS.void, duration: 0.72 },
      ],
      trauma(finalPhase ? 0.46 : 0.3),
    );
  }

  if (type === "queenGuardsDismissed") {
    const positions = (safeDetail.actors ?? [])
      .map((actor) => presentationPoint(actor.position))
      .filter(Boolean);
    if (positions.length === 0) return EMPTY_COMBAT_PRESENTATION;
    return presentation(
      positions.map((position) => ({
        position,
        color: WITCH_PRESENTATION_COLORS.void,
        count: 16,
        force: 4.2,
      })),
      positions.map((position) => ({
        position,
        radius: radius(0.82),
        color: WITCH_PRESENTATION_COLORS.royal,
        duration: 0.36,
      })),
      trauma(0.1),
    );
  }

  return EMPTY_COMBAT_PRESENTATION;
}

export function applyCombatPresentation(descriptor, effects, cameraSystem) {
  if (!descriptor) return;
  for (const burst of descriptor.bursts ?? []) {
    effects?.spawnBurst?.(burst.position, burst.color, burst.count, burst.force);
  }
  for (const ring of descriptor.rings ?? []) {
    effects?.spawnRing?.(ring.position, ring.radius, ring.color, ring.duration);
  }
  if (descriptor.trauma > 0) cameraSystem?.addTrauma?.(descriptor.trauma);
}

export class GameRenderer {
  constructor(canvas, settings, combatOverlay = document.querySelector("#combat-overlay")) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: settings.get("graphics.antialias"),
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09080d);
    this.scene.fog = new THREE.FogExp2(0x11101a, 0.028);
    this.baseFogDensity = 0.028;
    this.cameraSystem = new GameCamera(settings);
    this.effects = new EffectsPool(this.scene, settings);
    this.damageNumbers = new DamageNumberLayer(combatOverlay, canvas, settings.getAll());
    this.catalog = new AssetCatalog();
    this.actorRenderer = null;
    this.biomeRenderer = null;
    this.initialized = false;
    this.worldReady = Promise.resolve();
    this.projectileMatrix = new THREE.Matrix4();
    this.projectileColor = new THREE.Color();
    this.lastEnemyHitPresentation = null;
    this.endingAccentBase = new THREE.Color();
    this.endingAccentCorrupt = new THREE.Color(0xb53d67);
    this.createLighting();
    this.createProjectiles();
    this.createPortal();
    this.gpuTimer = this.createGpuTimer();
    this.applySettings(settings.getAll());
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("fullscreenchange", this.onResize);
    this.resize();
    this.ready = this.initialize();
  }

  async initialize() {
    await this.catalog.loadCritical();
    this.actorRenderer = new ActorRenderer(this.scene, this.catalog);
    this.biomeRenderer = new BiomeRenderer(this.scene, this.catalog);
    await this.actorRenderer.initialize();
    this.initialized = true;
  }

  setLoadProgressListener(listener) {
    this.catalog.setProgressListener(listener);
  }

  createLighting() {
    this.hemisphere = new THREE.HemisphereLight(0x8291b4, 0x241b20, 1.25);
    this.scene.add(this.hemisphere);
    this.keyLight = new THREE.DirectionalLight(0xffe2b0, 2.65);
    this.keyLight.position.set(10, 18, 8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 48;
    this.keyLight.shadow.camera.left = -22;
    this.keyLight.shadow.camera.right = 22;
    this.keyLight.shadow.camera.top = 18;
    this.keyLight.shadow.camera.bottom = -18;
    this.keyLight.shadow.normalBias = 0.04;
    this.scene.add(this.keyLight);
    this.accentLight = new THREE.PointLight(0x8d4ec3, 22, 24, 2);
    this.accentLight.position.set(-7, 5, -2);
    this.scene.add(this.accentLight);
    this.rimLight = new THREE.DirectionalLight(0x8ecbff, 0.9);
    this.rimLight.position.set(-9, 11, -7);
    this.scene.add(this.rimLight);
  }

  createProjectiles() {
    const geometry = new THREE.IcosahedronGeometry(0.26, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.projectileInstances = new THREE.InstancedMesh(geometry, material, MAX_PROJECTILES);
    this.projectileInstances.count = 0;
    this.projectileInstances.frustumCulled = false;
    this.projectileInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.projectileInstances);
  }

  createPortal() {
    this.portal = new THREE.Group();
    this.portal.name = "center-descent-portal";
    this.portal.visible = false;

    this.portalCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0x07030e,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.portalGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xb646ff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.portalRingMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3c66b,
      emissive: 0x9b3cff,
      emissiveIntensity: 2.6,
      metalness: 0.58,
      roughness: 0.2,
    });
    this.portalInnerMaterial = this.portalRingMaterial.clone();
    this.portalInnerMaterial.color.set(0xe680ff);
    this.portalInnerMaterial.emissive.set(0x6b1eaa);

    this.portalCore = new THREE.Mesh(new THREE.CircleGeometry(1.24, 72), this.portalCoreMaterial);
    this.portalGlow = new THREE.Mesh(new THREE.RingGeometry(0.34, 1.43, 72), this.portalGlowMaterial);
    this.portalOuterRing = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.105, 10, 72), this.portalRingMaterial);
    this.portalInnerRing = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.045, 8, 56), this.portalInnerMaterial);
    for (const mesh of [this.portalCore, this.portalGlow, this.portalOuterRing, this.portalInnerRing]) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 5;
    }
    this.portalCore.position.y = 0.035;
    this.portalGlow.position.y = 0.055;
    this.portalOuterRing.position.y = 0.09;
    this.portalInnerRing.position.y = 0.075;

    const moteCount = 42;
    const motePositions = new Float32Array(moteCount * 3);
    for (let index = 0; index < moteCount; index += 1) {
      const angle = (index / moteCount) * Math.PI * 2;
      const radius = 0.46 + (index % 7) * 0.13;
      motePositions[index * 3] = Math.cos(angle) * radius;
      motePositions[index * 3 + 1] = 0.13 + (index % 5) * 0.075;
      motePositions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
    const moteMaterial = new THREE.PointsMaterial({
      color: 0xf3c6ff,
      size: 0.115,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.portalMotes = new THREE.Points(moteGeometry, moteMaterial);
    this.portalLight = new THREE.PointLight(0xb94fff, 0, 8, 2);
    this.portalLight.position.y = 0.5;
    this.portal.add(
      this.portalCore,
      this.portalGlow,
      this.portalOuterRing,
      this.portalInnerRing,
      this.portalMotes,
      this.portalLight,
    );
    this.portalOpenTime = 0;
    this.portalWasVisible = false;
    this.scene.add(this.portal);
    this.createPortalGuide();
  }

  createPortalGuide() {
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, -1.22);
    arrowShape.lineTo(0.8, -0.24);
    arrowShape.lineTo(0.29, -0.24);
    arrowShape.lineTo(0.29, 0.78);
    arrowShape.lineTo(-0.29, 0.78);
    arrowShape.lineTo(-0.29, -0.24);
    arrowShape.lineTo(-0.8, -0.24);
    arrowShape.closePath();

    const geometry = new THREE.ShapeGeometry(arrowShape);
    this.portalGuideGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xb646ff,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.portalGuideOutlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x2c103c,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.portalGuideCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc94f,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const glow = new THREE.Mesh(geometry, this.portalGuideGlowMaterial);
    const outline = new THREE.Mesh(geometry, this.portalGuideOutlineMaterial);
    const core = new THREE.Mesh(geometry, this.portalGuideCoreMaterial);
    for (const mesh of [glow, outline, core]) {
      mesh.rotation.x = -Math.PI / 2;
    }
    glow.renderOrder = 6;
    outline.renderOrder = 7;
    core.renderOrder = 8;
    glow.scale.setScalar(1.34);
    outline.scale.setScalar(1.13);
    glow.position.y = 0;
    outline.position.y = 0.018;
    core.position.y = 0.036;

    this.portalGuide = new THREE.Group();
    this.portalGuide.name = "portal-direction-guide";
    this.portalGuide.visible = false;
    this.portalGuide.add(glow, outline, core);
    this.portalGuideTime = 0;
    this.scene.add(this.portalGuide);
  }

  buildArena(arena, loadToken) {
    if (!this.initialized) return;
    this.cameraSystem.setArena(arena);
    this.cameraSystem.snapTo(arena.playerSpawn);
    this.portal.position.set(arena.portal.x, 0, arena.portal.z);
    this.portal.visible = false;
    this.portalWasVisible = false;
    this.portalOpenTime = 0;
    this.portalGuide.visible = false;
    this.portalGuideTime = 0;
    this.applyBiomePalette(arena.biome);
    this.worldReady = this.biomeRenderer.build(arena).then(() => loadToken);
  }

  whenWorldReady() {
    return this.worldReady;
  }

  applyBiomePalette(id) {
    const { palette } = getBiome(id);
    this.scene.background.set(palette.sky);
    this.scene.fog.color.set(palette.fog);
    this.hemisphere.color.set(palette.hemisphere);
    this.hemisphere.groundColor.set(palette.ground);
    this.keyLight.color.set(palette.key);
    this.accentLight.color.set(palette.accent);
    this.rimLight.color.set(palette.hemisphere);
  }

  syncState(game, alpha, dt) {
    if (!this.initialized || !game.player || !game.arena) return;
    const presentationDt = presentationDelta(game, dt);
    this.actorRenderer.sync(game, alpha, presentationDt);
    this.syncPortalPlayer(game);
    this.effects.syncPlayerAttack(game.player, game.combat);
    this.syncProjectiles(game.director.projectiles, alpha);
    const boss = game.director.activeBoss();
    const endingUrgency = endingCorruptionUrgency(game);
    this.syncPortal(game, presentationDt);
    const playerX = interpolated(game.player.previousPosition.x, game.player.position.x, alpha);
    const playerZ = interpolated(game.player.previousPosition.z, game.player.position.z, alpha);
    this.syncPortalGuide(game, playerX, playerZ, presentationDt);
    this.cameraSystem.update(
      presentationDt,
      { x: playerX, z: playerZ },
      game.aimPoint,
      Boolean(boss),
      game.portalTraversal?.active ? game.portalTraversal : null,
      endingUrgency,
    );
    this.damageNumbers.update(dt, this.cameraSystem.camera, {
      phase: game.phase,
      hitStopActive: game.hitStop.remaining() > 0,
    });
    this.scene.fog.density = this.baseFogDensity + endingUrgency * 0.012;
    if (endingUrgency > 0) {
      this.accentLight.intensity = 22 + endingUrgency * 18;
      this.endingAccentBase.set(getBiome(game.arena.biome).palette.accent);
      this.accentLight.color.lerpColors(this.endingAccentBase, this.endingAccentCorrupt, endingUrgency);
    } else {
      this.accentLight.intensity = 22;
      this.accentLight.color.set(getBiome(game.arena.biome).palette.accent);
    }
    this.effects.update(presentationDt);
  }

  syncPortalPlayer(game) {
    const playerGroup = this.actorRenderer?.playerGroup;
    if (!playerGroup) return;
    const traversal = game.portalTraversal;
    playerGroup.visible = game.roomReady || Boolean(traversal?.active || traversal?.completed);
    if (!traversal) {
      playerGroup.position.y = 0;
      playerGroup.scale.setScalar(1);
      return;
    }
    playerGroup.position.y = traversal.visualHeight;
    playerGroup.scale.setScalar(traversal.visualScale);
  }

  syncPortal(game, dt) {
    const traversal = game.portalTraversal;
    const visible = game.portalActive || Boolean(traversal?.active || traversal?.completed);
    this.portal.visible = visible;
    if (!visible) {
      this.portalWasVisible = false;
      this.portalLight.intensity = 0;
      return;
    }
    if (!this.portalWasVisible) this.portalOpenTime = 0;
    this.portalWasVisible = true;
    this.portalOpenTime += dt;
    const openProgress = clamp01(this.portalOpenTime / 0.48);
    const openScale = Math.max(0.001, easeOutBack(openProgress));
    const entryProgress = traversal?.progress ?? 0;
    const collapse = traversal?.active ? 1 - entryProgress * 0.18 : 1;
    this.portal.scale.setScalar(openScale * collapse);
    this.portal.rotation.y += dt * (traversal?.active ? 4.8 : 1.15);
    this.portalOuterRing.rotation.z += dt * (traversal?.active ? 5.4 : 1.8);
    this.portalInnerRing.rotation.z -= dt * (traversal?.active ? 7.2 : 2.65);
    this.portalMotes.rotation.y -= dt * (traversal?.active ? 6.2 : 1.7);
    const pulse = 0.5 + Math.sin(this.portalOpenTime * 7.5) * 0.5;
    this.portalGlowMaterial.opacity = 0.25 + pulse * 0.24 + entryProgress * 0.24;
    this.portalCoreMaterial.opacity = 0.9 + entryProgress * 0.08;
    this.portalRingMaterial.emissiveIntensity = 2.2 + pulse * 1.4 + entryProgress * 2.5;
    this.portalInnerMaterial.emissiveIntensity = 2 + (1 - pulse) * 1.1 + entryProgress * 3;
    this.portalMotes.material.opacity = 0.55 + pulse * 0.35;
    this.portalLight.intensity = (12 + pulse * 10 + entryProgress * 18) * openProgress;
  }

  syncPortalGuide(game, playerX, playerZ, dt) {
    const portal = game.arena.portal;
    const dx = portal.x - playerX;
    const dz = portal.z - playerZ;
    const portalDistance = Math.hypot(dx, dz);
    const visible = game.portalActive && game.phase === "playing" && portalDistance > PORTAL_CONFIG.interactionRadius;
    this.portalGuide.visible = visible;
    if (!visible) return;

    this.portalGuideTime += dt;
    const directionX = dx / portalDistance;
    const directionZ = dz / portalDistance;
    const leadDistance = Math.min(2.15, Math.max(1.35, portalDistance * 0.25));
    const pulse = 0.5 + Math.sin(this.portalGuideTime * 6.8) * 0.5;
    this.portalGuide.position.set(
      playerX + directionX * leadDistance,
      0.12 + pulse * 0.035,
      playerZ + directionZ * leadDistance,
    );
    this.portalGuide.rotation.y = Math.atan2(directionX, directionZ);
    this.portalGuide.scale.setScalar(0.92 + pulse * 0.1);
    this.portalGuideCoreMaterial.opacity = 0.94 + pulse * 0.06;
    this.portalGuideOutlineMaterial.opacity = 0.74 + pulse * 0.14;
    this.portalGuideGlowMaterial.opacity = 0.28 + pulse * 0.28;
  }

  syncProjectiles(projectiles, alpha) {
    const active = projectiles.filter((projectile) => projectile.active).slice(0, MAX_PROJECTILES);
    this.projectileInstances.count = active.length;
    for (let index = 0; index < active.length; index += 1) {
      const projectile = active[index];
      const height = projectile.height || (projectile.mode === "rune" ? 0.18 : 0.72);
      this.projectileMatrix.makeTranslation(
        interpolated(projectile.previousPosition.x, projectile.position.x, alpha),
        height,
        interpolated(projectile.previousPosition.z, projectile.position.z, alpha),
      );
      this.projectileInstances.setMatrixAt(index, this.projectileMatrix);
      this.projectileColor.set(PROJECTILE_COLORS[projectile.kind] ?? 0xc86cff);
      this.projectileInstances.setColorAt(index, this.projectileColor);
    }
    this.projectileInstances.instanceMatrix.needsUpdate = true;
    if (this.projectileInstances.instanceColor) this.projectileInstances.instanceColor.needsUpdate = true;
  }

  handleEvent(event, game) {
    const sourceEvent = event ?? {};
    const { type } = sourceEvent;
    const detail = sourceEvent.detail ?? {};
    this.actorRenderer?.handleEvent(sourceEvent);
    this.damageNumbers?.handleEvent(sourceEvent, game);
    if (type === "enemyHit") {
      const position = presentationPoint(detail.position);
      if (position) {
        this.lastEnemyHitPresentation = {
          actionId: detail.actionId ?? detail.hit?.actionId ?? null,
          targetId: detail.id ?? null,
          position,
        };
      }
    }
    const lastHit = this.lastEnemyHitPresentation;
    const activeEnemy = (type === "claimHit" || type === "claimPulled")
      ? game?.director?.enemies?.find?.((enemy) => enemy.id === detail.targetId)
      : null;
    const resolvedEnemyPosition = presentationPoint(activeEnemy?.position) ?? (lastHit
      && detail.actionId != null
      && detail.targetId != null
      && lastHit.actionId === detail.actionId
      && lastHit.targetId === detail.targetId
      ? lastHit.position
      : null);
    applyCombatPresentation(combatPresentationDescriptor(type, detail, {
      playerPosition: game?.player?.position,
      resolvedEnemyPosition,
      endingTargetPosition: { x: 2.5, z: 2.1 },
      reducedMotion: Boolean(this.settings?.get?.("camera.reducedMotion")),
      screenFlashes: this.settings?.get?.("accessibility.screenFlashes") !== false,
    }), this.effects, this.cameraSystem);
    applyCombatPresentation(witchPresentationDescriptor(type, detail, {
      reducedMotion: Boolean(this.settings?.get?.("camera.reducedMotion")),
      screenFlashes: this.settings?.get?.("accessibility.screenFlashes") !== false,
    }), this.effects, this.cameraSystem);
    if (type === "arenaChanged") this.buildArena(detail.arena, detail.loadToken);
    if (type === "enemyHit") {
      this.effects.spawnBurst(detail.position, detail.critical ? 0xffd36b : 0xa9e5ee, detail.critical ? 22 : 10, detail.critical ? 6 : 4);
      this.cameraSystem.addTrauma(detail.critical ? 0.28 : 0.12);
    }
    if (type === "enemyDefeated") {
      this.effects.spawnBurst(detail.position, detail.type === "queen" ? 0xd77aff : 0xb34c68, detail.type === "queen" ? 70 : 22, 7);
      this.cameraSystem.addTrauma(detail.type === "queen" ? 0.85 : 0.24);
    }
    if (type === "enemySpawned") {
      const color = detail.origin === "volatile" ? 0x9b3f63 : 0xc8bee0;
      this.effects.spawnBurst(detail.position, color, detail.origin === "volatile" ? 18 : 10, detail.origin === "volatile" ? 5.2 : 3.2);
      this.effects.spawnRing(detail.position, detail.origin === "volatile" ? 0.72 : 0.58, color, 0.3);
    }
    if (type === "stableOriginDismissed") {
      for (const actor of detail.actors ?? []) {
        this.effects.spawnRing(actor.position, 0.7, 0xc8bee0, 0.38);
      }
    }
    if (type === "dash") {
      this.effects.spawnDashStreak(detail.position, detail.direction);
    }
    if (type === "enemyTelegraph") this.effects.spawnTelegraph(detail);
    if (type === "queenSpecialAnticipated") this.effects.alignTelegraphAction(detail.actionId, detail.duration);
    if (["queenSpecialReleased", "queenSpecialRecovered", "queenSpecialCancelled"].includes(type)) {
      this.effects.resolveTelegraphAction(detail.actionId);
    }
    if (type === "projectileImpact") this.effects.spawnRing(detail.position, detail.radius || 1.8, detail.kind === "cinderBomb" ? 0xff6b27 : 0xd36be8, 0.32);
    if (type === "enemyBlink" || (type === "queenTeleport" && detail.actionId == null)) {
      this.effects.spawnBurst(detail.position, 0xc15bf0, 34, 6);
    }
    if (type === "enemyBlock") this.effects.spawnBurst(detail.position, 0xffd27d, 12, 3.5);
    if (type === "portalOpened") this.effects.spawnRing(detail.portal, 1.65, 0xe8c26b, 0.7);
    if (type === "portalTraversalStarted") {
      this.effects.spawnRing(detail.portal, 1.5, 0xd45cff, 0.5);
      this.effects.spawnBurst(detail.portal, 0xf0b9ff, 30, 5.5);
      this.cameraSystem.addTrauma(0.2);
    }
    if (type === "portalTraversalCompleted") {
      this.effects.spawnRing(detail.portal, 0.72, 0x8c36d8, 0.32);
    }
    if (type === "witchMagicCeased") {
      this.effects.spawnRing(game.arena?.portal ?? { x: 0, z: 0 }, 5.5, 0xc8bee0, 0.9);
      this.cameraSystem.addTrauma(0.72);
    }
    if (type === "princessHumanReturned") this.cameraSystem.addTrauma(0.18);
    if (type === "princessKilled" || type === "corruptionDestroyed") {
      this.cameraSystem.addTrauma(0.88);
      this.effects.spawnRing({ x: 2.5, z: 2.1 }, 4.8, 0xf5d993, 0.9);
    }
    if (type === "playerKilledByPrincess" && game.player) {
      this.cameraSystem.addTrauma(1);
      this.effects.spawnBurst(game.player.position, 0xb53d67, 72, 8);
    }
    if (type === "endingChoiceResolved") {
      this.cameraSystem.addTrauma(detail.ending === "kill" ? 0.95 : 0.78);
      const color = detail.ending === "kill" ? 0xf5d993 : 0xb53d67;
      if (game.player) this.effects.spawnBurst(game.player.position, color, 64, 7.5);
    }
  }

  applySettings(values) {
    const pixelRatio = Math.min(window.devicePixelRatio, 2) * values.graphics.resolutionScale;
    this.renderer.setPixelRatio(Math.max(0.5, pixelRatio));
    this.renderer.shadowMap.enabled = values.graphics.shadows !== "off";
    this.renderer.shadowMap.type = values.graphics.shadows === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const shadowSize = values.graphics.shadows === "high" ? 2048 : values.graphics.shadows === "low" ? 512 : 1024;
    this.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.damageNumbers.applySettings(values);
    this.resize();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.cameraSystem.resize(width, height);
    this.damageNumbers.resize();
  }

  screenToGround(pointerNdc) {
    return this.cameraSystem.screenToGround(pointerNdc);
  }

  render() {
    this.beginGpuQuery();
    this.renderer.render(this.scene, this.cameraSystem.camera);
    this.endGpuQuery();
    this.pollGpuQuery();
  }

  setAnimationLoop(callback) {
    this.renderer.setAnimationLoop(callback);
  }

  saturateDamageNumbersForBenchmark(game) {
    const enemies = game?.director?.enemies ?? [];
    const playerPosition = game?.player?.position ?? { x: 0, z: 0 };
    this.damageNumbers.clear(true);
    for (let index = 0; index < Math.min(35, enemies.length); index += 1) {
      const enemy = enemies[index];
      this.damageNumbers.handleEvent({
        type: "enemyHit",
        detail: {
          id: enemy.id,
          type: enemy.type,
          actionId: `benchmark-normal-${index}`,
          damage: 10 + index,
          critical: false,
          blocked: false,
          position: enemy.position,
          direction: { x: 1, z: 0 },
        },
      });
    }
    const first = enemies[0];
    if (first) {
      this.damageNumbers.handleEvent({
        type: "enemyHit",
        detail: {
          id: first.id,
          type: first.type,
          actionId: "benchmark-aggregate",
          damage: 5,
          critical: false,
          blocked: false,
          position: first.position,
        },
      });
    }
    for (let index = 0; index < Math.min(9, enemies.length); index += 1) {
      const enemy = enemies[index];
      this.damageNumbers.handleEvent({
        type: "enemyHit",
        detail: {
          id: enemy.id,
          type: enemy.type,
          actionId: `benchmark-critical-${index}`,
          damage: 40 + index,
          critical: true,
          blocked: false,
          position: enemy.position,
        },
      });
    }
    if (first) {
      this.damageNumbers.handleEvent({
        type: "enemyHit",
        detail: {
          id: first.id,
          type: first.type,
          actionId: "benchmark-blocked",
          damage: 8,
          critical: true,
          blocked: true,
          position: first.position,
        },
      });
    }
    this.damageNumbers.handleEvent({
      type: "playerHit",
      detail: { attemptId: "benchmark-player", appliedAmount: 12, position: playerPosition, direction: { x: -1, z: 0 } },
    });
    this.damageNumbers.handleEvent({
      type: "playerHealed",
      detail: { healingId: "benchmark-heal", targetId: "player", amount: 9, reason: "kill", position: playerPosition },
    });
    this.damageNumbers.handleEvent({
      type: "playerHealed",
      detail: { healingId: "benchmark-revive", targetId: "player", amount: 49, reason: "deathDefiance", position: playerPosition },
    });
    return this.damageNumbers.metrics();
  }

  createGpuTimer() {
    const gl = this.renderer.getContext();
    const extension = gl instanceof WebGL2RenderingContext ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
    return { gl, extension, enabled: false, active: null, pending: [], lastMs: null };
  }

  setGpuTimingEnabled(enabled) {
    this.gpuTimer.enabled = enabled && Boolean(this.gpuTimer.extension);
  }

  beginGpuQuery() {
    const timer = this.gpuTimer;
    if (!timer.enabled || timer.active) return;
    const query = timer.gl.createQuery();
    timer.gl.beginQuery(timer.extension.TIME_ELAPSED_EXT, query);
    timer.active = query;
  }

  endGpuQuery() {
    const timer = this.gpuTimer;
    if (!timer.active) return;
    timer.gl.endQuery(timer.extension.TIME_ELAPSED_EXT);
    timer.pending.push(timer.active);
    timer.active = null;
  }

  pollGpuQuery() {
    const timer = this.gpuTimer;
    const query = timer.pending[0];
    if (!query) return;
    const available = timer.gl.getQueryParameter(query, timer.gl.QUERY_RESULT_AVAILABLE);
    const disjoint = timer.gl.getParameter(timer.extension.GPU_DISJOINT_EXT);
    if (!available || disjoint) return;
    timer.lastMs = timer.gl.getQueryParameter(query, timer.gl.QUERY_RESULT) / 1_000_000;
    timer.gl.deleteQuery(query);
    timer.pending.shift();
  }

  metrics() {
    const actorMetrics = this.actorRenderer?.metrics() ?? {};
    const damageNumbers = this.damageNumbers.metrics();
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      gpuMs: this.gpuTimer.lastMs,
      particles: this.effects.activeParticleCount(),
      telegraphs: this.effects.activeTelegraphCount(),
      damageNumbers,
      ...actorMetrics,
      assetsReady: this.initialized,
    };
  }
}
