import { BLESSINGS, BLESSING_FALLBACK, chooseBlessings } from "./blessings.js";
import { BookendSequence } from "./BookendSequence.js";
import { circleIntersectsArc, circleIntersectsLine, moveCircleDetailed, SpatialHash } from "./collision.js";
import { EndingSequence } from "./EndingSequence.js";
import { EnemyDirector } from "./EnemyDirector.js";
import {
  CAMERA_CONFIG,
  DASH_ATTACK,
  DEFAULT_RUN_TYPE,
  DIFFICULTY,
  HARVEST_CONFIG,
  HIT_STOP_CONFIG,
  ENDING_TIMING,
  PLAYER_CONFIG,
  PORTAL_CONFIG,
  PROGRESSION_TRANSFORMATION_CONFIG,
  RUN_CONFIG,
  RUN_TYPE_IDS,
  SCYTHE_ATTACKS,
} from "./gameConfig.js";
import { HitStopClock } from "./HitStopClock.js";
import { PlayerCombat } from "./PlayerCombat.js";
import {
  applyRunUpgrade,
  CHAMBER_FALLBACK,
  isUpgradeEligible,
  offerUpgradeChoices,
  RUN_UPGRADES,
  summarizeUpgradePaths,
} from "./runUpgrades.js";
import { progressionCardSnapshot } from "./progressionModel.js";
import { generateArena } from "../generation/arenaGenerator.js";
import { createRunSeed, SeededRandom } from "../generation/seededRandom.js";

const NORMAL_ATTACK_POISE = Object.freeze({ damageScale: 0.55, minimum: 12, maximum: 40 });
const ACTION_CLEAR_PHASES = new Set([
  "dead",
  "victory",
  "title",
  "portalTraversal",
  "bookend",
  "endingChoice",
  "endingStrike",
  "endingFade",
  "endingComplete",
]);

function clonePosition(position) {
  return { x: position.x, z: position.z };
}

function immutableValue(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(immutableValue));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, immutableValue(entry)])));
}

function normalizedDirection(from, to, fallback = { x: 0, z: 0 }) {
  const x = to.x - from.x;
  const z = to.z - from.z;
  const length = Math.hypot(x, z);
  if (length <= 0.0001) return Object.freeze({ ...fallback });
  return Object.freeze({ x: x / length, z: z / length });
}

function publicUpgradeChoice(choice) {
  return progressionCardSnapshot(choice);
}

function cameraRelativeMovement(movement) {
  const sinYaw = Math.sin(CAMERA_CONFIG.yaw);
  const cosYaw = Math.cos(CAMERA_CONFIG.yaw);
  return {
    x: movement.x * sinYaw - movement.y * cosYaw,
    y: -movement.x * cosYaw - movement.y * sinYaw,
  };
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function easeInCubic(value) {
  return value ** 3;
}

function portalVisualHeight(progress) {
  if (progress <= PORTAL_CONFIG.launchPeakAt) {
    return easeOutCubic(progress / PORTAL_CONFIG.launchPeakAt) * PORTAL_CONFIG.launchHeight;
  }
  const fallProgress = (progress - PORTAL_CONFIG.launchPeakAt) / (1 - PORTAL_CONFIG.launchPeakAt);
  return PORTAL_CONFIG.launchHeight - easeInCubic(fallProgress) * (PORTAL_CONFIG.launchHeight + PORTAL_CONFIG.fallDepth);
}

export class Game {
  constructor(input, settings, { requireRoomReady = false } = {}) {
    this.input = input;
    this.settings = settings;
    this.listeners = new Set();
    this.bookend = new BookendSequence();
    this.activeBookend = null;
    this.bookendOnComplete = null;
    this.combat = new PlayerCombat((type, detail) => this.handleCombatEvent(type, detail));
    this.hitStop = new HitStopClock();
    this.director = new EnemyDirector((type, detail) => this.handleDirectorEvent(type, detail));
    const initialClaimSnapshot = this.combat.claim.snapshot();
    this.claimSnapshots = Object.freeze({ previous: initialClaimSnapshot, current: initialClaimSnapshot });
    this.claimOwnershipVersion = 0;
    this.claimCollisionAdapter = Object.freeze({
      querySweep: (query) => this.director.querySweep(this.transformedClaimQuery(query)),
      resolveHit: (request) => this.resolveClaimHit(request),
    });
    this.harvestSnapshot = this.combat.harvest.snapshot();
    this.harvestFloorAttempts = new Set();
    this.normalActionSerial = 0;
    this.activeAttackActionId = null;
    this.combatUpdateActive = false;
    this.pendingQueenEnding = false;
    this.spatialHash = new SpatialHash(5.5);
    this.phase = "title";
    this.runType = DEFAULT_RUN_TYPE;
    this.seed = null;
    this.rng = null;
    this.floor = 1;
    this.room = 1;
    this.arena = null;
    this.player = null;
    this.aimPoint = { x: 0, z: 1 };
    this.requireRoomReady = requireRoomReady;
    this.roomReady = !requireRoomReady;
    this.roomPlayRequested = false;
    this.roomLoadSerial = 0;
    this.roomLoadToken = null;
    this.portalActive = false;
    this.portalTraversal = null;
    this.clearTimer = 0;
    this.roomClearResolved = false;
    this.flags = {};
    this.ownedBlessings = new Set();
    this.upgradeRanks = new Map();
    this.upgradeSelections = [];
    this.blessingIds = [];
    this.pendingBlessings = [];
    this.pendingRoomRewards = [];
    this.rerollsUsedByFloor = Array(RUN_CONFIG.totalFloors).fill(0);
    this.roomRewardPending = false;
    this.introCompleted = false;
    this.bossModifiers = { health: 0, enrage: 0 };
    this.ending = new EndingSequence();
    this.endingPresentationStage = "inactive";
    this.endingResolutionHandled = false;
    this.endingCompletionHandled = false;
    this.endingStrike = null;
    this.endingStrikeActionSerial = 0;
    this.reviveActionSerial = 0;
    this.healingSerial = 0;
    this.playerDamageSerial = 0;
    this.transformationTriggerKeys = new Set();
    this.harvestCrownActionIds = new Set();
    this.soulSiphonHealingByAction = new Map();
    this.eclipseCriticalReady = 0;
    this.eclipseCriticalActionId = null;
    this.moonwellRetaliationReady = 0;
    this.endingTimeMs = 0;
    this.pausedPhase = null;
    this.benchmarkMode = false;
    this.showcaseMode = null;
    this.roomBoundaryStable = false;
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, detail = {}) {
    for (const listener of this.listeners) listener({ type, detail });
  }

  startRun(seed = createRunSeed(), { runType = DEFAULT_RUN_TYPE } = {}) {
    this.initializeRunState(seed, runType);
    this.emit("runStarted", { seed, difficultyId: this.difficultyId, runType: this.runType });
    this.loadRoom();
  }

  initializeRunState(seed, runType = DEFAULT_RUN_TYPE) {
    if (!RUN_TYPE_IDS.includes(runType)) throw new RangeError(`Unknown run type: ${runType}`);
    this.hitStop.reset();
    this.flushGameplayActions();
    this.cancelClaim("runReset");
    this.cancelCombatActions("runReset");
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.runType = runType;
    this.difficultyId = runType === "speedrun" ? "ruthless" : this.settings.get("gameplay.difficulty");
    this.floor = 1;
    this.room = 1;
    this.flags = {};
    this.ownedBlessings.clear();
    this.upgradeRanks.clear();
    this.upgradeSelections = [];
    this.blessingIds = [];
    this.pendingBlessings = [];
    this.pendingRoomRewards = [];
    this.rerollsUsedByFloor = Array(RUN_CONFIG.totalFloors).fill(0);
    this.roomRewardPending = false;
    this.bossModifiers = { health: 0, enrage: 0 };
    this.introCompleted = runType === "speedrun";
    this.resetPresentationState();
    this.endingTimeMs = performance.now();
    this.benchmarkMode = false;
    this.showcaseMode = null;
    this.portalTraversal = null;
    this.pendingQueenEnding = false;
    this.roomBoundaryStable = false;
    this.player = {
      position: { x: 0, z: 0 },
      previousPosition: { x: 0, z: 0 },
      radius: PLAYER_CONFIG.radius,
      maxHealth: PLAYER_CONFIG.maxHealth,
      health: PLAYER_CONFIG.maxHealth,
      aimAngle: Math.PI / 2,
      invulnerable: 0,
      hitFlash: 0,
      damageMultiplier: PLAYER_CONFIG.baseDamageMultiplier,
      reachMultiplier: PLAYER_CONFIG.baseReachMultiplier,
      dashCooldownMultiplier: 1,
      criticalChance: 0.05,
      healthOnKill: 0,
      roomRecoveryBonus: 0,
      deathDefiance: 0,
      deathDefianceGranted: 0,
      transformationRanks: {},
    };
    this.normalActionSerial = 0;
    this.activeAttackActionId = null;
    this.reviveActionSerial = 0;
    this.healingSerial = 0;
    this.playerDamageSerial = 0;
    this.resetTransformationCombatState();
    this.harvestFloorAttempts.clear();
    this.combat.reset();
    this.harvestSnapshot = this.combat.harvest.snapshot();
    this.refreshClaimSnapshots();
  }

  resumeRun(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || typeof snapshot.seed !== "string") return false;
    this.initializeRunState(snapshot.seed, snapshot.runType ?? DEFAULT_RUN_TYPE);
    this.difficultyId = snapshot.difficultyId;
    const chamberCatalog = new Map([...RUN_UPGRADES, CHAMBER_FALLBACK].map((definition) => [definition.id, definition]));
    const blessingCatalog = new Map([...BLESSINGS, BLESSING_FALLBACK].map((definition) => [definition.id, definition]));
    const selections = snapshot.statisticsDraft?.selections;
    if (!Array.isArray(selections)) return false;

    for (const selection of selections) {
      const catalog = selection.tier === "chamber" ? chamberCatalog : selection.tier === "blessing" ? blessingCatalog : null;
      const definition = catalog?.get(selection.id);
      const result = definition ? applyRunUpgrade(definition, this.player, this.upgradeRanks) : null;
      if (!result || result.rank !== selection.rankAfter) return false;
      if (selection.tier === "chamber") {
        this.upgradeSelections.push({ upgradeId: selection.id, rankAfter: selection.rankAfter });
      } else {
        this.blessingIds.push(selection.id);
        this.ownedBlessings.add(selection.id);
      }
    }

    const restoredRanks = [...new Map(this.upgradeSelections.map(({ upgradeId, rankAfter }) => [upgradeId, rankAfter]))]
      .sort(([left], [right]) => left.localeCompare(right));
    if (
      JSON.stringify(this.upgradeSelections) !== JSON.stringify(snapshot.upgradeSelections)
      || JSON.stringify(this.blessingIds) !== JSON.stringify(snapshot.blessingIds)
      || JSON.stringify(restoredRanks) !== JSON.stringify(snapshot.upgradeRanks)
      || this.player.deathDefianceGranted !== snapshot.deathDefiance?.granted
    ) return false;
    if (!Number.isFinite(snapshot.player?.health) || snapshot.player.health <= 0 || snapshot.player.health > this.player.maxHealth) return false;
    if (!this.combat.harvest.restoreUnits(snapshot.harvestUnits)) return false;

    this.player.health = snapshot.player.health;
    this.player.deathDefiance = snapshot.deathDefiance.remaining;
    this.rerollsUsedByFloor = [...snapshot.rerollsUsedByFloor];
    this.flags = { ...snapshot.runFlags };
    this.introCompleted = true;
    this.floor = snapshot.nextFloor;
    this.room = snapshot.nextRoom;
    this.harvestFloorAttempts.clear();
    for (let floor = 1; floor <= this.floor; floor += 1) this.harvestFloorAttempts.add(floor);
    this.harvestSnapshot = this.combat.harvest.snapshot();
    this.emit("runResumed", {
      seed: this.seed,
      difficultyId: snapshot.difficultyId,
      runType: this.runType,
      floor: this.floor,
      room: this.room,
    });
    this.loadRoom();
    return true;
  }

  createSuspendedRunSnapshot(statisticsDraft, speedrun = null) {
    if (!this.roomBoundaryStable || !statisticsDraft || this.benchmarkMode || this.showcaseMode) return null;
    const upgradeRanks = [...new Map(this.upgradeSelections.map(({ upgradeId, rankAfter }) => [upgradeId, rankAfter]))]
      .sort(([left], [right]) => left.localeCompare(right));
    return immutableValue({
      seed: this.seed,
      difficultyId: this.difficultyId,
      runType: this.runType,
      speedrun: this.runType === "speedrun"
        ? { elapsedSeconds: speedrun?.elapsedSeconds ?? 0, finished: speedrun?.finished === true }
        : { elapsedSeconds: 0, finished: false },
      nextFloor: this.floor,
      nextRoom: this.room,
      player: { health: this.player.health },
      harvestUnits: this.combat.harvest.snapshot().units,
      deathDefiance: {
        granted: this.player.deathDefianceGranted,
        remaining: this.player.deathDefiance,
      },
      upgradeSelections: this.upgradeSelections.map((selection) => ({ ...selection })),
      upgradeRanks,
      blessingIds: [...this.blessingIds],
      rerollsUsedByFloor: [...this.rerollsUsedByFloor],
      runFlags: Object.fromEntries(Object.entries(this.flags).filter(([, value]) => typeof value === "boolean")),
      statisticsDraft,
    });
  }

  loadRoom() {
    this.hitStop.reset();
    this.flushGameplayActions();
    this.cancelClaim("roomReplacement");
    this.cancelCombatActions("roomReplacement");
    const boss = this.floor === RUN_CONFIG.totalFloors && this.room === RUN_CONFIG.roomsPerFloor;
    this.arena = generateArena({ seed: this.seed, floor: this.floor, room: this.room, boss });
    this.roomLoadSerial += 1;
    this.roomLoadToken = `${this.seed}:${this.arena.id}:${this.roomLoadSerial}`;
    this.roomReady = !this.requireRoomReady;
    this.roomPlayRequested = false;
    this.roomBoundaryStable = false;
    this.player.position = clonePosition(this.arena.playerSpawn);
    this.player.previousPosition = clonePosition(this.arena.playerSpawn);
    this.portalActive = false;
    this.portalTraversal = null;
    this.clearTimer = 0;
    this.roomClearResolved = false;
    this.pendingRoomRewards = [];
    this.roomRewardPending = false;
    this.resetTransformationCombatState();
    const difficulty = DIFFICULTY[this.difficultyId] ?? DIFFICULTY.standard;
    this.director.reset({
      arena: this.arena,
      floor: this.floor,
      room: this.room,
      rng: this.rng.fork(`encounter-${this.floor}-${this.room}`),
      difficulty,
      bossModifiers: this.bossModifiers,
    });
    this.ensureFloorHarvestMinimum();
    this.roomBoundaryStable = true;
    this.emit("arenaChanged", {
      arena: this.arena,
      floor: this.floor,
      room: this.room,
      boss,
      loadToken: this.roomLoadToken,
    });
    this.roomBoundaryStable = false;
    this.emitHud();

    this.openRoom();
  }

  setAimPoint(point) {
    this.aimPoint.x = point.x;
    this.aimPoint.z = point.z;
  }

  updateFixed(dt) {
    if (!this.player) return;
    if (this.phase === "endingStrike") {
      this.updateEndingStrike(dt);
      return;
    }
    if (this.phase === "portalTraversal") {
      this.updatePortalTraversal(dt);
      return;
    }
    if (this.phase !== "playing") return;
    if (this.hitStop.remaining() > 0) {
      this.combat.captureInput(this.input);
      this.hitStop.update(dt);
      return;
    }

    this.player.previousPosition.x = this.player.position.x;
    this.player.previousPosition.z = this.player.position.z;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt);

    const aimX = this.aimPoint.x - this.player.position.x;
    const aimZ = this.aimPoint.z - this.player.position.z;
    if (Math.hypot(aimX, aimZ) > 0.15) {
      const rawAngle = Math.atan2(aimZ, aimX);
      const targetStrength = this.settings.get("gameplay.autoTarget");
      const target = this.findSoftTarget(rawAngle);
      if (target && targetStrength > 0) {
        const targetAngle = Math.atan2(target.position.z - this.player.position.z, target.position.x - this.player.position.x);
        const delta = Math.atan2(Math.sin(targetAngle - rawAngle), Math.cos(targetAngle - rawAngle));
        this.player.aimAngle = rawAngle + delta * targetStrength;
      } else {
        this.player.aimAngle = rawAngle;
      }
    }

    const movement = cameraRelativeMovement(this.input.movement());
    const previousClaimSnapshot = this.claimSnapshots.current;
    const claimOwnershipVersion = this.claimOwnershipVersion;
    let velocity;
    this.combatUpdateActive = true;
    try {
      velocity = this.combat.update(dt, this.input, this.player, movement, {
        onDash: () => {},
        onActiveAttack: (attack, hitIds, facing) => this.resolvePlayerAttack(attack, hitIds, facing),
        claimCollision: this.claimCollisionAdapter,
      });
    } finally {
      this.combatUpdateActive = false;
    }
    if (claimOwnershipVersion === this.claimOwnershipVersion) {
      this.claimSnapshots = Object.freeze({
        previous: previousClaimSnapshot,
        current: this.combat.claim.snapshot(),
      });
    } else {
      this.refreshClaimSnapshots();
    }
    if (this.pendingQueenEnding) {
      this.pendingQueenEnding = false;
      this.startEndingFlow();
      return;
    }
    const movementResult = moveCircleDetailed(this.player.position, velocity, dt, this.player.radius, this.arena);
    this.player.position = movementResult.position;
    this.combat.resolveMovement(movementResult);

    this.director.update(dt, this.player, (attempt) => this.resolvePlayerDamageAttempt(attempt));
    this.checkRoomProgress(dt);
  }

  resolvePlayerAttack(attack, hitIds, facing = this.combat.attackFacing) {
    const actionId = this.activeAttackActionId ?? this.nextNormalActionId();
    const isDashAttack = attack === DASH_ATTACK;
    const hollowStepRank = isDashAttack ? this.transformationRank("hollowStepAfterimage") : 0;
    const reapingPassageRank = isDashAttack ? this.transformationRank("reapingPassageDashAttack") : 0;
    const royalBloodRank = this.isWounded() ? this.transformationRank("royalBloodWounded") : 0;
    let retaliationRank = this.moonwellRetaliationReady;
    const eclipseCritical = this.eclipseCriticalActionId === actionId || this.eclipseCriticalReady > 0;
    const dashDamageMultiplier = 1
      + PROGRESSION_TRANSFORMATION_CONFIG.hollowStepAfterimage.damagePerRank * hollowStepRank
      + PROGRESSION_TRANSFORMATION_CONFIG.reapingPassageDashAttack.damagePerRank * reapingPassageRank;
    const woundedDamageMultiplier = 1
      + PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded.damagePerRank * royalBloodRank;
    const woundedPoiseMultiplier = 1
      + PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded.poisePerRank * royalBloodRank;
    this.spatialHash.rebuild(this.director.enemies);
    const range = attack.range * this.player.reachMultiplier;
    const candidates = this.spatialHash.query(this.player.position.x, this.player.position.z, range + 2);
    for (const enemy of candidates) {
      if (!enemy.active || hitIds.has(enemy.id)) continue;
      const assistedArc = (attack.arc ?? 0) * (
        1 + PROGRESSION_TRANSFORMATION_CONFIG.reapingPassageDashAttack.arcPerRank * reapingPassageRank
      ) + this.settings.get("gameplay.aimAssist") * 0.24;
      const intersectsAttack = attack.shape === "line"
        ? circleIntersectsLine(
            this.player.position,
            facing,
            range,
            attack.width + this.settings.get("gameplay.aimAssist") * 0.36,
            enemy.position,
            enemy.radius,
          )
        : circleIntersectsArc(this.player.position, facing, range, assistedArc, enemy.position, enemy.radius);
      if (!intersectsAttack) continue;
      hitIds.add(enemy.id);
      const critical = eclipseCritical || this.rng.chance(this.player.criticalChance);
      const retaliationDamage = PROGRESSION_TRANSFORMATION_CONFIG.moonwellRenewalRetaliation.damagePerRank * retaliationRank;
      const damage = (
        attack.damage * this.player.damageMultiplier * dashDamageMultiplier * woundedDamageMultiplier
        + retaliationDamage
      ) * (critical ? 1.75 : 1);
      const dx = enemy.position.x - this.player.position.x;
      const dz = enemy.position.z - this.player.position.z;
      const length = Math.hypot(dx, dz) || 1;
      const chargedPoiseDamage = Number.isFinite(attack.poiseDamage) ? attack.poiseDamage : null;
      const basePoiseDamage = chargedPoiseDamage ?? Math.max(
        NORMAL_ATTACK_POISE.minimum,
        Math.min(NORMAL_ATTACK_POISE.maximum, Math.round(attack.damage * NORMAL_ATTACK_POISE.damageScale)),
      );
      const hit = {
        actionId,
        damage,
        critical,
        direction: { x: dx / length, z: dz / length },
        knockback: attack.knockback,
        poiseDamage: basePoiseDamage * woundedPoiseMultiplier
          + PROGRESSION_TRANSFORMATION_CONFIG.moonwellRenewalRetaliation.poiseDamagePerRank * retaliationRank,
        pullStrength: 0,
        sourcePosition: this.player.position,
        origin: "player",
      };
      const resolution = this.director.resolveCombatHit(enemy, hit);
      if (!resolution.accepted) continue;
      if (this.eclipseCriticalReady > 0 && this.eclipseCriticalActionId !== actionId) {
        const rank = this.eclipseCriticalReady;
        this.eclipseCriticalReady = 0;
        this.eclipseCriticalActionId = actionId;
        this.emitTransformationOnce("perfectEclipsePerfectDash", actionId, { consumed: "guaranteedCritical", armedRank: rank });
      }
      if (retaliationRank > 0) {
        this.moonwellRetaliationReady = 0;
        this.emitTransformationOnce("moonwellRenewalRetaliation", actionId, { consumed: "retaliation" });
        retaliationRank = 0;
      }
      if (hollowStepRank > 0) {
        this.emitTransformationOnce("hollowStepAfterimage", actionId, { synchronizedWith: "dashAttack" });
      }
      if (reapingPassageRank > 0) this.emitTransformationOnce("reapingPassageDashAttack", actionId);
      if (royalBloodRank > 0) this.emitTransformationOnce("royalBloodWounded", actionId);
      this.applySoulSiphon(actionId, resolution.hit.damage);
      const hitStopReasons = [];
      if (attack === SCYTHE_ATTACKS[SCYTHE_ATTACKS.length - 1]) hitStopReasons.push("comboFinisher");
      if (critical) hitStopReasons.push("critical");
      if (attack.chargeQuality) hitStopReasons.push(`charge${attack.chargeQuality[0].toUpperCase()}${attack.chargeQuality.slice(1)}`);
      if (attack.chargeKind === "line") hitStopReasons.push("lineCharge");
      this.requestHitStop(actionId, hitStopReasons);
      const eventId = `${actionId}:${enemy.id}:normal`;
      if (
        attack.chargeQuality === "perfect"
        && attack.harvestUnits === HARVEST_CONFIG.gainUnits.perfectCharge
      ) {
        this.applyHarvestGain("perfectCharge", attack.chargeActionId ?? actionId);
      }
      if (length <= HARVEST_CONFIG.closeHitRange) this.applyHarvestGain("closeHit", eventId);
      if (critical) this.applyHarvestGain("critical", eventId);
      if (resolution.defeated) {
        this.applyHarvestGain("kill", eventId);
        this.applyHealthOnKill(actionId);
      }
    }
  }

  handleCombatEvent(type, detail) {
    if (type === "attack") {
      const actionId = this.nextNormalActionId();
      this.emit(type, Object.freeze({ ...detail, actionId }));
      return;
    }
    if (type === "claimStarted") this.syncHarvestSpend("claim");
    if (type === "lineChargeReleased") this.syncHarvestSpend("lineCharge", detail.actionId);
    if (type === "claimRejected" && detail.reason === "insufficientHarvest") {
      this.emitHarvestRejected("insufficientUnits", `claim:${detail.inputTime ?? "unknown"}`);
    }
    if (type === "lineChargeRejected" && detail.reason === "insufficientHarvest") {
      this.emitHarvestRejected("insufficientUnits", `lineCharge:${detail.inputTime ?? "unknown"}`);
    }
    this.emit(type, detail);
  }

  nextNormalActionId() {
    this.normalActionSerial += 1;
    this.activeAttackActionId = `attack-${this.normalActionSerial}`;
    return this.activeAttackActionId;
  }

  transformationRank(hookId) {
    const rank = this.player?.transformationRanks?.[hookId];
    return Number.isInteger(rank) && rank > 0 ? rank : 0;
  }

  resetTransformationCombatState() {
    this.transformationTriggerKeys.clear();
    this.harvestCrownActionIds.clear();
    this.soulSiphonHealingByAction.clear();
    this.eclipseCriticalReady = 0;
    this.eclipseCriticalActionId = null;
    this.moonwellRetaliationReady = 0;
  }

  rememberBounded(set, value, limit = 256) {
    if (set.has(value)) return false;
    set.add(value);
    if (set.size > limit) set.delete(set.values().next().value);
    return true;
  }

  emitTransformationOnce(hookId, actionId, detail = {}) {
    const key = `${hookId}:${actionId}`;
    if (!this.rememberBounded(this.transformationTriggerKeys, key, 512)) return false;
    this.emit("progressionTransformationTriggered", immutableValue({
      hookId,
      actionId,
      rank: this.transformationRank(hookId),
      floor: this.floor,
      room: this.room,
      ...detail,
    }));
    return true;
  }

  isWounded() {
    const threshold = this.player.maxHealth * PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded.healthThreshold;
    return this.player.health <= threshold + Number.EPSILON * this.player.maxHealth;
  }

  transformedClaimQuery(query) {
    const rank = this.transformationRank("farReachClaim");
    if (rank === 0 || !["recall", "cleave"].includes(query.pass)) return query;
    const config = PROGRESSION_TRANSFORMATION_CONFIG.farReachClaim;
    const radiusPerRank = query.pass === "recall" ? config.recallRadiusPerRank : config.cleaveRadiusPerRank;
    return Object.freeze({ ...query, radius: query.radius * (1 + radiusPerRank * rank) });
  }

  applyTransformationHarvest(hookId, actionId, rank) {
    const unitsPerRank = PROGRESSION_TRANSFORMATION_CONFIG[hookId].harvestUnitsPerRank;
    let granted = 0;
    for (let index = 0; index < rank; index += 1) {
      const result = this.applyHarvestGain("upgradeModifier", `${hookId}:${actionId}:${index}`);
      if (result.accepted) granted += result.delta;
    }
    this.emitTransformationOnce(hookId, actionId, { harvestRequested: unitsPerRank * rank, harvestGranted: granted });
    return granted;
  }

  applySoulSiphon(actionId, appliedDamage) {
    const rank = this.transformationRank("soulSiphonAggressiveHeal");
    if (rank === 0 || appliedDamage <= 0) return null;
    const config = PROGRESSION_TRANSFORMATION_CONFIG.soulSiphonAggressiveHeal;
    const used = this.soulSiphonHealingByAction.get(actionId) ?? 0;
    const cap = config.actionHealthCapPerRank * rank;
    const requested = Math.min(cap - used, appliedDamage * config.damageHealingPerRank * rank);
    if (requested <= 0) return null;
    this.soulSiphonHealingByAction.set(actionId, used + requested);
    if (this.soulSiphonHealingByAction.size > 256) {
      this.soulSiphonHealingByAction.delete(this.soulSiphonHealingByAction.keys().next().value);
    }
    const healed = this.restorePlayerHealth(requested, "soulSiphon", {
      sourceActionId: actionId,
      upgradeId: "soul-siphon",
    });
    if (healed) this.emitTransformationOnce("soulSiphonAggressiveHeal", actionId, { actionHealingCap: cap });
    return healed;
  }

  requestHitStop(actionId, reasons) {
    if (
      this.phase !== "playing"
      || this.pendingQueenEnding
      || this.flags.queenDefeated
      || !Array.isArray(reasons)
    ) return Object.freeze({ accepted: false, reason: "terminal" });

    const candidates = reasons
      .map((reason) => ({ reason, policy: HIT_STOP_CONFIG.policies[reason] }))
      .filter((candidate) => candidate.policy);
    if (candidates.length === 0) return Object.freeze({ accepted: false, reason: "nonQualifying" });
    const strongest = candidates.reduce((best, candidate) => {
      const candidateStrength = HIT_STOP_CONFIG.tiers[candidate.policy.tier];
      const bestStrength = HIT_STOP_CONFIG.tiers[best.policy.tier];
      if (candidateStrength !== bestStrength) return candidateStrength > bestStrength ? candidate : best;
      return candidate.policy.duration > best.policy.duration ? candidate : best;
    });
    const duration = Math.max(...candidates.map((candidate) => candidate.policy.duration));
    const result = this.hitStop.request(duration, strongest.policy.tier);
    if (result.accepted) {
      this.emit("hitStopRequested", Object.freeze({
        tier: result.tier,
        duration,
        remaining: result.remaining,
        actionId,
        reason: strongest.reason,
      }));
    }
    return result;
  }

  resolveClaimHit({ actionId, pass, target, definition }) {
    const sourcePosition = this.combat.claim.snapshot().scythePosition;
    const dx = target.position.x - sourcePosition.x;
    const dz = target.position.z - sourcePosition.z;
    const length = Math.hypot(dx, dz) || 1;
    const farReachRank = this.transformationRank("farReachClaim");
    const royalBloodRank = this.isWounded() ? this.transformationRank("royalBloodWounded") : 0;
    const retaliationRank = this.moonwellRetaliationReady;
    const woundedConfig = PROGRESSION_TRANSFORMATION_CONFIG.royalBloodWounded;
    const retaliationConfig = PROGRESSION_TRANSFORMATION_CONFIG.moonwellRenewalRetaliation;
    const pullStrength = (definition.pullStrength ?? 0) * (
      pass === "recall"
        ? 1 + PROGRESSION_TRANSFORMATION_CONFIG.farReachClaim.recallPullPerRank * farReachRank
        : 1
    );
    const resolution = this.director.resolveCombatHit(target, {
      actionId,
      damage: definition.damage * this.player.damageMultiplier * (1 + woundedConfig.damagePerRank * royalBloodRank)
        + retaliationConfig.damagePerRank * retaliationRank,
      critical: false,
      direction: { x: dx / length, z: dz / length },
      knockback: definition.knockback ?? 0,
      poiseDamage: definition.poiseDamage * (1 + woundedConfig.poisePerRank * royalBloodRank)
        + retaliationConfig.poiseDamagePerRank * retaliationRank,
      pullStrength,
      sourcePosition,
      origin: "player",
    });
    if (resolution.accepted && retaliationRank > 0) {
      this.moonwellRetaliationReady = 0;
      this.emitTransformationOnce("moonwellRenewalRetaliation", actionId, { consumed: "retaliation", pass });
    }
    if (resolution.accepted && farReachRank > 0 && ["recall", "cleave"].includes(pass)) {
      this.emitTransformationOnce("farReachClaim", actionId, { pass });
    }
    if (
      resolution.accepted
      && pass === "recall"
      && this.transformationRank("harvestCrownClaim") > 0
      && this.rememberBounded(this.harvestCrownActionIds, actionId)
    ) {
      this.applyTransformationHarvest("harvestCrownClaim", actionId, this.transformationRank("harvestCrownClaim"));
    }
    if (resolution.accepted && royalBloodRank > 0) this.emitTransformationOnce("royalBloodWounded", actionId, { pass });
    if (resolution.accepted) this.applySoulSiphon(actionId, resolution.hit.damage);
    if (resolution.accepted && pass === "recall") this.requestHitStop(actionId, ["claimRecall"]);
    let pull = null;
    if (pass === "recall" && resolution.accepted && !resolution.defeated && target.active) {
      pull = this.director.pullEnemyToward(target, this.combat.claim.snapshot().origin, pullStrength);
    }
    if (resolution.accepted && resolution.defeated) {
      this.applyHarvestGain("kill", `${actionId}:${target.id}:${pass}:claim`);
      this.applyHealthOnKill(actionId);
    }
    return Object.freeze({
      hit: resolution.hit,
      pull,
      terminatePass: resolution.defeated && target.type === "queen",
    });
  }

  applyHealthOnKill(sourceActionId = null) {
    return this.restorePlayerHealth(this.player.healthOnKill, "kill", { sourceActionId });
  }

  emitPlayerHeal(previousHealth, requestedAmount, reason, { sourceActionId = null, upgradeId = null } = {}) {
    const amount = this.player.health - previousHealth;
    if (amount <= 0) return null;
    this.healingSerial += 1;
    const detail = immutableValue({
      healingId: `player-heal-${this.healingSerial}`,
      targetId: "player",
      amount,
      requestedAmount,
      reason,
      position: clonePosition(this.player.position),
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      sourceActionId,
      upgradeId,
      floor: this.floor,
      room: this.room,
    });
    this.emit("playerHealed", detail);
    this.emitHud();
    return detail;
  }

  restorePlayerHealth(requestedAmount, reason, options = {}) {
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !this.player) return null;
    const previousHealth = this.player.health;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + requestedAmount);
    return this.emitPlayerHeal(previousHealth, requestedAmount, reason, options);
  }

  applyHarvestGain(source, eventId) {
    const previous = this.combat.harvest.snapshot();
    const result = this.combat.harvest.gain({ type: source, eventId });
    if (!result.accepted) {
      this.harvestSnapshot = result.snapshot;
      this.emitHarvestRejected(result.reason, eventId, previous, result.snapshot);
      return result;
    }
    this.emitHarvestChanged(previous, result.snapshot, result.delta, source, eventId);
    return result;
  }

  ensureFloorHarvestMinimum() {
    if (this.harvestFloorAttempts.has(this.floor)) return;
    this.harvestFloorAttempts.add(this.floor);
    const previous = this.combat.harvest.snapshot();
    const result = this.combat.harvest.ensureFloorMinimum();
    this.harvestSnapshot = result.snapshot;
    if (result.granted) this.emitHarvestChanged(previous, result.snapshot, result.delta, "floorMinimum", `floor:${this.floor}`);
  }

  syncHarvestSpend(reason, sourceEventId = this.combat.claim.actionId) {
    const current = this.combat.harvest.snapshot();
    const previous = this.harvestSnapshot;
    if (current.units !== previous.units) {
      this.emitHarvestChanged(previous, current, current.units - previous.units, reason, sourceEventId);
    }
  }

  emitHarvestChanged(previous, current, delta, reason, sourceEventId) {
    this.harvestSnapshot = current;
    this.emit("harvestChanged", Object.freeze({
      previous: previous.units,
      previousUnits: previous.units,
      units: current.units,
      delta,
      reason,
      sourceEventId,
      floor: this.floor,
      room: this.room,
    }));
    this.emitHud();
  }

  emitHarvestRejected(reason, sourceEventId, previous = this.harvestSnapshot, current = this.combat.harvest.snapshot()) {
    this.harvestSnapshot = current;
    this.emit("harvestGainRejected", Object.freeze({
      previous: previous.units,
      previousUnits: previous.units,
      units: current.units,
      delta: 0,
      reason,
      sourceEventId,
      floor: this.floor,
      room: this.room,
    }));
  }

  cancelClaim(reason) {
    const snapshot = this.combat.claim.cancel(reason);
    this.claimOwnershipVersion += 1;
    this.combat.claimBuffer = 0;
    this.combat.claimRequest = null;
    this.refreshClaimSnapshots(snapshot);
    return snapshot;
  }

  refreshClaimSnapshots(snapshot = this.combat.claim.snapshot()) {
    this.claimSnapshots = Object.freeze({ previous: snapshot, current: snapshot });
    return this.claimSnapshots;
  }

  flushGameplayActions() {
    this.input.flushActions?.(["attack", "heavy", "dash", "claim", "interact"]);
  }

  cancelCombatActions(reason) {
    this.activeAttackActionId = null;
    return this.combat.cancelPlayerActions(reason);
  }

  damagePlayer(amount, source) {
    return this.applyPlayerDamage(amount, source, null);
  }

  resolvePlayerDamageAttempt(attempt) {
    const valid = this.phase === "playing"
      && attempt
      && typeof attempt === "object"
      && Object.isFrozen(attempt)
      && typeof attempt.attemptId === "string"
      && attempt.attemptId.length > 0
      && typeof attempt.actionId === "string"
      && attempt.actionId.length > 0
      && Number.isFinite(attempt.amount)
      && attempt.amount > 0
      && typeof attempt.source === "string"
      && attempt.source.length > 0
      && typeof attempt.family === "string"
      && attempt.family.length > 0;
    if (!valid) return Object.freeze({ accepted: false, reason: "invalidAttempt", damaged: false, perfectDash: false });

    const qualification = this.combat.qualifyPerfectDash();
    if (qualification.accepted) {
      const detail = Object.freeze({
        actionId: qualification.actionId,
        inputTime: qualification.inputTime,
        elapsed: qualification.elapsed,
        windowOpen: PLAYER_CONFIG.dash.perfectOpen,
        windowClose: PLAYER_CONFIG.dash.perfectClose,
        attemptId: attempt.attemptId,
        sourceActionId: attempt.actionId,
        source: attempt.source,
        family: attempt.family,
        enemyId: attempt.enemyId,
        enemyType: attempt.enemyType,
        enemyOrigin: attempt.enemyOrigin,
        projectileId: attempt.projectileId,
        position: Object.freeze({ ...this.player.position }),
        direction: qualification.direction,
        floor: this.floor,
        room: this.room,
      });
      this.emit("perfectDash", detail);
      const harvest = this.applyHarvestGain("perfectDash", qualification.actionId);
      const eclipseRank = this.transformationRank("perfectEclipsePerfectDash");
      if (eclipseRank > 0) {
        this.eclipseCriticalReady = Math.max(this.eclipseCriticalReady, eclipseRank);
        this.eclipseCriticalActionId = null;
        this.applyTransformationHarvest("perfectEclipsePerfectDash", qualification.actionId, eclipseRank);
      }
      return Object.freeze({
        accepted: true,
        reason: "perfectDash",
        damaged: false,
        perfectDash: true,
        detail,
        harvest,
      });
    }

    return this.applyPlayerDamage(attempt.amount, attempt.source, attempt);
  }

  applyPlayerDamage(amount, source, attempt) {
    if (!Number.isFinite(amount) || amount <= 0 || this.phase !== "playing") {
      return Object.freeze({ accepted: false, reason: "invalidDamage", damaged: false, perfectDash: false });
    }
    if (this.player.invulnerable > 0) {
      return Object.freeze({ accepted: false, reason: "invulnerable", damaged: false, perfectDash: false });
    }
    const previousHealth = this.player.health;
    this.player.health = Math.max(0, this.player.health - amount);
    const appliedAmount = previousHealth - this.player.health;
    this.playerDamageSerial += 1;
    const damageId = `player-damage-${this.playerDamageSerial}`;
    this.player.invulnerable = PLAYER_CONFIG.hitInvulnerability;
    this.player.hitFlash = 0.14;
    const detail = {
      damageId,
      amount,
      appliedAmount,
      source,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      severity: appliedAmount / this.player.maxHealth >= PLAYER_CONFIG.hitSeverity.heavyThresholdRatio
        ? "heavy"
        : "light",
      position: Object.freeze(clonePosition(this.player.position)),
      direction: this.incomingDamageDirection(attempt),
    };
    if (attempt) {
      Object.assign(detail, {
        attemptId: attempt.attemptId,
        actionId: attempt.actionId,
        family: attempt.family,
        enemyId: attempt.enemyId,
        enemyType: attempt.enemyType,
        enemyOrigin: attempt.enemyOrigin,
        projectileId: attempt.projectileId,
      });
    }
    const frozenDetail = immutableValue(detail);
    this.emit("playerHit", frozenDetail);
    this.emitHud();
    const moonwellRank = this.transformationRank("moonwellRenewalRetaliation");
    if (moonwellRank > 0 && (this.player.health > 0 || this.player.deathDefiance > 0)) {
      this.moonwellRetaliationReady = moonwellRank;
      this.emitTransformationOnce("moonwellRenewalRetaliation", damageId, { armed: "retaliation", sourceActionId: attempt?.actionId ?? null });
    }
    if (this.player.health <= 0) {
      if (this.player.deathDefiance > 0) {
        this.cancelClaim("deathDefiance");
        this.cancelCombatActions("deathDefiance");
        this.flushGameplayActions();
        this.player.deathDefiance -= 1;
        this.player.health = Math.max(1, Math.round(this.player.maxHealth * 0.35));
        this.player.invulnerable = 1.2;
        this.reviveActionSerial += 1;
        this.emitPlayerHeal(0, this.player.health, "deathDefiance", {
          sourceActionId: attempt?.actionId ?? null,
          upgradeId: "final-mercy",
        });
        const revived = immutableValue({
          actionId: `player-revive-${this.reviveActionSerial}`,
          sourceActionId: attempt?.actionId ?? null,
          amount: this.player.health,
          health: this.player.health,
          maxHealth: this.player.maxHealth,
          grantedTotal: this.player.deathDefianceGranted,
          chargesRemaining: this.player.deathDefiance,
          position: clonePosition(this.player.position),
        });
        this.emit("playerRevived", revived);
        this.emitHud();
        return Object.freeze({ accepted: true, reason: "deathDefiance", damaged: true, perfectDash: false, detail: frozenDetail });
      }
      this.cancelClaim("death");
      this.cancelCombatActions("death");
      this.flushGameplayActions();
      this.setPhase("dead");
      this.emit("runEnded", {
        completed: false,
        victory: false,
        ending: null,
        floor: this.floor,
        room: this.room,
        seed: this.seed,
        ...(this.runType === "speedrun" ? { difficultyId: "ruthless", runType: "speedrun" } : {}),
      });
    }
    return Object.freeze({ accepted: true, reason: "damaged", damaged: true, perfectDash: false, detail: frozenDetail });
  }

  incomingDamageDirection(attempt) {
    if (!attempt) return Object.freeze({ x: 0, z: 0 });
    const projectile = attempt.projectileId === null || attempt.projectileId === undefined
      ? null
      : this.director.projectiles.find((candidate) => candidate.id === attempt.projectileId);
    if (projectile) {
      const velocityLength = Math.hypot(projectile.velocity.x, projectile.velocity.z);
      if (velocityLength > 0.0001) {
        return Object.freeze({
          x: projectile.velocity.x / velocityLength,
          z: projectile.velocity.z / velocityLength,
        });
      }
      return normalizedDirection(projectile.position, this.player.position);
    }
    const enemy = this.director.enemies.find((candidate) => candidate.id === attempt.enemyId);
    return enemy
      ? normalizedDirection(enemy.position, this.player.position)
      : Object.freeze({ x: 0, z: 0 });
  }

  handleDirectorEvent(type, detail) {
    this.emit(type, detail);
    if (type === "enemyDefeated") {
      if (this.player.healthOnKill > 0) this.emitHud();
    }
    if (type === "enemyHit" && detail.type === "queen") {
      this.emit("bossHealth", { health: detail.health, maxHealth: detail.maxHealth });
    }
    if (type === "enemyDefeated" && detail.type === "queen" && !this.flags.queenDefeated) {
      if (this.combatUpdateActive) this.pendingQueenEnding = true;
      else this.startEndingFlow();
    }
  }

  checkRoomProgress(dt) {
    if (this.flags.queenDefeated) return;
    if (this.director.hasCombatRemaining()) return;
    if (this.arena.boss) return;

    if (!this.roomClearResolved) {
      this.clearTimer += dt;
      if (this.clearTimer >= RUN_CONFIG.roomClearDelay) {
        this.roomClearResolved = true;
        const recoveryPercent = RUN_CONFIG.roomRecoveryPercent + this.player.roomRecoveryBonus;
        const recovery = Math.max(1, Math.round(this.player.maxHealth * recoveryPercent));
        const healed = this.restorePlayerHealth(recovery, "roomRecovery", {
          sourceActionId: `room:${this.floor}:${this.room}`,
        });
        this.emit("roomCleared", { floor: this.floor, room: this.room, portal: clonePosition(this.arena.portal) });
        if (healed) this.emit("roomRecovered", { amount: healed.amount, health: this.player.health, maxHealth: this.player.maxHealth });
        this.activatePortal();
      }
      return;
    }

    if (!this.portalActive) return;
    const distance = Math.hypot(
      this.player.position.x - this.arena.portal.x,
      this.player.position.z - this.arena.portal.z,
    );
    if (distance <= PORTAL_CONFIG.interactionRadius) this.beginPortalTraversal();
  }

  activatePortal() {
    if (
      this.portalActive ||
      !this.roomClearResolved ||
      this.roomRewardPending ||
      this.portalTraversal?.active
    ) return false;

    this.portalActive = true;
    this.emit("portalOpened", {
      floor: this.floor,
      room: this.room,
      portal: clonePosition(this.arena.portal),
    });
    return true;
  }

  beginPortalTraversal() {
    if (
      this.phase !== "playing" ||
      !this.portalActive ||
      this.roomRewardPending ||
      this.portalTraversal?.active
    ) return false;

    const target = clonePosition(this.arena.portal);
    const origin = clonePosition(this.player.position);
    const dx = target.x - origin.x;
    const dz = target.z - origin.z;
    if (Math.hypot(dx, dz) > 0.01) this.player.aimAngle = Math.atan2(dz, dx);
    this.cancelClaim("portal");
    this.cancelCombatActions("portal");
    this.flushGameplayActions();
    this.portalActive = false;
    this.portalTraversal = {
      active: true,
      completed: false,
      elapsed: 0,
      duration: PORTAL_CONFIG.traversalDuration,
      progress: 0,
      visualHeight: 0,
      visualScale: 1,
      origin,
      target,
    };
    this.setPhase("portalTraversal");
    this.emit("portalTraversalStarted", {
      floor: this.floor,
      room: this.room,
      origin,
      portal: target,
      duration: PORTAL_CONFIG.traversalDuration,
    });
    return true;
  }

  updatePortalTraversal(dt) {
    const traversal = this.portalTraversal;
    if (!traversal?.active || traversal.completed) return;
    this.player.previousPosition.x = this.player.position.x;
    this.player.previousPosition.z = this.player.position.z;
    traversal.elapsed = Math.min(traversal.duration, traversal.elapsed + dt);
    traversal.progress = Math.min(1, traversal.elapsed / traversal.duration);
    const travelProgress = easeOutCubic(Math.min(1, traversal.progress / 0.62));
    this.player.position.x = traversal.origin.x + (traversal.target.x - traversal.origin.x) * travelProgress;
    this.player.position.z = traversal.origin.z + (traversal.target.z - traversal.origin.z) * travelProgress;
    traversal.visualHeight = portalVisualHeight(traversal.progress);
    const shrinkProgress = Math.max(0, (traversal.progress - 0.62) / 0.38);
    traversal.visualScale = 1 - easeInCubic(shrinkProgress) * 0.66;
    if (traversal.progress < 1) return;

    traversal.active = false;
    traversal.completed = true;
    const completedFloor = this.floor;
    const completedRoom = this.room;
    this.emit("portalTraversalCompleted", {
      floor: completedFloor,
      room: completedRoom,
      portal: clonePosition(traversal.target),
    });
    this.advanceRoom();
  }

  offerRoomReward() {
    if (
      this.showcaseMode !== "reward"
      && (!this.roomClearResolved || !this.portalTraversal?.completed)
    ) return false;
    if (this.roomRewardPending) return false;
    this.presentRoomReward();
    return true;
  }

  presentRoomReward() {
    this.pendingRoomRewards = offerUpgradeChoices(
      this.rng.fork(`reward-${this.floor}-${this.room}`),
      this.upgradeRanks,
      RUN_UPGRADES,
      3,
      CHAMBER_FALLBACK,
      this.player,
    );
    this.roomRewardPending = true;
    this.setPhase("reward");
    this.emit("roomRewardOffered", {
      floor: this.floor,
      room: this.room,
      choices: Object.freeze(this.pendingRoomRewards.map(publicUpgradeChoice)),
      rerollAvailable: this.rerollAvailableFor(this.pendingRoomRewards, RUN_UPGRADES),
    });
  }

  rerollAvailableFor(choices, pool) {
    if (
      this.rerollsUsedByFloor[this.floor - 1] === 1
      || choices.length === 0
      || choices.some((choice) => choice.fallback === true)
    ) return false;
    const currentIds = new Set(choices.map((choice) => choice.id));
    return pool.some((definition) => (
      !currentIds.has(definition.id)
      && isUpgradeEligible(definition, this.upgradeRanks, this.player)
      && choices.some((choice) => choice.path === definition.path)
    ));
  }

  rerollUpgradeOffer() {
    const reward = this.phase === "reward" && this.roomRewardPending;
    const blessing = this.phase === "blessing";
    if (!reward && !blessing) return false;
    const current = reward ? this.pendingRoomRewards : this.pendingBlessings;
    const pool = reward ? RUN_UPGRADES : BLESSINGS;
    if (!this.rerollAvailableFor(current, pool)) return false;
    const previousChoiceIds = current.map((choice) => choice.id);
    const seedLabel = reward
      ? `reward-${this.floor}-${this.room}-reroll-1`
      : `blessing-${this.floor}-reroll-1`;
    const replacements = reward
      ? offerUpgradeChoices(
        this.rng.fork(seedLabel),
        this.upgradeRanks,
        RUN_UPGRADES,
        3,
        CHAMBER_FALLBACK,
        this.player,
        { avoidIds: previousChoiceIds },
      )
      : chooseBlessings(
        this.rng.fork(seedLabel),
        this.upgradeRanks,
        3,
        this.player,
        { avoidIds: previousChoiceIds },
      );
    const previousIdSet = new Set(previousChoiceIds);
    if (replacements.every((choice) => previousIdSet.has(choice.id))) return false;
    this.rerollsUsedByFloor[this.floor - 1] = 1;
    if (reward) this.pendingRoomRewards = replacements;
    else this.pendingBlessings = replacements;
    this.emit("upgradeRerolled", immutableValue({
      tier: reward ? "chamber" : "blessing",
      floor: this.floor,
      room: this.room,
      previousChoiceIds,
      choices: replacements.map(publicUpgradeChoice),
      rerollAvailable: false,
    }));
    return true;
  }

  chooseRoomReward(id) {
    if (this.phase !== "reward" || !this.roomRewardPending) return;
    const reward = this.pendingRoomRewards.find((choice) => choice.id === id);
    const previousHealth = this.player.health;
    const result = applyRunUpgrade(reward, this.player, this.upgradeRanks);
    if (!result) return;
    this.emitPlayerHeal(previousHealth, this.player.health - previousHealth, "roomUpgrade", {
      upgradeId: result.id,
    });
    this.pendingRoomRewards = [];
    this.roomRewardPending = false;
    this.upgradeSelections.push({ upgradeId: result.id, rankAfter: result.rank });
    this.emit("roomRewardChosen", { ...result, floor: this.floor, room: this.room });
    this.room += 1;
    this.loadRoom();
  }

  advanceRoom() {
    if (
      !this.benchmarkMode
      && !this.showcaseMode
      && !this.portalTraversal?.completed
    ) return false;
    if (this.room < RUN_CONFIG.roomsPerFloor) {
      if (!this.benchmarkMode) {
        return this.offerRoomReward();
      }
      this.room += 1;
      this.loadRoom();
      return true;
    }

    if (this.floor >= RUN_CONFIG.totalFloors) return false;
    this.pendingBlessings = chooseBlessings(
      this.rng.fork(`blessing-${this.floor}`),
      this.upgradeRanks,
      3,
      this.player,
    );
    this.presentBlessings();
    return true;
  }

  presentBlessings() {
    this.setPhase("blessing");
    this.emit("blessingOffered", {
      floor: this.floor,
      room: this.room,
      choices: Object.freeze(this.pendingBlessings.map(publicUpgradeChoice)),
      rerollAvailable: this.rerollAvailableFor(this.pendingBlessings, BLESSINGS),
    });
  }

  requestRoomPlay() {
    this.roomPlayRequested = true;
    this.setPhase(this.roomReady ? "playing" : "roomLoading");
  }

  acknowledgeRoomReady(loadToken) {
    if (loadToken !== this.roomLoadToken || this.roomReady) return false;
    this.roomReady = true;
    this.emit("roomReady", { loadToken, arenaId: this.arena.id, floor: this.floor, room: this.room });
    if (this.roomPlayRequested && this.phase === "roomLoading") this.setPhase("playing");
    return true;
  }

  failRoomLoad(loadToken) {
    if (loadToken !== this.roomLoadToken || this.roomReady) return false;
    this.roomPlayRequested = false;
    this.setPhase("roomLoadError");
    this.emit("roomLoadFailed", { loadToken, arenaId: this.arena.id, floor: this.floor, room: this.room });
    return true;
  }

  chooseBlessing(id) {
    if (this.phase !== "blessing") return;
    const blessing = this.pendingBlessings.find((choice) => choice.id === id);
    if (!blessing) return;
    const previousHealth = this.player.health;
    const result = applyRunUpgrade(blessing, this.player, this.upgradeRanks);
    if (!result) return;
    this.emitPlayerHeal(previousHealth, this.player.health - previousHealth, "blessing", {
      upgradeId: result.id,
    });
    this.ownedBlessings.add(blessing.id);
    this.blessingIds.push(blessing.id);
    this.pendingBlessings = [];
    if (result.deathDefianceGranted > 0) {
      this.emit("deathDefianceGranted", immutableValue({
        amount: result.deathDefianceGranted,
        grantedTotal: result.deathDefianceGrantedTotal,
        chargesRemaining: result.deathDefianceRemaining,
        upgradeId: result.id,
        floor: this.floor,
        room: this.room,
      }));
    }
    this.emit("blessingChosen", result);
    this.floor += 1;
    this.room = 1;
    this.restorePlayerHealth(
      Math.round(this.player.maxHealth * RUN_CONFIG.floorRecoveryPercent),
      "floorRecovery",
      { sourceActionId: `floor:${this.floor}` },
    );
    this.loadRoom();
  }

  resetPresentationState() {
    this.bookend.reset();
    this.activeBookend = null;
    this.bookendOnComplete = null;
    this.ending.reset();
    this.endingPresentationStage = "inactive";
    this.endingResolutionHandled = false;
    this.endingCompletionHandled = false;
    this.endingStrike = null;
    this.endingStrikeActionSerial = 0;
    this.endingTimeMs = 0;
    this.pausedPhase = null;
  }

  openRoom() {
    const shouldShowIntro = !this.introCompleted
      && !this.benchmarkMode
      && !this.showcaseMode
      && this.runType === "normal"
      && this.floor === 1
      && this.room === 1;
    if (!shouldShowIntro) {
      this.requestRoomPlay();
      return;
    }
    this.startBookend("intro", () => {
      this.introCompleted = true;
      this.requestRoomPlay();
    });
    this.emit("introStarted", { seed: this.seed });
  }

  startBookend(sequenceId, onComplete) {
    if (this.activeBookend) return false;
    this.activeBookend = sequenceId;
    this.bookendOnComplete = onComplete ?? null;
    const view = this.bookend.start(sequenceId);
    this.setPhase("bookend");
    this.emit("bookendStarted", view);
    return true;
  }

  continueBookend() {
    if (this.phase !== "bookend" || !this.activeBookend) return false;
    const result = this.bookend.advance();
    if (!result.completed) {
      this.emit("bookendAdvanced", result.view);
      return true;
    }
    const completedId = this.activeBookend;
    const onComplete = this.bookendOnComplete;
    this.activeBookend = null;
    this.bookendOnComplete = null;
    this.emit("bookendCompleted", { sequenceId: completedId });
    onComplete?.();
    return true;
  }

  startEndingFlow() {
    if (this.flags.queenDefeated) return;
    this.hitStop.reset();
    this.cancelClaim("ending");
    this.cancelCombatActions("ending");
    this.flags.queenDefeated = true;
    this.portalActive = false;
    this.roomClearResolved = true;
    this.flushGameplayActions();
    this.endingPresentationStage = "witchDeath";
    this.emit("endingSequenceStarted", { floor: this.floor, room: this.room, runType: this.runType });
    const dismissed = this.director.dismissStableOrigin();
    this.endingPresentationStage = "revealHuman";
    this.emit("witchMagicCeased", { dismissed });
    this.emit("princessHumanReturned");
    if (this.runType === "speedrun") {
      this.beginEndingDecision();
      return;
    }
    this.startBookend("ending.plea", () => this.beginEndingDecision());
  }

  beginEndingDecision(nowMs = performance.now()) {
    this.cancelClaim("endingDecision");
    this.cancelCombatActions("endingDecision");
    this.endingTimeMs = Math.max(this.endingTimeMs, nowMs);
    this.ending.reset();
    this.ending.startDecision(this.endingTimeMs);
    this.endingPresentationStage = "decision";
    this.endingResolutionHandled = false;
    this.flushGameplayActions();
    this.setPhase("endingChoice");
    const snapshot = this.ending.snapshot();
    this.emit("endingDecisionStarted", snapshot);
    return snapshot;
  }

  tryKillPrincess(inputAtMs = performance.now()) {
    if (this.phase !== "endingChoice") return false;
    this.endingTimeMs = Math.max(this.endingTimeMs, inputAtMs);
    const result = this.ending.tryKill(inputAtMs);
    if (result.snapshot.result) this.handleEndingResolution(result.snapshot);
    return result.accepted;
  }

  updateEndingClock(nowMs) {
    this.endingTimeMs = Math.max(this.endingTimeMs, nowMs);
    if (!["endingChoice", "endingFade"].includes(this.phase)) return this.ending.snapshot();
    const snapshot = this.ending.update(this.endingTimeMs);
    if (this.phase === "endingChoice") {
      this.emit("endingDecisionUpdated", snapshot);
      if (snapshot.result) this.handleEndingResolution(snapshot);
    } else if (this.phase === "endingFade") {
      this.emit("endingFadeUpdated", snapshot);
      if (snapshot.stage === "complete") this.completeEnding();
    }
    return snapshot;
  }

  handleEndingResolution(snapshot) {
    if (this.endingResolutionHandled || !snapshot.result) return;
    this.cancelClaim(`ending:${snapshot.result.id}`);
    this.cancelCombatActions(`ending:${snapshot.result.id}`);
    this.endingResolutionHandled = true;
    const ending = snapshot.result.id;
    this.endingPresentationStage = ending;
    this.flushGameplayActions();
    this.emit("endingChoiceResolved", immutableValue({
      ending,
      result: snapshot.result,
      decision: snapshot.decision,
    }));
    if (ending === "kill") {
      this.beginEndingStrike();
      return;
    }

    if (this.runType === "speedrun") {
      this.flags.princeKilledByPrincess = true;
      this.player.health = 0;
      this.emitHud();
      this.emit("playerKilledByPrincess", { ending });
      this.beginEndingFade();
      return;
    }

    this.startBookend("ending.timeout", () => {
      this.flags.princeKilledByPrincess = true;
      this.player.health = 0;
      this.emitHud();
      this.emit("playerKilledByPrincess", { ending });
      this.beginEndingFade();
    });
  }

  beginEndingStrike() {
    if (this.endingStrike && !this.endingStrike.completed) return this.endingStrike;
    this.hitStop.reset();
    this.cancelClaim("endingStrike");
    this.cancelCombatActions("endingStrike");
    this.flushGameplayActions();
    this.endingStrikeActionSerial += 1;
    this.endingStrike = {
      actionId: `ending-strike-${this.endingStrikeActionSerial}`,
      elapsed: 0,
      timing: ENDING_TIMING.endingStrike,
      contactEmitted: false,
      completed: false,
    };
    this.endingPresentationStage = "endingStrike";
    this.setPhase("endingStrike");
    this.emit("endingStrikeStarted", immutableValue({
      actionId: this.endingStrike.actionId,
      ending: "kill",
      elapsed: 0,
      timing: this.endingStrike.timing,
    }));
    return this.endingStrike;
  }

  updateEndingStrike(dt) {
    const strike = this.endingStrike;
    if (!strike || strike.completed || !Number.isFinite(dt) || dt <= 0) return;
    const previous = strike.elapsed;
    strike.elapsed = Math.min(strike.timing.R, strike.elapsed + dt);
    if (!strike.contactEmitted && previous < strike.timing.C && strike.elapsed >= strike.timing.C) {
      strike.contactEmitted = true;
      this.emit("princessStruck", immutableValue({
        actionId: strike.actionId,
        ending: "kill",
        elapsed: strike.timing.C,
        contact: strike.timing.C,
        timing: strike.timing,
      }));
    }
    if (strike.completed || strike.elapsed < strike.timing.R) return;
    strike.completed = true;
    this.emit("endingStrikeCompleted", immutableValue({
      actionId: strike.actionId,
      ending: "kill",
      elapsed: strike.timing.R,
      timing: strike.timing,
    }));
    this.endingPresentationStage = "kill";
    if (this.runType === "speedrun") {
      this.emit("princessKilled", { ending: "kill" });
      this.emit("corruptionDestroyed", { ending: "kill" });
      this.beginEndingFade();
      return;
    }
    this.startBookend("ending.kill", () => {
      this.emit("princessKilled", { ending: "kill" });
      this.emit("corruptionDestroyed", { ending: "kill" });
      this.beginEndingFade();
    });
  }

  beginEndingFade(nowMs = Math.max(performance.now(), this.endingTimeMs)) {
    this.cancelClaim("endingFade");
    this.cancelCombatActions("endingFade");
    this.endingTimeMs = Math.max(this.endingTimeMs, nowMs);
    const snapshot = this.ending.startFade(this.endingTimeMs);
    this.endingPresentationStage = "fade";
    this.setPhase("endingFade");
    this.emit("endingFadeStarted", snapshot);
    if (snapshot.stage === "complete") this.completeEnding();
  }

  completeEnding() {
    if (this.endingCompletionHandled) return;
    this.cancelClaim("endingComplete");
    this.cancelCombatActions("endingComplete");
    this.endingCompletionHandled = true;
    this.endingPresentationStage = "complete";
    const ending = this.ending.snapshot().result?.id;
    this.setPhase("endingComplete");
    this.emit("endingCompleted", {
      ending,
      seed: this.seed,
      ...(this.runType === "speedrun" ? { runType: "speedrun" } : {}),
    });
    this.emit("runEnded", {
      completed: true,
      victory: ending === "kill",
      ending,
      seed: this.seed,
      ...(this.runType === "speedrun" ? { runType: "speedrun" } : {}),
    });
  }

  togglePause(nowMs = performance.now()) {
    this.endingTimeMs = Math.max(this.endingTimeMs, nowMs);
    if (["playing", "reward", "blessing", "endingChoice", "endingStrike"].includes(this.phase)) {
      this.pausedPhase = this.phase;
      if (this.phase === "endingChoice") {
        const snapshot = this.ending.pause(this.endingTimeMs);
        if (snapshot.result) {
          this.pausedPhase = null;
          this.handleEndingResolution(snapshot);
          return true;
        }
      }
      this.setPhase("paused");
      return true;
    }
    if (this.phase !== "paused" || !this.pausedPhase) return false;
    const resumePhase = this.pausedPhase;
    this.pausedPhase = null;
    if (resumePhase === "endingChoice") this.ending.resume(this.endingTimeMs);
    this.setPhase(resumePhase);
    return true;
  }

  returnToTitle() {
    this.cancelClaim("returnToTitle");
    this.cancelCombatActions("returnToTitle");
    this.flushGameplayActions();
    this.resetPresentationState();
    this.setPhase("title");
  }

  abandonRun() {
    if (!this.player || ["title", "dead", "endingComplete", "victory"].includes(this.phase)) return false;
    this.emit("runEnded", {
      completed: false,
      victory: false,
      ending: null,
      cause: "abandoned",
      floor: this.floor,
      room: this.room,
      seed: this.seed,
      difficultyId: this.difficultyId,
      ...(this.runType === "speedrun" ? { runType: "speedrun" } : {}),
    });
    this.returnToTitle();
    return true;
  }

  setPhase(phase) {
    this.phase = phase;
    if (ACTION_CLEAR_PHASES.has(phase)) {
      this.hitStop.reset();
      this.cancelClaim(`phase:${phase}`);
      this.cancelCombatActions(`phase:${phase}`);
      this.flushGameplayActions();
      this.resetTransformationCombatState();
    }
    this.emit("phaseChanged", { phase });
  }

  emitHud() {
    if (!this.player) return;
    this.emit("hudChanged", {
      floor: this.floor,
      room: this.room,
      totalFloors: RUN_CONFIG.totalFloors,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      seed: this.seed,
      harvest: this.combat.harvest.snapshot(),
      claim: this.claimSnapshots.current,
      claimSnapshots: this.claimSnapshots,
      paths: summarizeUpgradePaths(this.upgradeRanks, [...RUN_UPGRADES, ...BLESSINGS]),
    });
  }

  findSoftTarget(rawAngle) {
    let best = null;
    let bestScore = Infinity;
    for (const enemy of this.director.enemies) {
      if (!enemy.active) continue;
      const dx = enemy.position.x - this.player.position.x;
      const dz = enemy.position.z - this.player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 7) continue;
      const angle = Math.atan2(dz, dx);
      const angularDistance = Math.abs(Math.atan2(Math.sin(angle - rawAngle), Math.cos(angle - rawAngle)));
      if (angularDistance > 0.7) continue;
      const score = distance + angularDistance * 5;
      if (score < bestScore) {
        best = enemy;
        bestScore = score;
      }
    }
    return best;
  }

  enterBossShowcase(seed = "SHOWCASE-BOSS") {
    this.startRun(seed);
    this.showcaseMode = "boss";
    this.introCompleted = true;
    this.floor = RUN_CONFIG.totalFloors;
    this.room = RUN_CONFIG.roomsPerFloor;
    this.resetPresentationState();
    this.loadRoom();
    this.player.invulnerable = Number.POSITIVE_INFINITY;
    this.emit("showcaseStarted", { mode: this.showcaseMode, seed });
  }

  enterRewardShowcase(seed = "SHOWCASE-REWARD") {
    this.startRun(seed);
    this.showcaseMode = "reward";
    this.introCompleted = true;
    this.resetPresentationState();
    for (const enemy of this.director.enemies) enemy.active = false;
    this.director.pendingWaves.length = 0;
    this.roomClearResolved = true;
    this.offerRoomReward();
    this.emit("showcaseStarted", { mode: this.showcaseMode, seed });
  }

  enterEndingShowcase(seed = "SHOWCASE-ENDING") {
    this.startRun(seed);
    this.showcaseMode = "ending";
    this.introCompleted = true;
    this.floor = RUN_CONFIG.totalFloors;
    this.room = RUN_CONFIG.roomsPerFloor;
    this.resetPresentationState();
    this.loadRoom();
    for (const enemy of this.director.enemies) enemy.active = false;
    this.director.pendingWaves.length = 0;
    this.flags.queenDefeated = true;
    this.endingPresentationStage = "revealHuman";
    this.player.invulnerable = Number.POSITIVE_INFINITY;
    this.startBookend("ending.plea", () => this.beginEndingDecision());
    this.emit("showcaseStarted", { mode: this.showcaseMode, seed });
  }

  enterBenchmarkMode(enemyCount) {
    this.startRun("BENCHMARK-REAPER");
    this.benchmarkMode = true;
    this.introCompleted = true;
    this.floor = 9;
    this.room = 2;
    this.resetPresentationState();
    this.loadRoom();
    this.director.stressSpawn(enemyCount, 9);
    this.player.invulnerable = 9999;
    this.emit("benchmarkStarted", { enemyCount });
  }
}
