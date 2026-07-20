import {
  BLESSINGS,
  chooseBlessings,
  oathSlotOrderForSeed,
  TECHNIQUE_SLOTS,
  techniqueSlotForOathFloor,
} from "./blessings.js";
import { BookendSequence } from "./BookendSequence.js";
import { circleIntersectsArc, circleIntersectsLine, moveCircleDetailed, SpatialHash } from "./collision.js";
import { EndingSequence } from "./EndingSequence.js";
import { EnemyDirector } from "./EnemyDirector.js";
import { walkableArea } from "./arenaGeometry.js";
import { createEncounterPlan } from "./encounterPatterns.js";
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
  PROGRESSION_BALANCE_LIMITS,
  RUN_CONFIG,
  RUN_TYPE_IDS,
  SCYTHE_ATTACKS,
} from "./gameConfig.js";
import { HitStopClock } from "./HitStopClock.js";
import { hasLineOfSight } from "./navigation.js";
import { PlayerCombat } from "./PlayerCombat.js";
import { applyProgressionChoice, progressionCardSnapshot } from "./progressionModel.js";
import {
  modifierTotal,
  progressionBuildSnapshot,
  progressionConditionsSnapshot,
} from "./progressionRuntime.js";
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
      querySweep: (query) => this.director.querySweep(query),
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
    this.blessingIds = [];
    this.pendingBlessings = [];
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
    this.progressionState = this.createProgressionCombatState();
    this.endingTimeMs = 0;
    this.pausedPhase = null;
    this.benchmarkMode = false;
    this.showcaseMode = null;
    this.roomBoundaryStable = false;
    this.lastEncounterRecipeType = null;
    this.encounterRecipeLocation = null;
    this.encounterPreviousRecipeType = null;
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
    this.blessingIds = [];
    this.pendingBlessings = [];
    this.bossModifiers = { health: 0, enrage: 0 };
    this.introCompleted = runType === "speedrun";
    this.resetPresentationState();
    this.endingTimeMs = performance.now();
    this.benchmarkMode = false;
    this.showcaseMode = null;
    this.portalTraversal = null;
    this.pendingQueenEnding = false;
    this.roomBoundaryStable = false;
    this.lastEncounterRecipeType = null;
    this.encounterRecipeLocation = null;
    this.encounterPreviousRecipeType = null;
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
      deathDefiance: 0,
      deathDefianceGranted: 0,
      modifierRanks: {},
    };
    this.normalActionSerial = 0;
    this.activeAttackActionId = null;
    this.reviveActionSerial = 0;
    this.healingSerial = 0;
    this.playerDamageSerial = 0;
    this.resetProgressionCombatState();
    this.harvestFloorAttempts.clear();
    this.combat.reset();
    this.harvestSnapshot = this.combat.harvest.snapshot();
    this.refreshClaimSnapshots();
  }

  resumeRun(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || typeof snapshot.seed !== "string") return false;
    this.initializeRunState(snapshot.seed, snapshot.runType ?? DEFAULT_RUN_TYPE);
    this.difficultyId = snapshot.difficultyId;
    const blessingCatalog = new Map([...BLESSINGS, BLESSING_FALLBACK].map((definition) => [definition.id, definition]));
    const selections = snapshot.statisticsDraft?.selections;
    if (!Array.isArray(selections)) return false;

    for (const selection of selections) {
      if (selection.tier !== "blessing") return false;
      const definition = blessingCatalog.get(selection.id);
      const result = definition ? applyProgressionChoice(definition, this.player, this.upgradeRanks) : null;
      if (!result || result.rank !== selection.rankAfter) return false;
      this.blessingIds.push(selection.id);
      this.ownedBlessings.add(selection.id);
    }

    if (
      JSON.stringify(this.blessingIds) !== JSON.stringify(snapshot.blessingIds)
      || this.player.deathDefianceGranted !== snapshot.deathDefiance?.granted
    ) return false;
    if (!Number.isFinite(snapshot.player?.health) || snapshot.player.health <= 0 || snapshot.player.health > this.player.maxHealth) return false;
    if (!this.combat.harvest.restoreUnits(snapshot.harvestUnits)) return false;

    this.player.health = snapshot.player.health;
    this.player.deathDefiance = snapshot.deathDefiance.remaining;
    this.flags = { ...snapshot.runFlags };
    this.introCompleted = true;
    this.floor = snapshot.nextFloor;
    this.room = snapshot.nextRoom;
    this.lastEncounterRecipeType = this.derivePreviousEncounterRecipeType();
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
      blessingIds: [...this.blessingIds],
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
    this.resetProgressionCombatState();
    const difficulty = DIFFICULTY[this.difficultyId] ?? DIFFICULTY.standard;
    const encounterLocation = `${this.floor}:${this.room}`;
    const previousRecipeType = this.encounterRecipeLocation === encounterLocation
      ? this.encounterPreviousRecipeType
      : this.lastEncounterRecipeType;
    this.director.reset({
      arena: this.arena,
      floor: this.floor,
      room: this.room,
      rng: this.rng.fork(`encounter-${this.floor}-${this.room}`),
      difficulty,
      bossModifiers: this.bossModifiers,
      previousRecipeType,
    });
    if (this.director.encounterPlan) {
      this.encounterRecipeLocation = encounterLocation;
      this.encounterPreviousRecipeType = previousRecipeType;
      this.lastEncounterRecipeType = this.director.encounterPlan.type;
    }
    this.ensureFloorHarvestMinimum();
    this.roomBoundaryStable = true;
    this.emit("arenaChanged", {
      arena: this.arena,
      floor: this.floor,
      room: this.room,
      boss,
      loadToken: this.roomLoadToken,
      encounterPlan: this.director.encounterPlan,
      geometry: {
        walkableArea: walkableArea(this.arena),
        connectorWidths: this.arena.walkableShape.connectors.map((connector) => connector.width),
        objectiveReachable: true,
        escapeRouteChecks: this.arena.walkableShape.majorRegionIds.length,
        escapeRouteFailures: 0,
      },
    });
    this.roomBoundaryStable = false;
    this.emitHud();

    this.openRoom();
  }

  derivePreviousEncounterRecipeType() {
    const difficulty = DIFFICULTY[this.difficultyId] ?? DIFFICULTY.standard;
    let previousRecipeType = null;
    for (let floor = 1; floor <= RUN_CONFIG.totalFloors; floor += 1) {
      for (let room = 1; room <= RUN_CONFIG.roomsPerFloor; room += 1) {
        if (floor === this.floor && room === this.room) return previousRecipeType;
        const boss = floor === RUN_CONFIG.totalFloors && room === RUN_CONFIG.roomsPerFloor;
        if (boss) return previousRecipeType;
        const arena = generateArena({ seed: this.seed, floor, room, boss: false });
        const encounterRng = new SeededRandom(this.seed).fork(`encounter-${floor}-${room}`);
        const plan = createEncounterPlan({
          floor,
          room,
          spawnPoints: arena.enemySpawnPoints,
          rng: encounterRng.fork("plan"),
          difficulty,
          layout: arena,
          layoutFamily: arena.layoutFamily,
          previousRecipeType,
        });
        previousRecipeType = plan.type;
      }
    }
    return previousRecipeType;
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
    this.tickProgressionState(dt);
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
    const state = this.progressionState;
    const isDashAttack = attack.isDashAttack === true || attack === DASH_ATTACK;
    const comboIndex = Number.isInteger(attack.comboIndex) ? attack.comboIndex : this.combat.comboIndex;
    const reapingPassage = isDashAttack ? modifierTotal(this.player, "reapingPassageOath") : null;
    const headsman = comboIndex === 2 ? modifierTotal(this.player, "headsmansCadence") : null;
    const guaranteedCritical = state.guaranteedCriticalActionId === actionId || state.guaranteedCriticalReady;
    this.spatialHash.rebuild(this.director.enemies);
    const range = attack.range * this.player.reachMultiplier;
    const candidates = this.spatialHash.query(this.player.position.x, this.player.position.z, range + 2);
    for (const enemy of candidates) {
      if (!this.director.isEnemyInteractive(enemy) || hitIds.has(enemy.id)) continue;
      const assistedArc = (attack.arc ?? 0) + this.settings.get("gameplay.aimAssist") * 0.24;
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
      if (!hasLineOfSight(this.player.position, enemy.position, this.arena, 0.08)) continue;
      hitIds.add(enemy.id);
      const dx = enemy.position.x - this.player.position.x;
      const dz = enemy.position.z - this.player.position.z;
      const length = Math.hypot(dx, dz) || 1;
      const critical = guaranteedCritical || this.rng.chance(Math.min(
        PROGRESSION_BALANCE_LIMITS.criticalChance,
        this.player.criticalChance,
      ));
      let actionDamageMultiplier = attack.progressionCombo?.damageMultiplier ?? 1;
      actionDamageMultiplier *= 1 + (reapingPassage?.dashStrikeDamageBonus ?? 0);
      actionDamageMultiplier = Math.min(1 + PROGRESSION_BALANCE_LIMITS.actionDamageBonus, actionDamageMultiplier);
      let damage = attack.damage * this.player.damageMultiplier * actionDamageMultiplier * (critical ? 1.75 : 1);
      const executeThreshold = headsman?.executeThreshold ?? 0;
      if (enemy.type !== "queen" && enemy.health / enemy.maxHealth <= executeThreshold) {
        damage = Math.max(damage, enemy.health * 2);
      }
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
        poiseDamage: basePoiseDamage
          * (attack.progressionCombo?.poiseMultiplier ?? 1)
          * (1 + (reapingPassage?.dashStrikePoiseBonus ?? 0))
          * (enemy.type === "queen" && attack.progressionLine?.pullEnabled ? 1.2 : 1),
        pullStrength: 0,
        sourcePosition: this.player.position,
        origin: "player",
      };
      const resolution = this.director.resolveCombatHit(enemy, hit);
      if (!resolution.accepted) continue;
      if (state.guaranteedCriticalReady && state.guaranteedCriticalActionId !== actionId) {
        state.guaranteedCriticalReady = false;
        state.guaranteedCriticalActionId = actionId;
        this.emitCombatConditions();
      }
      this.recordProgressionHit(
        actionId,
        enemy,
        { ...attack, comboIndex, isDashAttack },
        critical,
        resolution,
        facing,
      );
      const hitStopReasons = [];
      if (comboIndex === 2) hitStopReasons.push("comboFinisher");
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
      }
    }
  }

  recordProgressionHit(actionId, enemy, attack, critical, resolution, facing) {
    const state = this.progressionState;
    let targets = state.actionHitTargets.get(actionId);
    if (!targets) {
      targets = new Set();
      state.actionHitTargets.set(actionId, targets);
    }
    targets.add(enemy.id);

    const pallbearer = modifierTotal(this.player, "pallbearersCadence");
    if (attack.comboIndex === 2 && pallbearer && targets.size >= pallbearer.minimumWardTargets) {
      state.aegisRemaining = Math.max(state.aegisRemaining, pallbearer.wardDurationSeconds);
      state.aegisReduction = Math.max(state.aegisReduction, pallbearer.wardStrength);
      this.emitCombatConditions();
    }

    if (attack.bloodOrbit) {
      const used = state.bloodHealingByAction.get(actionId) ?? 0;
      const amount = Math.min(attack.bloodOrbit.healPerEnemy, attack.bloodOrbit.healCap - used);
      if (amount > 0) {
        state.bloodHealingByAction.set(actionId, used + amount);
        this.restorePlayerHealth(amount, "bloodOrbit", { sourceActionId: actionId, upgradeId: "blood-orbit" });
      }
    }

    if (attack.progressionLine && !resolution.defeated) {
      if (attack.progressionLine.pullEnabled && enemy.type !== "queen") {
        const center = {
          x: this.player.position.x + Math.cos(facing) * attack.range * 0.5,
          z: this.player.position.z + Math.sin(facing) * attack.range * 0.5,
        };
        this.director.pullEnemyToward(enemy, center, 2.4);
      }
      if (attack.progressionLine.slow > 0) {
        this.director.slowEnemy?.(enemy, attack.progressionLine.slow, attack.progressionLine.slowDurationSeconds);
      }
    }
  }

  grantUpgradeHarvest(actionId, source, requestedAmount) {
    const used = this.progressionState.upgradeHarvestByAction.get(actionId) ?? 0;
    const amount = Math.min(PROGRESSION_BALANCE_LIMITS.harvestRefundPerAction - used, requestedAmount);
    if (!Number.isInteger(amount) || amount <= 0) return null;
    const result = this.applyHarvestGain("upgradeModifier", `${source}:${actionId}`, amount);
    if (result.accepted) this.progressionState.upgradeHarvestByAction.set(actionId, used + result.delta);
    return result;
  }

  handleCombatEvent(type, detail) {
    if (type === "attack") {
      const actionId = this.nextNormalActionId();
      this.emit(type, Object.freeze({ ...detail, actionId }));
      return;
    }
    if (type === "claimStarted") {
      this.syncHarvestSpend("claim");
    }
    if (type === "lineChargeReleased") {
      this.syncHarvestSpend("lineCharge", detail.actionId);
    }
    if (type === "dashEnded" && detail.reason === "ended") this.resolveGraveStepPulse(detail);
    if (type === "bloodOrbitSpent") this.emitHud();
    if (type === "claimRejected" && detail.reason === "insufficientHarvest") {
      this.emitHarvestRejected("insufficientUnits", `claim:${detail.inputTime ?? "unknown"}`);
    }
    if (type === "lineChargeRejected" && detail.reason === "insufficientHarvest") {
      this.emitHarvestRejected("insufficientUnits", `lineCharge:${detail.inputTime ?? "unknown"}`);
    }
    this.emit(type, detail);
  }

  resolveGraveStepPulse(detail) {
    const graveStep = modifierTotal(this.player, "graveStep");
    if (!graveStep || !this.player || this.phase !== "playing") return false;
    const actionId = `${detail.actionId}:grave-step`;
    let hit = false;
    for (const enemy of this.director.enemies) {
      if (!this.director.isEnemyInteractive(enemy)) continue;
      const distance = Math.hypot(
        enemy.position.x - this.player.position.x,
        enemy.position.z - this.player.position.z,
      );
      if (distance > graveStep.pulseRadius + enemy.radius) continue;
      const resolution = this.director.resolveCombatHit(enemy, {
        actionId,
        damage: graveStep.pulseDamage,
        critical: false,
        direction: normalizedDirection(this.player.position, enemy.position),
        knockback: 0,
        poiseDamage: graveStep.pulsePoiseDamage,
        pullStrength: 0,
        sourcePosition: this.player.position,
        origin: "player",
      });
      if (!resolution.accepted) continue;
      hit = true;
      this.director.slowEnemy?.(enemy, graveStep.slow, graveStep.slowDurationSeconds);
    }
    if (hit) this.requestHitStop(actionId, ["claimRecall"]);
    return hit;
  }

  nextNormalActionId() {
    this.normalActionSerial += 1;
    this.activeAttackActionId = `attack-${this.normalActionSerial}`;
    return this.activeAttackActionId;
  }

  createProgressionCombatState() {
    return {
      aegisRemaining: 0,
      aegisReduction: 0,
      guaranteedCriticalReady: false,
      guaranteedCriticalActionId: null,
      actionHitTargets: new Map(),
      claimOutboundTargets: new Map(),
      claimHarvestRefunds: new Map(),
      bloodHealingByAction: new Map(),
      upgradeHarvestByAction: new Map(),
    };
  }

  resetProgressionCombatState() {
    this.progressionState = this.createProgressionCombatState();
  }

  tickProgressionState(dt) {
    const state = this.progressionState;
    const aegisBefore = state.aegisRemaining;
    state.aegisRemaining = Math.max(0, state.aegisRemaining - dt);
    if (aegisBefore > 0 && state.aegisRemaining === 0) {
      state.aegisReduction = 0;
      this.emitCombatConditions();
    }
  }

  emitCombatConditions() {
    if (!this.player) return null;
    const conditions = progressionConditionsSnapshot(this.progressionState, this.player);
    this.emit("combatConditionsChanged", { conditions });
    return conditions;
  }

  emitProgressionState() {
    const build = progressionBuildSnapshot(this.upgradeRanks);
    const conditions = this.emitCombatConditions();
    this.emit("progressionStateChanged", { build, conditions });
    return build;
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
    const state = this.progressionState;
    const phantom = modifierTotal(this.player, "phantomCircuit");
    const gravebind = modifierTotal(this.player, "gravebind");
    let phantomDamage = 0;
    if (pass === "outbound") {
      let targets = state.claimOutboundTargets.get(actionId);
      if (!targets) {
        targets = new Set();
        state.claimOutboundTargets.set(actionId, targets);
      }
      targets.add(target.id);
    } else if (pass === "recall" && state.claimOutboundTargets.get(actionId)?.has(target.id)) {
      phantomDamage = phantom?.doublePassDamage ?? 0;
    }
    const damage = definition.damage * this.player.damageMultiplier + phantomDamage;
    const pullStrength = definition.pullStrength ?? 0;
    const resolution = this.director.resolveCombatHit(target, {
      actionId,
      damage,
      critical: false,
      direction: { x: dx / length, z: dz / length },
      knockback: definition.knockback ?? 0,
      poiseDamage: definition.poiseDamage * (target.type === "queen" && pullStrength > 0 ? 1.2 : 1),
      pullStrength,
      sourcePosition,
      origin: "player",
    });
    if (resolution.accepted) this.recordProgressionHit(actionId, target, {}, false, resolution, 0);
    if (resolution.accepted && pass === "recall") this.requestHitStop(actionId, ["claimRecall"]);
    let pull = null;
    if (pass === "recall" && resolution.accepted && !resolution.defeated && target.active && target.type !== "queen") {
      pull = this.director.pullEnemyToward(target, this.combat.claim.snapshot().origin, pullStrength);
      if (gravebind && pull.applied > 0) {
        const refunded = state.claimHarvestRefunds.get(actionId) ?? 0;
        const amount = Math.min(gravebind.harvestPerSurvivor, gravebind.harvestCap - refunded);
        if (amount > 0) {
          const harvest = this.grantUpgradeHarvest(actionId, `gravebind:${target.id}`, amount);
          if (harvest.accepted) state.claimHarvestRefunds.set(actionId, refunded + harvest.delta);
        }
      }
    }
    if (resolution.accepted && resolution.defeated) {
      this.applyHarvestGain("kill", `${actionId}:${target.id}:${pass}:claim`);
    }
    return Object.freeze({
      hit: resolution.hit,
      pull,
      terminatePass: resolution.defeated && target.type === "queen",
    });
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

  applyHarvestGain(source, eventId, amount = undefined) {
    const previous = this.combat.harvest.snapshot();
    const result = this.combat.harvest.gain({ type: source, eventId }, amount);
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
    const result = this.combat.cancelPlayerActions(reason);
    this.emit("combatActionsCancelled", result);
    return result;
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
        windowClose: this.combat.activePerfectDashWindow,
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
      const eclipse = modifierTotal(this.player, "perfectEclipse");
      if (eclipse) {
        this.grantUpgradeHarvest(qualification.actionId, "eclipse", eclipse.harvestUnits);
        this.progressionState.guaranteedCriticalReady = true;
        this.progressionState.guaranteedCriticalActionId = null;
        this.emitCombatConditions();
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
    const requestedAmount = amount;
    if (this.progressionState.aegisRemaining > 0 && this.progressionState.aegisReduction > 0) {
      amount = Math.max(0, amount - this.progressionState.aegisReduction);
      this.progressionState.aegisRemaining = 0;
      this.progressionState.aegisReduction = 0;
      this.emitCombatConditions();
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
      requestedAmount,
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
        const recovery = Math.max(1, Math.round(this.player.maxHealth * Math.min(
          PROGRESSION_BALANCE_LIMITS.automaticRoomRecovery,
          RUN_CONFIG.roomRecoveryPercent,
        )));
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

  advanceRoom() {
    if (
      !this.benchmarkMode
      && !this.showcaseMode
      && !this.portalTraversal?.completed
    ) return false;
    if (this.room < RUN_CONFIG.roomsPerFloor) {
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
      {
        floor: this.floor,
        ownedOathIds: this.ownedBlessings,
        slotOrder: oathSlotOrderForSeed(this.seed),
      },
    );
    this.presentBlessings();
    return true;
  }

  presentBlessings() {
    const slotId = this.floor <= 5
      ? techniqueSlotForOathFloor(oathSlotOrderForSeed(this.seed), this.floor)
      : null;
    this.setPhase("blessing");
    this.emit("blessingOffered", {
      floor: this.floor,
      room: this.room,
      choices: Object.freeze(this.pendingBlessings.map(publicUpgradeChoice)),
      techniqueSlot: slotId,
      techniqueLabel: slotId ? TECHNIQUE_SLOTS[slotId].label : "Oath Mastery",
      selectionMode: this.floor <= 5 ? "choose" : "mastery",
      build: progressionBuildSnapshot(this.upgradeRanks),
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
    const result = applyProgressionChoice(blessing, this.player, this.upgradeRanks);
    if (!result) return;
    this.emitPlayerHeal(previousHealth, this.player.health - previousHealth, "blessing", {
      upgradeId: result.id,
    });
    this.ownedBlessings.add(blessing.id);
    this.blessingIds.push(blessing.id);
    this.pendingBlessings = [];
    this.emit("blessingChosen", result);
    this.emitProgressionState();
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
    if (shouldShowIntro) {
      this.startBookend("intro", () => {
        this.introCompleted = true;
        this.requestRoomPlay();
      });
      this.emit("introStarted", { seed: this.seed });
      return;
    }

    const shouldShowBossConfrontation = !this.benchmarkMode
      && !this.showcaseMode
      && this.runType === "normal"
      && this.arena?.boss === true
      && this.flags.bossConfrontationCompleted !== true;
    if (shouldShowBossConfrontation) {
      this.startBookend("boss.confrontation", () => {
        this.flags.bossConfrontationCompleted = true;
        this.emit("bossConfrontationCompleted", { floor: this.floor, room: this.room });
        this.requestRoomPlay();
      });
      this.emit("bossConfrontationStarted", { floor: this.floor, room: this.room });
      return;
    }

    this.requestRoomPlay();
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
    if (this.runType === "speedrun") {
      this.revealPrincessForEnding();
      return;
    }
    this.startBookend("ending.witch-death", () => this.revealPrincessForEnding());
  }

  revealPrincessForEnding() {
    const dismissed = this.director.dismissStableOrigin();
    this.endingPresentationStage = "revealHuman";
    this.emit("witchMagicCeased", { dismissed });
    this.emit("princessHumanReturned");
    if (this.runType === "speedrun") {
      this.beginEndingDecision();
      return;
    }
    return this.startBookend("ending.plea", () => this.beginEndingDecision());
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

    this.startBookend("ending.timeout", () => this.completeTimeoutStrike(ending));
  }

  completeTimeoutStrike(ending = "timeout") {
    this.flags.princeKilledByPrincess = true;
    this.player.health = 0;
    this.emitHud();
    this.emit("playerKilledByPrincess", { ending });
    return this.startBookend("ending.timeout-final", () => this.beginEndingFade());
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
      this.emit("corruptionDestroyed", { ending: "kill", method: "pairedRingBond" });
      this.beginEndingFade();
      return;
    }
    this.startBookend("ending.kill", () => {
      this.emit("princessKilled", { ending: "kill" });
      this.emit("corruptionDestroyed", { ending: "kill", method: "pairedRingBond" });
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
    if (["playing", "blessing", "endingChoice", "endingStrike"].includes(this.phase)) {
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
      this.resetProgressionCombatState();
    }
    this.emit("phaseChanged", { phase });
  }

  emitHud() {
    if (!this.player) return;
    const build = progressionBuildSnapshot(this.upgradeRanks);
    const conditions = progressionConditionsSnapshot(this.progressionState, this.player);
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
      build,
      progressionState: build,
      conditions,
      combatConditions: conditions,
    });
  }

  findSoftTarget(rawAngle) {
    let best = null;
    let bestScore = Infinity;
    for (const enemy of this.director.enemies) {
      if (!this.director.isEnemyInteractive(enemy)) continue;
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

  enterOathShowcase(seed = "SHOWCASE-OATH") {
    this.startRun(seed);
    this.showcaseMode = "oath";
    this.introCompleted = true;
    this.resetPresentationState();
    this.director.clearEncounter("oathShowcase");
    this.floor = 1;
    this.room = RUN_CONFIG.roomsPerFloor;
    this.pendingBlessings = chooseBlessings(
      this.rng.fork("oath-showcase"),
      this.upgradeRanks,
      3,
      this.player,
      {
        floor: this.floor,
        ownedOathIds: this.ownedBlessings,
        slotOrder: oathSlotOrderForSeed(this.seed),
      },
    );
    this.presentBlessings();
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
    this.director.clearEncounter("endingShowcase");
    this.flags.queenDefeated = true;
    this.endingPresentationStage = "witchDeath";
    this.player.invulnerable = Number.POSITIVE_INFINITY;
    this.startBookend("ending.witch-death", () => this.revealPrincessForEnding());
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
