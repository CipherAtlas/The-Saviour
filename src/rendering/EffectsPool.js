import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { STRAIGHT_CHARGE_ATTACK, STRAIGHT_CHARGE_CONFIG } from "../game/gameConfig.js";
import { samplePlayerScytheAnimation } from "./playerScytheAnimation.js";

const PARTICLE_CAPACITY = 320;
const TELEGRAPH_CAPACITY = 40;
const DASH_STREAK_CAPACITY = 14;
const FULL_CIRCLE = Math.PI * 2;
const SCYTHE_ARC_SEGMENTS = 96;
const TELEGRAPH_UP = new THREE.Vector3(0, 1, 0);

const TELEGRAPH_GEOMETRY = Object.freeze({
  circleFill: (() => { const geometry = new THREE.CircleGeometry(1, 48); geometry.rotateX(-Math.PI / 2); return geometry; })(),
  circleRim: (() => { const geometry = new THREE.RingGeometry(0.91, 1, 48); geometry.rotateX(-Math.PI / 2); return geometry; })(),
  ringFill: (() => { const geometry = new THREE.RingGeometry(0.72, 1, 48); geometry.rotateX(-Math.PI / 2); return geometry; })(),
  ringRim: (() => { const geometry = new THREE.RingGeometry(0.93, 1, 48); geometry.rotateX(-Math.PI / 2); return geometry; })(),
  lane: (() => { const geometry = new THREE.PlaneGeometry(1, 1); geometry.rotateX(-Math.PI / 2); return geometry; })(),
});

const telegraphGeometryCache = new Map();

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function particleDensityForSettings(settings) {
  if (settings?.get?.("accessibility.reducedParticles")) return 0.35;
  const configuredDensity = Number(settings?.get?.("graphics.effectsDensity"));
  return Number.isFinite(configuredDensity) ? clamp01(configuredDensity) : 1;
}

function createArcGeometry(innerRadius, outerRadius, arc) {
  const segments = Math.max(12, Math.ceil(SCYTHE_ARC_SEGMENTS * (arc / FULL_CIRCLE)));
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments, 1, -arc / 2, arc);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createStraightLineGeometry(length = 1, width = 1, anchored = true) {
  const geometry = new THREE.PlaneGeometry(length, width);
  geometry.rotateX(-Math.PI / 2);
  if (anchored) geometry.translate(length / 2, 0, 0);
  return geometry;
}

function createGroundMaterial(color, blending = THREE.AdditiveBlending) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending,
  });
}

function telegraphLayer(source, role, y, scaleX = 1, scaleZ = 1) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const position = geometry.getAttribute("position").clone();
  for (const attribute of Object.keys(geometry.attributes)) geometry.deleteAttribute(attribute);
  geometry.setAttribute("position", position);
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(0, y, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(scaleX, 1, scaleZ),
  ));
  geometry.setAttribute("layerRole", new THREE.Float32BufferAttribute(
    new Float32Array(geometry.getAttribute("position").count).fill(role),
    1,
  ));
  return geometry;
}

function combinedTelegraphGeometry(fillSource, rimSource, fillScaleX = 1, fillScaleZ = 1) {
  const fill = telegraphLayer(fillSource, 0, 0.058, fillScaleX, fillScaleZ);
  const rim = telegraphLayer(rimSource, 1, 0.074);
  const geometry = mergeGeometries([fill, rim], false);
  fill.dispose();
  rim.dispose();
  if (!geometry) throw new Error("Unable to create batched telegraph geometry");
  geometry.computeBoundingSphere();
  return geometry;
}

function telegraphGeometry(key, angle = null) {
  if (telegraphGeometryCache.has(key)) return telegraphGeometryCache.get(key);
  let geometry;
  if (key === "circle") {
    geometry = combinedTelegraphGeometry(TELEGRAPH_GEOMETRY.circleFill, TELEGRAPH_GEOMETRY.circleRim);
  } else if (key === "ring") {
    geometry = combinedTelegraphGeometry(TELEGRAPH_GEOMETRY.ringFill, TELEGRAPH_GEOMETRY.ringRim);
  } else if (key === "lane") {
    geometry = combinedTelegraphGeometry(TELEGRAPH_GEOMETRY.lane, TELEGRAPH_GEOMETRY.lane, 0.9, 0.96);
  } else {
    const fill = new THREE.RingGeometry(0.06, 1, 48, 1, -angle / 2, angle);
    const rim = new THREE.RingGeometry(0.92, 1, 48, 1, -angle / 2, angle);
    fill.rotateX(-Math.PI / 2);
    rim.rotateX(-Math.PI / 2);
    geometry = combinedTelegraphGeometry(fill, rim);
    fill.dispose();
    rim.dispose();
  }
  telegraphGeometryCache.set(key, geometry);
  return geometry;
}

function createTelegraphMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: `
      attribute float layerRole;
      attribute vec3 instanceTint;
      attribute vec2 instanceStyle;
      varying float vLayerRole;
      varying vec3 vTint;
      varying vec2 vStyle;
      void main() {
        vLayerRole = layerRole;
        vTint = instanceTint;
        vStyle = instanceStyle;
        vec4 transformed = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          transformed = instanceMatrix * transformed;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * transformed;
      }
    `,
    fragmentShader: `
      varying float vLayerRole;
      varying vec3 vTint;
      varying vec2 vStyle;
      void main() {
        float urgency = vStyle.x;
        float life = vStyle.y;
        float fillAlpha = 0.07 + urgency * 0.16;
        float rimAlpha = (0.36 + urgency * 0.58) * life + 0.08;
        float alpha = mix(fillAlpha, rimAlpha, step(0.5, vLayerRole));
        gl_FragColor = vec4(vTint, alpha);
      }
    `,
  });
}

function telegraphColor(detail) {
  if (detail.telegraphRole === "departure") return 0x9c35ca;
  if (detail.telegraphRole === "arrival") return 0xf0a7ff;
  if (detail.telegraphRole === "summonCore") return 0xffc2ef;
  if (detail.type === "queen") return 0xd75aff;
  if (detail.attack === "lobbedBomb") return 0xff6128;
  if (detail.attack === "rune" || detail.type === "hexer") return 0xb95dff;
  if (detail.type === "wraith") return 0x8c66ff;
  return 0xf04450;
}

export function telegraphBatchDescriptor(detail) {
  const shape = detail.shape ?? "circle";
  const radius = Math.max(0.35, detail.radius ?? 2.2);
  const width = Math.max(0.3, detail.width ?? radius * 0.8);
  if (shape === "lane") return { key: "lane", angle: null };
  if (shape === "ring") return { key: "ring", angle: null };
  if (shape === "cone") {
    const angle = Math.max(0.22, Math.min(Math.PI * 1.35, 2 * Math.atan2(width * 0.5, radius)));
    return { key: `cone:${Math.round(angle * 100)}`, angle };
  }
  return { key: "circle", angle: null };
}

export function queenTelegraphDescriptors(detail = {}) {
  const action = detail.attack ?? detail.action;
  const radius = Math.max(0.35, detail.radius ?? (action === "summon" ? 3.2 : 1.35));
  const position = detail.position ?? detail.origin ?? { x: 0, z: 0 };
  const target = detail.target ?? position;
  if (action === "teleport" || detail.shape === "blink") {
    return [
      {
        ...detail,
        shape: "ring",
        position,
        target: position,
        radius: radius * 0.72,
        telegraphRole: "departure",
      },
      {
        ...detail,
        shape: "circle",
        position: target,
        target,
        radius,
        telegraphRole: "arrival",
      },
    ];
  }
  if (action === "summon") {
    return [
      {
        ...detail,
        shape: "ring",
        position,
        target: position,
        radius,
        telegraphRole: "summonWard",
      },
      {
        ...detail,
        shape: "circle",
        position,
        target: position,
        radius: radius * 0.38,
        telegraphRole: "summonCore",
      },
    ];
  }
  return [detail];
}

export class EffectsPool {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.particles = Array.from({ length: PARTICLE_CAPACITY }, () => ({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      color: new THREE.Color(),
    }));
    this.positions = new Float32Array(PARTICLE_CAPACITY * 3);
    this.colors = new Float32Array(PARTICLE_CAPACITY * 3);
    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.particleGeometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.scytheSweep = this.createScytheSweep();
    this.straightChargeLine = this.createStraightChargeLine();
    this.rings = Array.from({ length: 20 }, () => this.createRing());
    this.telegraphBatches = new Map();
    this.telegraphMatrix = new THREE.Matrix4();
    this.telegraphPosition = new THREE.Vector3();
    this.telegraphScale = new THREE.Vector3();
    this.telegraphRotation = new THREE.Quaternion();
    this.telegraphs = Array.from({ length: TELEGRAPH_CAPACITY }, () => this.createTelegraph());
    this.dashStreaks = Array.from({ length: DASH_STREAK_CAPACITY }, () => this.createDashStreak());
  }

  createScytheSweep() {
    const group = new THREE.Group();
    group.visible = false;

    const coverage = new THREE.Mesh(createArcGeometry(0.16, 1, Math.PI), createGroundMaterial(0x38d9ff, THREE.NormalBlending));
    const activeTrail = new THREE.Mesh(createArcGeometry(0.3, 1, Math.PI), createGroundMaterial(0xa9f5ff));
    const outerRim = new THREE.Mesh(createArcGeometry(0.965, 1, Math.PI), createGroundMaterial(0xe8fdff));
    const innerRim = new THREE.Mesh(createArcGeometry(0.16, 0.185, Math.PI), createGroundMaterial(0x8cecff));
    const leadingBladeGeometry = new THREE.RingGeometry(0.18, 1, 8, 1, -0.055, 0.11);
    leadingBladeGeometry.rotateX(-Math.PI / 2);
    const leadingBlade = new THREE.Mesh(leadingBladeGeometry, createGroundMaterial(0xffffff));

    const rayGeometry = new THREE.PlaneGeometry(0.82, 0.012);
    rayGeometry.rotateX(-Math.PI / 2);
    const startRay = new THREE.Mesh(rayGeometry, createGroundMaterial(0x82eaff));
    const endRay = new THREE.Mesh(rayGeometry, createGroundMaterial(0xdffcff));
    const glowGeometry = new THREE.CircleGeometry(0.036, 16);
    glowGeometry.rotateX(-Math.PI / 2);
    const movingGlow = new THREE.Mesh(glowGeometry, createGroundMaterial(0xffffff));

    coverage.position.y = 0.055;
    innerRim.position.y = 0.068;
    activeTrail.position.y = 0.078;
    outerRim.position.y = 0.09;
    startRay.position.y = 0.095;
    endRay.position.y = 0.097;
    leadingBlade.position.y = 0.105;
    movingGlow.position.y = 0.115;
    for (const mesh of [coverage, innerRim, activeTrail, outerRim, startRay, endRay, leadingBlade, movingGlow]) {
      mesh.renderOrder = 9;
    }
    group.add(coverage, innerRim, activeTrail, outerRim, startRay, endRay, leadingBlade, movingGlow);
    this.scene.add(group);

    return {
      group,
      coverage,
      activeTrail,
      outerRim,
      innerRim,
      startRay,
      endRay,
      leadingBlade,
      movingGlow,
      arc: Math.PI,
      heavy: false,
      stage: -1,
    };
  }

  createStraightChargeLine() {
    const group = new THREE.Group();
    group.visible = false;
    const coverage = new THREE.Mesh(
      createStraightLineGeometry(),
      createGroundMaterial(0x2bc8ef, THREE.NormalBlending),
    );
    const core = new THREE.Mesh(createStraightLineGeometry(), createGroundMaterial(0xeafcff));
    const center = new THREE.Mesh(createStraightLineGeometry(), createGroundMaterial(0xffd77b));
    const railGeometry = createStraightLineGeometry();
    const leftRail = new THREE.Mesh(railGeometry, createGroundMaterial(0x8cecff));
    const rightRail = new THREE.Mesh(railGeometry.clone(), createGroundMaterial(0x8cecff));
    const head = new THREE.Mesh(
      createStraightLineGeometry(0.018, 1, false),
      createGroundMaterial(0xffffff),
    );
    coverage.position.y = 0.058;
    core.position.y = 0.078;
    center.position.y = 0.088;
    leftRail.position.set(0, 0.098, 0.485);
    rightRail.position.set(0, 0.098, -0.485);
    head.position.y = 0.112;
    core.scale.z = 0.72;
    center.scale.z = 0.16;
    leftRail.scale.z = 0.03;
    rightRail.scale.z = 0.03;
    for (const mesh of [coverage, core, center, leftRail, rightRail, head]) mesh.renderOrder = 9;
    group.add(coverage, core, center, leftRail, rightRail, head);
    this.scene.add(group);
    return { group, coverage, core, center, leftRail, rightRail, head };
  }

  createTelegraph() {
    return {
      active: false,
      actionId: null,
      attack: null,
      telegraphRole: null,
      key: "circle",
      angle: null,
      position: new THREE.Vector3(),
      rotationY: 0,
      baseScaleX: 1,
      baseScaleZ: 1,
      color: new THREE.Color(0xff4f5f),
      life: 0,
      maxLife: 0,
    };
  }

  getTelegraphBatch(key, angle) {
    if (this.telegraphBatches.has(key)) return this.telegraphBatches.get(key);
    const geometry = telegraphGeometry(key, angle).clone();
    const tints = new Float32Array(TELEGRAPH_CAPACITY * 3);
    const styles = new Float32Array(TELEGRAPH_CAPACITY * 2);
    geometry.setAttribute("instanceTint", new THREE.InstancedBufferAttribute(tints, 3));
    geometry.setAttribute("instanceStyle", new THREE.InstancedBufferAttribute(styles, 2));
    const mesh = new THREE.InstancedMesh(geometry, createTelegraphMaterial(), TELEGRAPH_CAPACITY);
    mesh.name = `telegraph-batch-${key}`;
    mesh.count = 0;
    mesh.renderOrder = 8;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const batch = { mesh, tints, styles, count: 0 };
    this.telegraphBatches.set(key, batch);
    this.scene.add(mesh);
    return batch;
  }

  createDashStreak() {
    const material = createGroundMaterial(0x75e8ff);
    const mesh = new THREE.Mesh(TELEGRAPH_GEOMETRY.lane, material);
    mesh.visible = false;
    mesh.position.y = 0.085;
    mesh.renderOrder = 8;
    mesh.userData.life = 0;
    mesh.userData.maxLife = 0.22;
    this.scene.add(mesh);
    return mesh;
  }

  createRing() {
    const geometry = new THREE.RingGeometry(0.88, 1, 32);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xcf6de7,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.userData.life = 0;
    mesh.userData.maxLife = 0.35;
    this.scene.add(mesh);
    return mesh;
  }

  configureScytheSweep(arc, heavy, stage) {
    const sweep = this.scytheSweep;
    for (const [mesh, inner, outer] of [
      [sweep.coverage, 0.16, 1],
      [sweep.activeTrail, 0.3, 1],
      [sweep.outerRim, 0.965, 1],
      [sweep.innerRim, 0.16, 0.185],
    ]) {
      mesh.geometry.dispose();
      mesh.geometry = createArcGeometry(inner, outer, arc);
    }
    sweep.arc = arc;
    sweep.heavy = heavy;
    sweep.stage = stage;
    const startAngle = -arc / 2;
    const endAngle = arc / 2;
    sweep.startRay.position.x = Math.cos(startAngle) * 0.59;
    sweep.startRay.position.z = -Math.sin(startAngle) * 0.59;
    sweep.startRay.rotation.y = startAngle;
    sweep.endRay.position.x = Math.cos(endAngle) * 0.59;
    sweep.endRay.position.z = -Math.sin(endAngle) * 0.59;
    sweep.endRay.rotation.y = endAngle;

    const finisher = stage === 2;
    const fillColor = heavy ? 0xd9aa52 : finisher ? 0xffd985 : 0x2ccfff;
    const edgeColor = heavy ? 0xe3fbff : finisher ? 0xffdc89 : 0xcafaff;
    sweep.coverage.material.color.set(fillColor);
    sweep.activeTrail.material.color.set(heavy ? 0xffd985 : finisher ? 0xffe7ac : 0x8defff);
    sweep.innerRim.material.color.set(fillColor);
    sweep.outerRim.material.color.set(edgeColor);
    sweep.startRay.material.color.set(fillColor);
    sweep.endRay.material.color.set(edgeColor);
    sweep.leadingBlade.material.color.set(heavy ? 0xf7f2d0 : finisher ? 0xffe7ac : 0xffffff);
    sweep.movingGlow.material.color.set(heavy ? 0xe3fbff : finisher ? 0xffd677 : 0xffffff);
  }

  syncPlayerAttack(player, combat) {
    const attack = combat.attack;
    const sweep = this.scytheSweep;
    if (combat.chargingPrimary || attack?.shape === "line") {
      sweep.group.visible = false;
      this.syncStraightChargeLine(player, combat, attack);
      return;
    }
    this.straightChargeLine.group.visible = false;
    if (!attack) {
      sweep.group.visible = false;
      return;
    }

    const assistedArc = Math.min(FULL_CIRCLE, attack.arc + this.settings.get("gameplay.aimAssist") * 0.24);
    const heavy = combat.attackKind === "heavy" || attack.name === "Death's Orbit";
    const stage = combat.attackKind === "light" ? combat.comboIndex : -1;
    if (Math.abs(assistedArc - sweep.arc) > 0.0001 || heavy !== sweep.heavy || stage !== sweep.stage) {
      this.configureScytheSweep(assistedArc, heavy, stage);
    }

    const duration = Math.max(0.001, attack.duration);
    const activeStart = Math.max(0.001, attack.activeStart);
    const activeEnd = Math.max(activeStart + 0.001, attack.activeEnd);
    const time = clamp01(combat.attackTime / duration) * duration;
    const windup = clamp01(time / activeStart);
    const active = clamp01((time - activeStart) / (activeEnd - activeStart));
    const followThrough = clamp01((time - activeEnd) / Math.max(0.001, duration - activeEnd));
    const inActiveFrames = time >= activeStart && time <= activeEnd;
    const scythePose = samplePlayerScytheAnimation(attack, combat.attackTime, {
      attackKind: combat.attackKind,
      comboIndex: combat.comboIndex,
      arcOverride: assistedArc,
    });
    const sweepProgress = scythePose.sweepProgress;
    const swing = attack.swing ?? 1;
    const pulse = this.settings.get("camera.reducedMotion") ? 0 : Math.sin(combat.attackTime * 42);
    const flashScale = this.settings.get("accessibility.screenFlashes") ? 1 : 0.66;
    const contrastScale = this.settings.get("accessibility.highContrast") ? 1.22 : 1;

    sweep.group.visible = true;
    sweep.group.position.set(player.position.x, 0, player.position.z);
    const facing = Number.isFinite(combat.attackFacing) ? combat.attackFacing : player.aimAngle;
    sweep.group.rotation.y = -facing;
    const range = attack.range * player.reachMultiplier;
    sweep.group.scale.set(range, 1, range);

    const reveal = time < activeStart ? 0.015 : time <= activeEnd ? sweepProgress : 1;
    const availableIndices = sweep.activeTrail.geometry.index.count;
    const revealedIndices = Math.max(6, Math.floor((availableIndices * reveal) / 6) * 6);
    sweep.activeTrail.geometry.setDrawRange(0, Math.min(availableIndices, revealedIndices));
    sweep.activeTrail.scale.z = swing;

    const currentAngle = scythePose.sweepAngle;
    sweep.leadingBlade.rotation.y = currentAngle;
    sweep.movingGlow.position.x = Math.cos(currentAngle) * 0.985;
    sweep.movingGlow.position.z = -Math.sin(currentAngle) * 0.985;

    const windupFade = 0.42 + windup * 0.58;
    const followFade = 1 - followThrough;
    sweep.coverage.material.opacity = (inActiveFrames ? 0.13 + Math.sin(active * Math.PI) * 0.06 : 0.075 * windupFade) * contrastScale;
    sweep.innerRim.material.opacity = (inActiveFrames ? 0.72 : 0.28 + windup * 0.28) * followFade * flashScale;
    sweep.outerRim.material.opacity = (inActiveFrames ? 1 + pulse * 0.08 : 0.5 + windup * 0.34) * followFade * flashScale;
    sweep.activeTrail.material.opacity = (inActiveFrames ? 0.38 + Math.sin(active * Math.PI) * 0.13 : time > activeEnd ? 0.24 : 0.14) * followFade * flashScale;
    sweep.startRay.material.opacity = (0.24 + windup * 0.32) * followFade;
    sweep.endRay.material.opacity = (inActiveFrames ? 0.86 : 0.38 + windup * 0.22) * followFade * flashScale;
    sweep.leadingBlade.material.opacity = (inActiveFrames ? 0.98 : 0.42 + windup * 0.26) * followFade * flashScale;
    sweep.movingGlow.material.opacity = (inActiveFrames ? 1 : 0.45 + windup * 0.3) * followFade * flashScale;

    const impactPulse = inActiveFrames ? Math.sin(active * Math.PI) : 0;
    const queuedPulse = combat.queuedAttack ? 0.012 : 0;
    sweep.outerRim.scale.setScalar(1 + impactPulse * 0.012 + pulse * 0.002 + queuedPulse);
    sweep.leadingBlade.scale.set(1, 1, 0.8 + impactPulse * 0.65);
    sweep.movingGlow.scale.setScalar(0.8 + impactPulse * 0.85);
  }

  syncStraightChargeLine(player, combat, attack) {
    const line = this.straightChargeLine;
    const charging = combat.chargingPrimary && !attack;
    const rawRatio = charging
      ? clamp01(combat.primaryCharge / STRAIGHT_CHARGE_CONFIG.buildupDuration)
      : clamp01(attack?.chargeRatio ?? 1);
    const easedRatio = 1 - (1 - rawRatio) ** 3;
    const rangeScale = STRAIGHT_CHARGE_CONFIG.minimumRange
      + (1 - STRAIGHT_CHARGE_CONFIG.minimumRange) * easedRatio;
    const widthScale = STRAIGHT_CHARGE_CONFIG.minimumWidth
      + (1 - STRAIGHT_CHARGE_CONFIG.minimumWidth) * easedRatio;
    const range = (charging ? STRAIGHT_CHARGE_ATTACK.range * rangeScale : attack.range) * player.reachMultiplier;
    const width = charging ? STRAIGHT_CHARGE_ATTACK.width * widthScale : attack.width;
    const facing = charging
      ? player.aimAngle
      : Number.isFinite(combat.attackFacing) ? combat.attackFacing : player.aimAngle;
    const pulse = this.settings.get("camera.reducedMotion") ? 0 : Math.sin((combat.primaryCharge + combat.attackTime) * 32);
    const flashScale = this.settings.get("accessibility.screenFlashes") ? 1 : 0.66;
    const contrastScale = this.settings.get("accessibility.highContrast") ? 1.2 : 1;
    let reveal = 1;
    let fade = 1;
    let impact = 0;
    if (!charging) {
      const duration = Math.max(0.001, attack.duration);
      const activeStart = Math.max(0.001, attack.activeStart);
      const activeEnd = Math.max(activeStart + 0.001, attack.activeEnd);
      const time = clamp01(combat.attackTime / duration) * duration;
      const active = clamp01((time - activeStart) / (activeEnd - activeStart));
      const recovery = clamp01((time - activeEnd) / Math.max(0.001, duration - activeEnd));
      reveal = time < activeStart ? 0.015 : time <= activeEnd ? 1 - (1 - active) ** 3 : 1;
      fade = time > activeEnd ? 1 - recovery : 1;
      impact = time >= activeStart && time <= activeEnd ? Math.sin(active * Math.PI) : 0;
    }

    line.group.visible = true;
    line.group.position.set(player.position.x, 0, player.position.z);
    line.group.rotation.y = -facing;
    line.group.scale.set(range, 1, width);
    line.core.scale.x = Math.max(0.012, reveal);
    line.center.scale.x = Math.max(0.012, reveal);
    line.head.position.x = Math.max(0.012, reveal);
    line.head.scale.z = 0.82 + impact * 0.34;

    if (charging) {
      line.coverage.material.opacity = (0.07 + easedRatio * 0.08) * contrastScale;
      line.core.material.opacity = (0.12 + easedRatio * 0.28 + pulse * 0.025) * flashScale;
      line.center.material.opacity = (0.2 + easedRatio * 0.48 + pulse * 0.04) * flashScale;
      line.leftRail.material.opacity = (0.48 + easedRatio * 0.42 + pulse * 0.05) * flashScale;
      line.rightRail.material.opacity = line.leftRail.material.opacity;
      line.head.material.opacity = (0.7 + easedRatio * 0.28) * flashScale;
      return;
    }

    line.coverage.material.opacity = (0.12 + impact * 0.12) * fade * contrastScale;
    line.core.material.opacity = (0.3 + impact * 0.5) * fade * flashScale;
    line.center.material.opacity = (0.54 + impact * 0.44 + pulse * 0.04) * fade * flashScale;
    line.leftRail.material.opacity = (0.72 + impact * 0.26) * fade * flashScale;
    line.rightRail.material.opacity = line.leftRail.material.opacity;
    line.head.material.opacity = (0.82 + impact * 0.18) * fade * flashScale;
  }

  spawnRing(position, radius, color = 0xcf6de7, duration = 0.35) {
    const ring = this.rings.find((entry) => !entry.visible) ?? this.rings[0];
    ring.visible = true;
    ring.position.set(position.x, 0.08, position.z);
    ring.scale.setScalar(radius);
    ring.material.color.set(color);
    ring.material.opacity = 0.7;
    ring.userData.maxLife = duration;
    ring.userData.life = duration;
  }

  spawnTelegraph(detail) {
    const descriptors = detail?.type === "queen"
      ? queenTelegraphDescriptors(detail)
      : [detail];
    return descriptors.map((descriptor) => this.spawnTelegraphEntry(descriptor));
  }

  spawnTelegraphEntry(detail) {
    const entry = this.telegraphs.find((item) => !item.active) ?? this.telegraphs[0];
    const shape = detail.shape ?? "circle";
    const radius = Math.max(0.35, detail.radius ?? 2.2);
    const width = Math.max(0.3, detail.width ?? radius * 0.8);
    const direction = detail.direction ?? { x: 1, z: 0 };
    const target = shape === "blink" ? detail.target ?? detail.position : detail.position;
    const origin = detail.origin ?? detail.position;
    const descriptor = telegraphBatchDescriptor(detail);
    entry.active = true;
    entry.actionId = detail.actionId ?? null;
    entry.attack = detail.attack ?? detail.action ?? null;
    entry.telegraphRole = detail.telegraphRole ?? null;
    entry.key = descriptor.key;
    entry.angle = descriptor.angle;
    entry.life = Math.max(0.08, detail.duration ?? 0.42);
    entry.maxLife = entry.life;
    entry.rotationY = 0;
    entry.baseScaleX = 1;
    entry.baseScaleZ = 1;
    entry.color.set(telegraphColor(detail));
    this.getTelegraphBatch(entry.key, entry.angle);

    if (shape === "lane") {
      entry.position.set(origin.x + direction.x * radius * 0.5, 0, origin.z + direction.z * radius * 0.5);
      entry.rotationY = Math.atan2(direction.x, direction.z);
      entry.baseScaleX = width + 0.12;
      entry.baseScaleZ = radius + 0.12;
      return entry;
    }

    if (shape === "cone") {
      entry.position.set(origin.x, 0, origin.z);
      entry.rotationY = -Math.atan2(direction.z, direction.x);
      entry.baseScaleX = radius;
      entry.baseScaleZ = radius;
      return entry;
    }

    entry.position.set(target.x, 0, target.z);
    entry.baseScaleX = radius;
    entry.baseScaleZ = radius;
    return entry;
  }

  alignTelegraphAction(actionId, duration) {
    if (actionId == null || !Number.isFinite(duration)) return 0;
    let aligned = 0;
    for (const entry of this.telegraphs) {
      if (!entry.active || entry.actionId !== actionId) continue;
      entry.maxLife = Math.max(0.08, duration);
      entry.life = entry.maxLife;
      aligned += 1;
    }
    return aligned;
  }

  resolveTelegraphAction(actionId) {
    if (actionId == null) return 0;
    let resolved = 0;
    for (const entry of this.telegraphs) {
      if (!entry.active || entry.actionId !== actionId) continue;
      entry.active = false;
      resolved += 1;
    }
    return resolved;
  }

  spawnDashStreak(position, direction) {
    const streak = this.dashStreaks.find((entry) => !entry.visible) ?? this.dashStreaks[0];
    const length = 3.2;
    streak.visible = true;
    streak.position.set(position.x - direction.x * length * 0.32, 0.085, position.z - direction.z * length * 0.32);
    streak.rotation.y = Math.atan2(direction.x, direction.z);
    streak.scale.set(0.8, 1, length);
    streak.material.opacity = 0.56;
    streak.userData.life = streak.userData.maxLife;
  }

  spawnBurst(position, color, requestedCount = 12, force = 4.5) {
    const density = particleDensityForSettings(this.settings);
    let remaining = Math.max(1, Math.round(requestedCount * density));
    for (const particle of this.particles) {
      if (particle.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = force * (0.35 + Math.random() * 0.65);
      particle.active = true;
      particle.position.set(position.x, 0.4 + Math.random() * 0.8, position.z);
      particle.velocity.set(Math.cos(angle) * speed, 1.5 + Math.random() * 2.5, Math.sin(angle) * speed);
      particle.maxLife = 0.35 + Math.random() * 0.3;
      particle.life = particle.maxLife;
      particle.color.set(color);
      remaining -= 1;
      if (remaining <= 0) break;
    }
  }

  update(dt) {
    let activeIndex = 0;
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.velocity.y -= 7 * dt;
      particle.position.addScaledVector(particle.velocity, dt);
      const offset = activeIndex * 3;
      this.positions[offset] = particle.position.x;
      this.positions[offset + 1] = particle.position.y;
      this.positions[offset + 2] = particle.position.z;
      const life = particle.life / particle.maxLife;
      this.colors[offset] = particle.color.r * life;
      this.colors[offset + 1] = particle.color.g * life;
      this.colors[offset + 2] = particle.color.b * life;
      activeIndex += 1;
    }
    this.particleGeometry.setDrawRange(0, activeIndex);
    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.color.needsUpdate = true;

    for (const effect of this.rings) {
      if (!effect.visible) continue;
      effect.userData.life -= dt;
      const ratio = Math.max(0, effect.userData.life / effect.userData.maxLife);
      effect.material.opacity = ratio * 0.7;
      if (effect.userData.life <= 0) effect.visible = false;
      else effect.scale.multiplyScalar(1 + dt * (1.8 + ratio));
    }

    for (const entry of this.telegraphs) {
      if (!entry.active) continue;
      entry.life -= dt;
      if (entry.life <= 0) entry.active = false;
    }
    this.syncTelegraphBatches();

    for (const streak of this.dashStreaks) {
      if (!streak.visible) continue;
      streak.userData.life -= dt;
      const ratio = clamp01(streak.userData.life / streak.userData.maxLife);
      streak.material.opacity = ratio * 0.56;
      streak.scale.x = 0.8 + (1 - ratio) * 0.7;
      if (streak.userData.life <= 0) streak.visible = false;
    }
  }

  activeParticleCount() {
    return this.particles.reduce((count, particle) => count + Number(particle.active), 0);
  }

  syncTelegraphBatches() {
    for (const batch of this.telegraphBatches.values()) batch.count = 0;
    const reducedMotion = this.settings.get("camera.reducedMotion");
    for (const entry of this.telegraphs) {
      if (!entry.active) continue;
      const batch = this.getTelegraphBatch(entry.key, entry.angle);
      const index = batch.count;
      if (index >= TELEGRAPH_CAPACITY) continue;
      const ratio = clamp01(entry.life / entry.maxLife);
      const urgency = 1 - ratio;
      const pulse = reducedMotion ? 0 : Math.sin(urgency * Math.PI * 8) * 0.025;
      this.telegraphPosition.copy(entry.position);
      this.telegraphRotation.setFromAxisAngle(TELEGRAPH_UP, entry.rotationY);
      this.telegraphScale.set(
        entry.baseScaleX * (1 + pulse),
        1,
        entry.baseScaleZ * (1 + pulse),
      );
      this.telegraphMatrix.compose(this.telegraphPosition, this.telegraphRotation, this.telegraphScale);
      batch.mesh.setMatrixAt(index, this.telegraphMatrix);
      const tintOffset = index * 3;
      batch.tints[tintOffset] = entry.color.r;
      batch.tints[tintOffset + 1] = entry.color.g;
      batch.tints[tintOffset + 2] = entry.color.b;
      const styleOffset = index * 2;
      batch.styles[styleOffset] = urgency;
      batch.styles[styleOffset + 1] = ratio;
      batch.count += 1;
    }
    for (const batch of this.telegraphBatches.values()) {
      batch.mesh.count = batch.count;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.geometry.getAttribute("instanceTint").needsUpdate = true;
      batch.mesh.geometry.getAttribute("instanceStyle").needsUpdate = true;
    }
  }

  activeTelegraphCount() {
    return this.telegraphs.reduce((count, entry) => count + Number(entry.active), 0);
  }

  activeTelegraphCountForAction(actionId) {
    return this.telegraphs.reduce((count, entry) => (
      count + Number(entry.active && entry.actionId === actionId)
    ), 0);
  }

  activeTelegraphBatchCount() {
    return [...this.telegraphBatches.values()].reduce((count, batch) => count + Number(batch.mesh.count > 0), 0);
  }
}
