import * as THREE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { CAMERA_CONFIG, CHARGE_CONFIG, HEAVY_ATTACK, STRAIGHT_CHARGE_CONFIG } from "../game/gameConfig.js";
import { publicAssetUrl } from "../publicAssetUrl.js";
import { createScytheModel } from "./createScytheModel.js";
import { EnemyCharacterRenderer } from "./EnemyCharacterRenderer.js";
import { getEnemyVisualProfile } from "./enemyVisualProfiles.js";
import { PlayerActorPresentation } from "./playerActorPresentation.js";
import { samplePlayerScytheAnimation, sampleReapersClaimAnimation } from "./playerScytheAnimation.js";

const MAX_HEALTH_BARS = 385;
const BLADE_TRAIL_SAMPLES = 9;
const PLAYER_FORWARD_OFFSET = Math.PI / 2;
const PLAYER_WEAPON_SCALE = 0.86;
const PLAYER_POSE_BONES = Object.freeze([
  "hips",
  "spine",
  "chest",
  "head",
  "upperarm.l",
  "lowerarm.l",
  "upperarm.r",
  "lowerarm.r",
  "upperleg.l",
  "lowerleg.l",
  "upperleg.r",
  "lowerleg.r",
]);

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function interpolated(previous, current, alpha) {
  return previous + (current - previous) * alpha;
}

function configureAction(action, once) {
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = once;
}

function spriteFromCutout(texture, scale) {
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.035, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale.x, scale.y, 1);
  sprite.visible = false;
  return sprite;
}

export class ActorRenderer {
  constructor(scene, catalog) {
    this.scene = scene;
    this.catalog = catalog;
    this.actions = new Map();
    this.currentAction = null;
    this.animationStateKey = null;
    this.clockTime = 0;
    this.healthStates = new Map();
    this.healthSerial = 0;
    this.healthBarCount = 0;
    this.healthBarRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CAMERA_CONFIG.yaw);
    this.healthBarRightX = Math.cos(CAMERA_CONFIG.yaw);
    this.healthBarRightZ = -Math.sin(CAMERA_CONFIG.yaw);
    this.healthBarForwardX = Math.sin(CAMERA_CONFIG.yaw);
    this.healthBarForwardZ = Math.cos(CAMERA_CONFIG.yaw);
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.playerPresentation = new PlayerActorPresentation();
    this.playerPose = null;
    this.playerPoseBones = new Map();
    this.playerPoseEuler = new THREE.Euler();
    this.playerPoseQuaternion = new THREE.Quaternion();
    this.playerPoseApplied = false;
  }

  async initialize() {
    const [knight, princessTexture] = await Promise.all([
      this.catalog.loadCharacter("knight"),
      this.catalog.loadTexture(publicAssetUrl("assets/vn/characters/elowen-a-human.png")),
    ]);
    this.createPlayer(knight);
    this.enemyRenderer = new EnemyCharacterRenderer(this.scene, this.catalog);
    await this.enemyRenderer.initialize();
    this.createHealthBars();
    this.princess = spriteFromCutout(princessTexture, { x: 3.8, y: 5.7 });
    this.scene.add(this.princess);
  }

  createPlayer(gltf) {
    this.playerGroup = new THREE.Group();
    this.playerGroup.name = "player-actor";
    this.playerModel = cloneSkeleton(gltf.scene);
    this.playerModel.scale.setScalar(0.72);
    for (const weaponName of ["1H_Sword", "1H_Sword_Offhand"]) {
      const weapon = this.playerModel.getObjectByName(weaponName);
      if (weapon) weapon.visible = false;
    }
    this.playerModel.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.playerModel);
    this.playerModel.position.y = -box.min.y;
    this.playerModel.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = false;
    });
    this.playerGroup.add(this.playerModel);

    this.weaponGrip = new THREE.Group();
    this.weaponGrip.name = "ScytheGripPivot";
    this.scythe = createScytheModel();
    this.weaponGrip.add(this.scythe);
    this.weaponGrip.scale.setScalar(PLAYER_WEAPON_SCALE);
    const handSlot = this.playerModel.getObjectByName("handslot.r");
    if (handSlot) {
      this.weaponGrip.rotation.set(0, Math.PI, 0);
      handSlot.add(this.weaponGrip);
      this.weaponParent = handSlot;
    } else {
      this.weaponGrip.position.set(0.42, 1.05, 0);
      this.playerGroup.add(this.weaponGrip);
      this.weaponParent = this.playerGroup;
    }
    this.weaponBaseQuaternion = this.weaponGrip.quaternion.clone();
    this.weaponHomeParent = this.weaponParent;
    this.weaponHomePosition = this.weaponGrip.position.clone();
    this.weaponHomeQuaternion = this.weaponGrip.quaternion.clone();
    this.weaponHomeScale = this.weaponGrip.scale.clone();
    this.playerModelHomeQuaternion = this.playerModel.quaternion.clone();
    for (const boneName of PLAYER_POSE_BONES) {
      const object = this.playerModel.getObjectByName(boneName);
      if (!object) continue;
      this.playerPoseBones.set(boneName, {
        object,
        baseQuaternion: new THREE.Quaternion(),
        captured: false,
      });
    }
    this.claimBodyLeanAxis = new THREE.Vector3(1, 0, 0);
    this.claimBodyLeanQuaternion = new THREE.Quaternion();
    this.claimWeaponEuler = new THREE.Euler();
    this.claimWeaponQuaternion = new THREE.Quaternion();
    this.claimPose = null;
    this.claimSnapshotCurrent = null;
    this.claimPresentationActive = false;
    this.claimBodyLeanApplied = false;
    this.claimSampleOptions = { reducedMotion: false, spinningClip: "2H_Melee_Attack_Spinning" };
    this.bladeHeel = this.scythe.getObjectByName("ScytheBladeHeel");
    this.bladeTip = this.scythe.getObjectByName("ScytheBladeTip");
    this.weaponSourceDirection = this.bladeTip.position.clone().normalize();
    this.weaponSourceNormal = new THREE.Vector3(0, 0, 1);
    this.weaponSourceThird = new THREE.Vector3().crossVectors(this.weaponSourceDirection, this.weaponSourceNormal).normalize();
    this.weaponSourceBasisInverse = new THREE.Matrix4()
      .makeBasis(this.weaponSourceDirection, this.weaponSourceNormal, this.weaponSourceThird)
      .invert();
    this.weaponTargetDirection = new THREE.Vector3();
    this.weaponTargetNormal = new THREE.Vector3();
    this.weaponTargetThird = new THREE.Vector3();
    this.weaponWorldUp = new THREE.Vector3(0, 1, 0);
    this.weaponTargetBasis = new THREE.Matrix4();
    this.weaponTargetMatrix = new THREE.Matrix4();
    this.weaponTargetWorldQuaternion = new THREE.Quaternion();
    this.weaponParentWorldQuaternion = new THREE.Quaternion();
    this.weaponTargetLocalQuaternion = new THREE.Quaternion();
    this.weaponChargeQuaternion = new THREE.Quaternion();
    this.weaponChargeEuler = new THREE.Euler();

    this.scene.add(this.playerGroup);
    this.mixer = new THREE.AnimationMixer(this.playerModel);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.playAnimation("Idle", false, 0, null, "idle");
    this.createChargeAura();
    this.createBladeTrail();
  }

  createBladeTrail() {
    this.bladeTrailPositions = new Float32Array(BLADE_TRAIL_SAMPLES * 2 * 3);
    const indices = [];
    for (let index = 0; index < BLADE_TRAIL_SAMPLES - 1; index += 1) {
      const heel = index * 2;
      const tip = heel + 1;
      const nextHeel = heel + 2;
      const nextTip = heel + 3;
      indices.push(heel, tip, nextTip, heel, nextTip, nextHeel);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.bladeTrailPositions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    geometry.setDrawRange(0, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0xbfeeff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.bladeTrail = new THREE.Mesh(geometry, material);
    this.bladeTrail.name = "ScytheBladeTrail";
    this.bladeTrail.frustumCulled = false;
    this.bladeTrail.renderOrder = 10;
    this.bladeTrail.visible = false;
    this.scene.add(this.bladeTrail);
    this.bladeTrailSamples = Array.from({ length: BLADE_TRAIL_SAMPLES }, () => ({
      heel: new THREE.Vector3(),
      tip: new THREE.Vector3(),
    }));
    this.bladeTrailCount = 0;
    this.bladeTrailAttackKey = null;
    this.bladeTrailClaimActionId = null;
    this.bladeTrailClaimPhase = null;
    this.lastBladeTrailAttackTime = 0;
    this.bladeHeelWorld = new THREE.Vector3();
    this.bladeTipWorld = new THREE.Vector3();
  }

  createChargeAura() {
    this.chargeAura = new THREE.Group();
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0x78d7f4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const rimMaterial = fillMaterial.clone();
    rimMaterial.color.set(0xf3d58a);
    const fillGeometry = new THREE.RingGeometry(0.16, 1, 72);
    const rimGeometry = new THREE.RingGeometry(0.95, 1, 72);
    fillGeometry.rotateX(-Math.PI / 2);
    rimGeometry.rotateX(-Math.PI / 2);
    this.chargeFill = new THREE.Mesh(fillGeometry, fillMaterial);
    this.chargeRim = new THREE.Mesh(rimGeometry, rimMaterial);
    this.chargeFill.position.y = 0.055;
    this.chargeRim.position.y = 0.075;
    this.chargeAura.add(this.chargeFill, this.chargeRim);
    this.chargeAura.visible = false;
    this.scene.add(this.chargeAura);
  }

  createHealthBars() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x160f18,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0xff263f,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xd9a85f,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.healthBarBackgrounds = new THREE.InstancedMesh(geometry, backgroundMaterial, MAX_HEALTH_BARS);
    this.healthBarTrails = new THREE.InstancedMesh(geometry, trailMaterial, MAX_HEALTH_BARS);
    this.healthBarFills = new THREE.InstancedMesh(geometry, fillMaterial, MAX_HEALTH_BARS);
    for (const mesh of [this.healthBarBackgrounds, this.healthBarTrails, this.healthBarFills]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    this.healthBarBackgrounds.renderOrder = 20;
    this.healthBarTrails.renderOrder = 21;
    this.healthBarFills.renderOrder = 22;
    this.scene.add(this.healthBarBackgrounds, this.healthBarTrails, this.healthBarFills);
  }

  sync(game, alpha, dt) {
    if (!this.playerGroup) return;
    if (!game.player) {
      this.clearClaimPresentation();
      return;
    }
    this.clockTime += dt;
    this.restorePlayerActorPose();
    const playerX = interpolated(game.player.previousPosition.x, game.player.position.x, alpha);
    const playerZ = interpolated(game.player.previousPosition.z, game.player.position.z, alpha);
    this.playerGroup.position.set(playerX, 0, playerZ);
    this.sampleClaimPresentation(game, alpha);
    this.playerPose = this.claimPose ? null : this.playerPresentation.sample(game, dt);
    const facing = this.claimPose
      ? this.claimPose.bodyYaw
      : game.combat.attack && Number.isFinite(game.combat.attackFacing)
      ? game.combat.attackFacing
      : game.player.aimAngle;
    this.playerGroup.rotation.y = PLAYER_FORWARD_OFFSET - facing;
    this.syncPlayerAnimation(game, dt);
    this.syncWeaponPose(game);
    this.syncCharge(game, playerX, playerZ);
    this.enemyRenderer.sync(game.director.enemies, alpha, dt, {
      allowProxies: game.benchmarkMode === true,
    });
    this.syncHealthBars(game.director.enemies, alpha, dt);
    this.syncEndingActor(game);
  }

  sampleClaimPresentation(game, alpha) {
    const snapshots = game.claimSnapshots;
    const fallback = snapshots?.current ? null : game.combat?.claim?.snapshot?.();
    const current = snapshots?.current ?? fallback;
    const previous = snapshots?.previous ?? current;
    const endingActive = game.endingPresentationStage && game.endingPresentationStage !== "inactive";
    const phase = String(game.phase ?? "");
    const forcedRestore = phase === "dead"
      || phase === "portalTraversal"
      || phase === "roomTransition"
      || phase === "roomLoading"
      || phase.startsWith("ending")
      || endingActive;
    if (!current || current.phase === "idle" || current.actionId == null || forcedRestore) {
      this.clearClaimPresentation();
      return;
    }
    this.claimSampleOptions.reducedMotion = game.settings?.get?.("camera.reducedMotion") === true;
    this.claimSampleOptions.spinningClip = this.actions.has("2H_Melee_Attack_Spinning") ? "2H_Melee_Attack_Spinning" : "Spin";
    this.claimPose = sampleReapersClaimAnimation(previous, current, alpha, this.claimSampleOptions);
    this.claimSnapshotCurrent = current;
    this.claimPresentationActive = true;
  }

  clearClaimPresentation() {
    const wasActive = this.claimPresentationActive;
    this.claimPresentationActive = false;
    this.claimPose = null;
    this.claimSnapshotCurrent = null;
    if (!wasActive) return;
    this.restoreClaimWeapon();
    this.resetClaimBodyLean();
    if (this.currentAction?.paused) this.currentAction.paused = false;
    this.resetBladeTrail();
  }

  syncPlayerAnimation(game, dt) {
    let clip = "Idle";
    let once = false;
    let desiredDuration = null;
    let stateKey = "idle";
    let direction = 1;
    if (!this.claimPose && this.currentAction?.paused) this.currentAction.paused = false;
    let clipProgress = null;
    if (game.phase === "portalTraversal") {
      clip = "Dodge_Forward";
      once = true;
      desiredDuration = game.portalTraversal?.duration ?? 0.82;
      stateKey = "portalTraversal";
    } else if (this.claimPose) {
      clip = this.claimPose.bodyClip;
      once = !this.claimPose.bodyClipLoop;
      stateKey = `claim:${this.claimPose.actionId}:${this.claimPose.phase}`;
    } else if (this.playerPose) {
      clip = this.playerPose.clip;
      once = this.playerPose.once;
      desiredDuration = this.playerPose.duration;
      stateKey = this.playerPose.stateKey;
      clipProgress = this.playerPose.clipProgress;
      direction = game.combat.attack && game.combat.attackKind === "light"
        ? Math.sign(game.combat.attack.swing ?? 1) || 1
        : 1;
    }
    this.playAnimation(clip, once, 0.055, desiredDuration, stateKey, direction);
    if (this.claimPose && this.currentAction) {
      const clipDuration = this.currentAction.getClip().duration;
      this.currentAction.paused = true;
      this.currentAction.time = clipDuration * this.claimPose.bodyClipProgress;
      this.mixer.update(dt);
    } else if (Number.isFinite(clipProgress) && this.currentAction) {
      const clipDuration = this.currentAction.getClip().duration;
      this.currentAction.paused = true;
      this.currentAction.time = clipDuration * clipProgress;
      this.mixer.update(0);
    } else {
      if (this.currentAction?.paused) this.currentAction.paused = false;
      this.mixer.update(dt);
    }
    if (!this.claimPose && this.playerPose) this.applyPlayerActorPose(this.playerPose);
  }

  restorePlayerActorPose() {
    if (!this.playerPoseApplied) return;
    for (const record of this.playerPoseBones.values()) {
      if (!record.captured) continue;
      record.object.quaternion.copy(record.baseQuaternion);
      record.captured = false;
    }
    this.playerModel.quaternion.copy(this.playerModelHomeQuaternion);
    this.playerPoseApplied = false;
  }

  applyPlayerActorPose(pose) {
    const model = pose.model;
    this.playerPoseEuler.set(model.x, model.y, model.z);
    this.playerPoseQuaternion.setFromEuler(this.playerPoseEuler);
    this.playerModel.quaternion.copy(this.playerModelHomeQuaternion).multiply(this.playerPoseQuaternion);
    for (const [boneName, rotation] of Object.entries(pose.bones)) {
      const record = this.playerPoseBones.get(boneName);
      if (!record) continue;
      record.baseQuaternion.copy(record.object.quaternion);
      record.captured = true;
      this.playerPoseEuler.set(rotation.x, rotation.y, rotation.z);
      this.playerPoseQuaternion.setFromEuler(this.playerPoseEuler);
      record.object.quaternion.multiply(this.playerPoseQuaternion);
    }
    this.playerPoseApplied = true;
  }

  playAnimation(name, once, fade = 0.08, desiredDuration = null, stateKey = name, direction = 1) {
    const action = this.actions.get(name) ?? this.actions.values().next().value;
    if (!action || stateKey === this.animationStateKey) return;
    configureAction(action, once);
    const clipDuration = action.getClip().duration;
    const speed = desiredDuration ? clipDuration / Math.max(0.05, desiredDuration) : 1;
    action.setEffectiveTimeScale(speed * direction);
    action.reset();
    if (direction < 0) action.time = clipDuration;
    action.fadeIn(fade).play();
    if (this.currentAction && this.currentAction !== action) this.currentAction.fadeOut(fade);
    this.currentAction = action;
    this.animationStateKey = stateKey;
  }

  syncWeaponPose(game) {
    if (this.claimPose) {
      this.syncClaimWeapon();
      this.playerGroup.updateMatrixWorld(true);
      this.syncBladeTrail(game, null, this.claimPose);
      return;
    }
    this.restoreClaimWeapon();
    this.resetClaimBodyLean();
    const attack = game.combat.attack;
    let scale = PLAYER_WEAPON_SCALE;
    let pose = null;
    if (attack) {
      pose = samplePlayerScytheAnimation(attack, game.combat.attackTime, {
        attackKind: game.combat.attackKind,
        comboIndex: game.combat.comboIndex,
      });
      scale *= pose.scaleMultiplier;
      this.applyScytheSlicePose(game, pose);
    } else if (game.combat.chargingPrimary) {
      const charge = clamp01(game.combat.primaryCharge / STRAIGHT_CHARGE_CONFIG.buildupDuration);
      const settle = charge * charge * (3 - 2 * charge);
      const chargePose = {
        sweepAngle: 0,
        bladeLift: 0.32 + settle * 0.4 + Math.sin(this.clockTime * 9) * 0.018 * charge,
        poseWeight: Math.min(1, 0.55 + settle * 0.45),
      };
      this.applyScytheSlicePose(game, chargePose);
      scale *= 1.05 + settle * 0.14;
    } else if (game.combat.chargingHeavy) {
      const charge = clamp01(game.combat.heavyCharge / CHARGE_CONFIG.timing.forcedRelease);
      this.weaponChargeEuler.set(0, 0, Math.sin(this.clockTime * 5.5) * 0.025 * charge);
      this.weaponChargeQuaternion.setFromEuler(this.weaponChargeEuler);
      this.weaponGrip.quaternion.copy(this.weaponBaseQuaternion).multiply(this.weaponChargeQuaternion);
      scale *= 1 + charge * 0.045;
    } else {
      this.weaponGrip.quaternion.copy(this.weaponBaseQuaternion);
    }
    this.weaponGrip.scale.setScalar(scale);
    this.playerGroup.updateMatrixWorld(true);
    this.syncBladeTrail(game, pose, null);
  }

  setClaimWeaponDetached(detached) {
    if (detached) {
      if (this.weaponGrip.parent !== this.scene) this.scene.attach(this.weaponGrip);
      return;
    }
    this.restoreClaimWeapon();
  }

  restoreClaimWeapon() {
    if (!this.weaponGrip || !this.weaponHomeParent) return;
    if (this.weaponGrip.parent !== this.weaponHomeParent) this.weaponHomeParent.attach(this.weaponGrip);
    this.weaponGrip.position.copy(this.weaponHomePosition);
    this.weaponGrip.quaternion.copy(this.weaponHomeQuaternion);
    this.weaponGrip.scale.copy(this.weaponHomeScale);
  }

  syncClaimWeapon() {
    const pose = this.claimPose;
    this.setClaimWeaponDetached(pose.weaponDetached);
    this.claimBodyLeanQuaternion.setFromAxisAngle(this.claimBodyLeanAxis, pose.bodyLean);
    this.playerModel.quaternion.copy(this.playerModelHomeQuaternion).multiply(this.claimBodyLeanQuaternion);
    this.claimBodyLeanApplied = true;
    if (pose.weaponDetached) {
      this.weaponGrip.position.set(pose.weaponPosition.x, pose.weaponHeight, pose.weaponPosition.z);
      this.claimWeaponEuler.set(0, PLAYER_FORWARD_OFFSET - pose.bodyYaw, pose.weaponSpin);
      this.weaponGrip.quaternion.setFromEuler(this.claimWeaponEuler);
    } else {
      this.weaponGrip.position.y += pose.weaponHeight - 1.16;
      this.claimWeaponEuler.set(0, 0, pose.weaponSpin);
      this.claimWeaponQuaternion.setFromEuler(this.claimWeaponEuler);
      this.weaponGrip.quaternion.multiply(this.claimWeaponQuaternion);
    }
    this.weaponGrip.updateMatrixWorld(true);
  }

  resetClaimBodyLean() {
    if (!this.claimBodyLeanApplied) return;
    this.playerModel.quaternion.copy(this.playerModelHomeQuaternion);
    this.claimBodyLeanApplied = false;
  }

  applyScytheSlicePose(game, pose) {
    this.playerGroup.updateMatrixWorld(true);
    const facing = Number.isFinite(game.combat.attackFacing) ? game.combat.attackFacing : game.player.aimAngle;
    const worldAngle = facing - pose.sweepAngle;
    this.weaponTargetDirection.set(Math.cos(worldAngle), pose.bladeLift, Math.sin(worldAngle)).normalize();
    this.weaponTargetNormal.copy(this.weaponWorldUp)
      .addScaledVector(this.weaponTargetDirection, -this.weaponWorldUp.dot(this.weaponTargetDirection))
      .normalize();
    this.weaponTargetThird.crossVectors(this.weaponTargetDirection, this.weaponTargetNormal).normalize();
    this.weaponTargetBasis.makeBasis(this.weaponTargetDirection, this.weaponTargetNormal, this.weaponTargetThird);
    this.weaponTargetMatrix.multiplyMatrices(this.weaponTargetBasis, this.weaponSourceBasisInverse);
    this.weaponTargetWorldQuaternion.setFromRotationMatrix(this.weaponTargetMatrix);
    this.weaponParent.getWorldQuaternion(this.weaponParentWorldQuaternion).invert();
    this.weaponTargetLocalQuaternion.multiplyQuaternions(
      this.weaponParentWorldQuaternion,
      this.weaponTargetWorldQuaternion,
    );
    this.weaponGrip.quaternion.copy(this.weaponBaseQuaternion).slerp(this.weaponTargetLocalQuaternion, pose.poseWeight);
  }

  syncBladeTrail(game, pose, claimPose = null) {
    if (claimPose) {
      const snapshot = this.claimSnapshotCurrent;
      if (snapshot.actionId !== this.bladeTrailClaimActionId || snapshot.phase !== this.bladeTrailClaimPhase || snapshot.elapsed < this.lastBladeTrailAttackTime) {
        this.resetBladeTrail();
        this.bladeTrailClaimActionId = snapshot.actionId;
        this.bladeTrailClaimPhase = snapshot.phase;
      }
      this.lastBladeTrailAttackTime = snapshot.elapsed;
      if (claimPose.trailStrength <= 0) {
        this.bladeTrail.visible = false;
        return;
      }
      this.bladeHeel.getWorldPosition(this.bladeHeelWorld);
      this.bladeTip.getWorldPosition(this.bladeTipWorld);
      const newest = this.bladeTrailCount > 0 ? this.bladeTrailSamples[this.bladeTrailCount - 1] : null;
      if (!newest || newest.tip.distanceToSquared(this.bladeTipWorld) > 0.0009) {
        this.appendBladeTrailSample(this.bladeHeelWorld, this.bladeTipWorld);
      } else {
        newest.heel.copy(this.bladeHeelWorld);
        newest.tip.copy(this.bladeTipWorld);
      }
      this.writeBladeTrail(claimPose.trailStrength, claimPose.phase === "empoweredCleave");
      return;
    }
    const attack = game.combat.attack;
    if (!attack || !pose || pose.trailStrength <= 0) {
      this.bladeTrail.visible = false;
      if (!attack) this.resetBladeTrail();
      return;
    }

    const attackKey = `${attack.name}:${game.combat.attackKind}:${game.combat.comboIndex}`;
    if (attackKey !== this.bladeTrailAttackKey || game.combat.attackTime < this.lastBladeTrailAttackTime) {
      this.resetBladeTrail();
      this.bladeTrailAttackKey = attackKey;
    }
    this.lastBladeTrailAttackTime = game.combat.attackTime;
    this.bladeHeel.getWorldPosition(this.bladeHeelWorld);
    this.bladeTip.getWorldPosition(this.bladeTipWorld);

    const newest = this.bladeTrailCount > 0 ? this.bladeTrailSamples[this.bladeTrailCount - 1] : null;
    if (!newest || newest.tip.distanceToSquared(this.bladeTipWorld) > 0.0009) {
      this.appendBladeTrailSample(this.bladeHeelWorld, this.bladeTipWorld);
    } else {
      newest.heel.copy(this.bladeHeelWorld);
      newest.tip.copy(this.bladeTipWorld);
    }
    this.writeBladeTrail(pose.trailStrength, game.combat.comboIndex === 2 || game.combat.attackKind === "heavy");
  }

  appendBladeTrailSample(heel, tip) {
    if (this.bladeTrailCount === BLADE_TRAIL_SAMPLES) {
      for (let index = 1; index < BLADE_TRAIL_SAMPLES; index += 1) {
        this.bladeTrailSamples[index - 1].heel.copy(this.bladeTrailSamples[index].heel);
        this.bladeTrailSamples[index - 1].tip.copy(this.bladeTrailSamples[index].tip);
      }
      this.bladeTrailCount -= 1;
    }
    const sample = this.bladeTrailSamples[this.bladeTrailCount];
    sample.heel.copy(heel);
    sample.tip.copy(tip);
    this.bladeTrailCount += 1;
  }

  writeBladeTrail(strength, emphasized) {
    for (let index = 0; index < this.bladeTrailCount; index += 1) {
      const sample = this.bladeTrailSamples[index];
      const offset = index * 6;
      this.bladeTrailPositions[offset] = sample.heel.x;
      this.bladeTrailPositions[offset + 1] = sample.heel.y;
      this.bladeTrailPositions[offset + 2] = sample.heel.z;
      this.bladeTrailPositions[offset + 3] = sample.tip.x;
      this.bladeTrailPositions[offset + 4] = sample.tip.y;
      this.bladeTrailPositions[offset + 5] = sample.tip.z;
    }
    this.bladeTrail.geometry.setDrawRange(0, Math.max(0, this.bladeTrailCount - 1) * 6);
    this.bladeTrail.geometry.attributes.position.needsUpdate = true;
    this.bladeTrail.material.color.set(emphasized ? 0xffe6a8 : 0xbfeeff);
    this.bladeTrail.material.opacity = (emphasized ? 0.58 : 0.42) * strength;
    this.bladeTrail.visible = this.bladeTrailCount > 1;
  }

  resetBladeTrail() {
    this.bladeTrailCount = 0;
    this.bladeTrailAttackKey = null;
    this.bladeTrailClaimActionId = null;
    this.bladeTrailClaimPhase = null;
    this.lastBladeTrailAttackTime = 0;
    if (this.bladeTrail) {
      this.bladeTrail.visible = false;
      this.bladeTrail.geometry.setDrawRange(0, 0);
    }
  }

  syncCharge(game, x, z) {
    const chargingHeavy = game.combat.chargingHeavy;
    const chargingPrimary = game.combat.chargingPrimary;
    const charging = chargingHeavy || chargingPrimary;
    this.chargeAura.visible = chargingHeavy;
    const blade = this.scythe.getObjectByName("ScytheBlade");
    if (!charging) {
      if (blade?.material) blade.material.emissiveIntensity = 0.42;
      return;
    }
    const ratio = chargingHeavy
      ? clamp01(game.combat.heavyCharge / CHARGE_CONFIG.timing.forcedRelease)
      : clamp01(game.combat.primaryCharge / STRAIGHT_CHARGE_CONFIG.buildupDuration);
    const range = HEAVY_ATTACK.range * game.player.reachMultiplier * (0.9 + ratio * 0.22);
    const pulse = Math.sin(this.clockTime * (12 + ratio * 8));
    if (chargingHeavy) {
      this.chargeAura.position.set(x, 0, z);
      this.chargeAura.scale.set(range, 1, range);
      this.chargeFill.material.opacity = 0.045 + ratio * 0.1 + pulse * 0.012;
      this.chargeRim.material.opacity = 0.38 + ratio * 0.48 + pulse * 0.08;
      this.chargeRim.scale.setScalar(0.985 + pulse * 0.015);
    }
    if (blade?.material) blade.material.emissiveIntensity = 0.42 + ratio * 2.4;
  }

  syncHealthBars(enemies, alpha, dt) {
    this.healthSerial += 1;
    this.healthBarCount = 0;
    for (const enemy of enemies) {
      if (!enemy.active || this.healthBarCount >= MAX_HEALTH_BARS) continue;
      let state = this.healthStates.get(enemy.id);
      const ratio = clamp01(enemy.health / Math.max(1, enemy.maxHealth));
      if (!state) {
        state = { displayRatio: ratio, seenAt: this.healthSerial };
        this.healthStates.set(enemy.id, state);
      }
      state.seenAt = this.healthSerial;
      if (ratio >= state.displayRatio) state.displayRatio = ratio;
      else state.displayRatio += (ratio - state.displayRatio) * Math.min(1, dt * 6.5);
      const profile = getEnemyVisualProfile(enemy.type);
      const x = interpolated(enemy.previousPosition.x, enemy.position.x, alpha);
      const z = interpolated(enemy.previousPosition.z, enemy.position.z, alpha);
      const visualHeight = Math.max(profile.healthBar.height, this.enemyRenderer.actorHeight(enemy.id));
      this.writeHealthBar(
        x,
        z,
        visualHeight + 0.32,
        profile.healthBar.width,
        enemy.type === "queen" ? 0.34 : 0.24,
        ratio,
        state.displayRatio,
      );
    }
    for (const [id, state] of this.healthStates) {
      if (state.seenAt !== this.healthSerial) this.healthStates.delete(id);
    }
    this.healthBarBackgrounds.count = this.healthBarCount;
    this.healthBarTrails.count = this.healthBarCount;
    this.healthBarFills.count = this.healthBarCount;
    this.healthBarBackgrounds.instanceMatrix.needsUpdate = true;
    this.healthBarTrails.instanceMatrix.needsUpdate = true;
    this.healthBarFills.instanceMatrix.needsUpdate = true;
  }

  writeHealthBar(x, z, y, width, height, healthRatio, trailRatio = healthRatio) {
    const index = this.healthBarCount;
    const inset = 0.07;
    const innerWidth = Math.max(0.01, width - inset * 2);
    const fillWidth = Math.max(0.015, innerWidth * healthRatio);
    const fillOffset = (fillWidth - innerWidth) * 0.5;
    const trailWidth = Math.max(0.015, innerWidth * trailRatio);
    const trailOffset = (trailWidth - innerWidth) * 0.5;
    this.position.set(x, y, z);
    this.scale.set(width, height, 1);
    this.matrix.compose(this.position, this.healthBarRotation, this.scale);
    this.healthBarBackgrounds.setMatrixAt(index, this.matrix);
    this.position.set(
      x + this.healthBarRightX * trailOffset + this.healthBarForwardX * 0.012,
      y,
      z + this.healthBarRightZ * trailOffset + this.healthBarForwardZ * 0.012,
    );
    this.scale.set(trailWidth, Math.max(0.04, height - inset * 0.9), 1);
    this.matrix.compose(this.position, this.healthBarRotation, this.scale);
    this.healthBarTrails.setMatrixAt(index, this.matrix);
    this.position.set(
      x + this.healthBarRightX * fillOffset + this.healthBarForwardX * 0.024,
      y,
      z + this.healthBarRightZ * fillOffset + this.healthBarForwardZ * 0.024,
    );
    this.scale.set(fillWidth, Math.max(0.04, height - inset * 0.9), 1);
    this.matrix.compose(this.position, this.healthBarRotation, this.scale);
    this.healthBarFills.setMatrixAt(index, this.matrix);
    this.healthBarCount += 1;
  }

  syncEndingActor(game) {
    const stage = game.endingPresentationStage;
    this.princess.visible = !["inactive", "witchDeath", "complete"].includes(stage);
    if (!this.princess.visible) return;
    this.princess.position.set(2.5, 2.7, 2.1);
    const corrupt = stage === "revealCorrupted" || stage === "timeout" || (
      stage === "fade" && game.ending.snapshot().result?.id === "timeout"
    );
    this.princess.material.color.set(corrupt ? 0xd17491 : 0xffffff);
    const fadeProgress = game.ending.snapshot().fade?.progress ?? 0;
    this.princess.material.opacity = 1 - fadeProgress;
  }

  handleEvent(event) {
    this.playerPresentation.handleEvent(event);
    this.enemyRenderer?.handleEvent(event);
  }

  metrics() {
    return this.enemyRenderer?.metrics() ?? { activeActors: 0, activeMixers: 0, skinnedMeshes: 0, pooledActors: 0 };
  }
}
