import { circleIntersectsArc, moveCircle, separateCircles } from "./collision.js";
import { AttackCoordinator } from "./AttackCoordinator.js";
import {
  ENEMY_ARCHETYPES,
  NON_BOSS_ARCHETYPE_IDS,
  PROJECTILE_KINDS,
  getEnemyArchetype,
} from "./enemyArchetypes.js";
import {
  createQueenPatternState,
  nextQueenAction,
  queenPhaseForHealth,
  queenPhaseTiming,
  QUEEN_SUMMON_CAP,
  QUEEN_MIN_WINDUP_SECONDS,
} from "./bossPatterns.js";
import { createEncounterPlan, ENEMY_ORIGINS } from "./encounterPatterns.js";
import {
  ENEMY_LIFECYCLE_STATES,
  ENEMY_EMERGENCE,
  advanceEmergence,
  createEmergenceState,
  isEnemyInteractive as lifecycleIsInteractive,
} from "./encounterContracts.js";
import {
  isCircleWalkable,
  isWalkableSegment,
  nearestWalkablePoint,
} from "./arenaGeometry.js";
import { DIFFICULTY, RUN_CONFIG, resolveEnemyStatScalars } from "./gameConfig.js";
import { findNavigationPath, hasLineOfSight } from "./navigation.js";
import { EncounterScheduler } from "../playtest/EncounterScheduler.js";

const PROJECTILE_POOL_SIZE = 144;
const BOMBADIER_ATTACK_SPACING = 1.15;
const STANDARD_DIFFICULTY = DIFFICULTY.standard;
const MAX_CLAIM_PULL = 3.2;
const MAX_TRACKED_PLAYER_SPEED = 28;
const ENEMY_PATH_CELL_SIZE = 1.1;
const ENEMY_PATH_CLEARANCE = 0.16;
const ENEMY_PATH_TARGET_THRESHOLD = 2.75;
const ENEMY_PATH_REFRESH_SECONDS = 0.65;
const POISE_RECOVERY_DELAY = 1.05;
const POISE_RECOVERY_PER_SECOND = 0.34;
const QUEEN_PHASE_THREE_GUARD_CAP = 0;
const QUEEN_SPECIAL_TIMING = Object.freeze({
  teleport: Object.freeze({ anticipation: 0.48, recovery: 0.24, cooldown: 0.75, radius: 1.35 }),
  summon: Object.freeze({ anticipation: 0.68, recovery: 0.42, cooldown: 2, radius: 3.2 }),
});
const RESISTANCE_BY_TYPE = Object.freeze({
  thrall: "light",
  wraith: "light",
  hexer: "light",
  reaver: "medium",
  bombardier: "medium",
  boneguard: "heavy",
  queen: "boss",
});
const POISE_BY_RESISTANCE = Object.freeze({ light: 42, medium: 68, heavy: 118, boss: 240 });
const PULL_MULTIPLIER = Object.freeze({ light: 1, medium: 0.58, heavy: 0.18, boss: 0 });
const STAGGER_DURATION = Object.freeze({ light: 0.42, medium: 0.32, heavy: 0.22, boss: 0.14 });
const ATTACK_FAMILY_BY_KIND = Object.freeze({
  lunge: "melee",
  graveCleave: "melee",
  dashLane: "melee",
  crosscut: "melee",
  guardCharge: "melee",
  shieldSlam: "melee",
  aimedBolt: "ranged",
  fan: "ranged",
  rune: "area",
  blinkFlank: "melee",
  veilSweep: "melee",
  lobbedBomb: "area",
  cinderBurst: "ranged",
  royalVolley: "ranged",
  royalFan: "ranged",
  royalLance: "ranged",
  royalSlam: "melee",
  royalDash: "melee",
  voidWell: "area",
});

function completeDifficultyProfile(profile) {
  if (profile?.id && profile.attackBudgets && profile.nonBossStats && profile.bossStats) return profile;
  const enemyHealth = profile?.enemyHealth ?? STANDARD_DIFFICULTY.enemyHealth;
  const enemyDamage = profile?.enemyDamage ?? STANDARD_DIFFICULTY.enemyDamage;
  const enemySpeed = profile?.enemySpeed ?? STANDARD_DIFFICULTY.enemySpeed;
  return {
    ...STANDARD_DIFFICULTY,
    ...profile,
    id: profile?.id ?? STANDARD_DIFFICULTY.id,
    attackBudgets: profile?.attackBudgets ?? STANDARD_DIFFICULTY.attackBudgets,
    nonBossStats: profile?.nonBossStats ?? {
      health: enemyHealth,
      damage: enemyDamage,
      speed: enemySpeed,
    },
    bossStats: profile?.bossStats ?? {
      health: enemyHealth,
      damage: enemyDamage,
      speed: enemySpeed,
    },
  };
}

function normalize(dx, dz) {
  const distance = Math.hypot(dx, dz);
  if (distance < 0.0001) return { x: 1, z: 0, distance: 0 };
  return { x: dx / distance, z: dz / distance, distance };
}

function clonePosition(position) {
  return { x: position.x, z: position.z };
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isInsideCircle(origin, radius, target, targetRadius = 0) {
  return distanceBetween(origin, target) <= radius + targetRadius;
}

function isInsideLane(origin, direction, range, width, target, targetRadius = 0) {
  const offsetX = target.x - origin.x;
  const offsetZ = target.z - origin.z;
  const forward = offsetX * direction.x + offsetZ * direction.z;
  if (forward < -targetRadius || forward > range + targetRadius) return false;
  const lateral = Math.abs(offsetX * -direction.z + offsetZ * direction.x);
  return lateral <= width * 0.5 + targetRadius;
}

function segmentDistanceSquared(start, end, point) {
  const lineX = end.x - start.x;
  const lineZ = end.z - start.z;
  const lengthSquared = lineX * lineX + lineZ * lineZ;
  if (lengthSquared < 0.000001) {
    const dx = point.x - start.x;
    const dz = point.z - start.z;
    return dx * dx + dz * dz;
  }
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * lineX + (point.z - start.z) * lineZ) / lengthSquared));
  const nearestX = start.x + lineX * progress;
  const nearestZ = start.z + lineZ * progress;
  const dx = point.x - nearestX;
  const dz = point.z - nearestZ;
  return dx * dx + dz * dz;
}

function immutablePoint(point) {
  return Object.freeze({ x: point.x, z: point.z });
}

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.z);
}

function createProjectile() {
  return {
    id: null,
    active: false,
    origin: ENEMY_ORIGINS.STABLE,
    kind: PROJECTILE_KINDS.HEX_BOLT,
    mode: "direct",
    sourceType: "hexer",
    actionId: null,
    ownerEnemyId: null,
    ownerEnemyType: null,
    ownerEnemyOrigin: ENEMY_ORIGINS.STABLE,
    position: { x: 0, z: 0 },
    previousPosition: { x: 0, z: 0 },
    target: { x: 0, z: 0 },
    velocity: { x: 0, z: 0 },
    radius: 0.25,
    areaRadius: 0,
    damage: 0,
    life: 0,
    totalLife: 0,
    height: 0,
    color: "violet",
  };
}

export class EnemyDirector {
  constructor(emit) {
    this.emit = emit;
    this.enemies = [];
    this.projectiles = Array.from({ length: PROJECTILE_POOL_SIZE }, createProjectile);
    this.nextEnemyId = 1;
    this.nextEnemyActionId = 1;
    this.nextDamageAttemptId = 1;
    this.nextProjectileId = 1;
    this.resolvedProjectileActions = new Set();
    this.arena = null;
    this.rng = null;
    this.difficulty = STANDARD_DIFFICULTY;
    this.attackCoordinator = new AttackCoordinator();
    this.bossModifiers = { health: 0, enrage: 0 };
    this.bombardierAttackCooldown = 0;
    this.encounterPlan = null;
    this.encounterScheduler = null;
    this.schedulerEnemyActors = new Map();
    this.pendingWaves = [];
    this.waveDelay = 0;
    this.encounterFloor = 1;
    this.queenPatternState = null;
    this.stableOriginDismissed = false;
    this.currentPlayer = null;
  }

  reset({ arena, floor, room, rng, difficulty, bossModifiers = {}, previousRecipeType = null }) {
    this.attackCoordinator.reset("encounterReset");
    this.enemies.length = 0;
    this.deactivateProjectiles();
    this.resolvedProjectileActions.clear();
    this.arena = arena;
    this.rng = rng;
    this.difficulty = completeDifficultyProfile(difficulty);
    this.bossModifiers = { health: bossModifiers.health ?? 0, enrage: bossModifiers.enrage ?? 0 };
    this.bombardierAttackCooldown = 0;
    this.encounterFloor = floor;
    this.encounterPlan = null;
    this.encounterScheduler = null;
    this.schedulerEnemyActors.clear();
    this.pendingWaves.length = 0;
    this.waveDelay = 0;
    this.queenPatternState = createQueenPatternState(rng.fork("queen-patterns"));
    this.stableOriginDismissed = false;
    this.currentPlayer = null;

    if (arena.boss) {
      this.spawnEnemy("queen", { x: 0, z: 2.5 }, floor, { origin: ENEMY_ORIGINS.STABLE });
      return;
    }

    this.encounterPlan = createEncounterPlan({
      floor,
      room,
      spawnPoints: arena.enemySpawnPoints,
      rng: rng.fork("plan"),
      difficulty: this.difficulty,
      layout: arena,
      layoutFamily: arena.layoutFamily,
      previousRecipeType,
    });
    this.pendingWaves = [...this.encounterPlan.waves];
    const originCounts = this.encounterPlan.batches
      .flatMap((batch) => batch.entries)
      .reduce((counts, entry) => {
        counts[entry.origin] += 1;
        return counts;
      }, { [ENEMY_ORIGINS.STABLE]: 0, [ENEMY_ORIGINS.VOLATILE]: 0 });
    this.emit("encounterPlanned", {
      floor,
      room,
      layoutFamily: this.encounterPlan.layoutFamily,
      recipeId: this.encounterPlan.id,
      recipeType: this.encounterPlan.type,
      totalPopulation: this.encounterPlan.totalPopulation,
      pendingPopulation: this.encounterPlan.totalPopulation,
      threat: this.encounterPlan.threat,
      roles: this.encounterPlan.roleCounts,
      specialistCounts: this.encounterPlan.specialistCounts,
      originCounts,
      recipe: this.encounterPlan,
    });

    const queuedEvents = [];
    this.encounterScheduler = new EncounterScheduler(this.encounterPlan, {
      floor,
      room,
      layoutFamily: this.encounterPlan.layoutFamily,
      onEvent: (type, detail, atSeconds) => {
        if (!this.encounterScheduler) queuedEvents.push({ type, detail, atSeconds });
        else this.handleSchedulerEvent(type, detail, atSeconds);
      },
    });
    for (const event of queuedEvents) this.handleSchedulerEvent(event.type, event.detail, event.atSeconds);
  }

  spawnEnemy(type, position, floor = 1, options = {}) {
    const definition = getEnemyArchetype(type);
    const requestedOrigin = options.origin ?? ENEMY_ORIGINS.STABLE;
    if (!Object.values(ENEMY_ORIGINS).includes(requestedOrigin)) throw new RangeError(`Unknown enemy origin: ${requestedOrigin}`);
    const origin = type === "queen" ? ENEMY_ORIGINS.STABLE : requestedOrigin;
    const stats = definition.stats;
    const difficulty = completeDifficultyProfile(this.difficulty);
    const statScalars = resolveEnemyStatScalars({ type, floor, difficulty });
    const bossHealth = type === "queen" ? 1 + this.bossModifiers.health : 1;
    const maxHealth = Math.round(stats.maxHealth * statScalars.health * bossHealth);
    const id = this.nextEnemyId++;
    const resistanceClass = RESISTANCE_BY_TYPE[type];
    const maxPoise = Math.round(POISE_BY_RESISTANCE[resistanceClass] * difficulty.poiseMultiplier);
    const enemy = {
      id,
      type,
      origin,
      originPhase: Number.isFinite(options.originPhase)
        ? options.originPhase
        : (id * 2.399963229728653) % (Math.PI * 2),
      formationIndex: options.formationIndex ?? 0,
      dismissed: false,
      modelKey: definition.modelKey,
      behavior: definition.behavior,
      active: true,
      lifecycle: options.lifecycle ?? {
        state: ENEMY_LIFECYCLE_STATES.ACTIVE,
        startedAtSeconds: 0,
        elapsedSeconds: ENEMY_EMERGENCE.durationSeconds,
        remainingSeconds: 0,
      },
      schedulerEnemyId: options.schedulerEnemyId ?? null,
      lifecycleManagedByScheduler: Boolean(options.schedulerEnemyId),
      position: clonePosition(position),
      previousPosition: clonePosition(position),
      facing: { x: 0, z: 1 },
      radius: stats.radius,
      maxHealth,
      health: maxHealth,
      resistanceClass,
      maxPoise,
      poise: maxPoise,
      poiseRecoveryDelay: 0,
      speed: stats.speed * statScalars.speed * (type === "queen" ? 1 + this.bossModifiers.enrage : 1),
      damage: stats.damage * statScalars.damage,
      attackRange: stats.attackRange,
      attackCooldown: this.rng?.float(0.12, 0.42) ?? 0.25,
      attackWindup: 0,
      attackPending: false,
      attackKind: null,
      attackActionId: null,
      attackLeaseId: null,
      attackLeaseFamily: null,
      attackTarget: clonePosition(position),
      attackDirection: { x: 1, z: 0 },
      state: "chase",
      actionTimer: 0,
      actionHit: false,
      actionSpeed: 0,
      strafeDirection: this.rng?.chance(0.5) ? 1 : -1,
      hitFlash: 0,
      progressionSlowTimer: 0,
      progressionSpeedMultiplier: 1,
      knockback: { x: 0, z: 0 },
      bossPhase: 1,
      decisionTimer: this.rng?.float(0, 0.18) ?? 0,
      navigationPath: [],
      navigationIndex: 0,
      navigationTarget: null,
      navigationRefresh: (id % 12) * 0.04,
      lastAttackKind: null,
      comboSerial: 0,
      comboPending: null,
      attackComboMeta: null,
      queenActionMeta: null,
      queenSpecialKind: null,
      queenSpecialStage: null,
      queenSpecialActionId: null,
      queenSpecialTarget: null,
    };
    this.enemies.push(enemy);
    this.emit("enemySpawned", {
      id: enemy.id,
      ...(enemy.schedulerEnemyId ? { enemyId: enemy.schedulerEnemyId } : {}),
      type: enemy.type,
      origin: enemy.origin,
      originPhase: enemy.originPhase,
      formationIndex: enemy.formationIndex,
      position: clonePosition(enemy.position),
      lifecycleState: enemy.lifecycle.state,
      emergenceDurationSeconds: enemy.lifecycle.state === ENEMY_LIFECYCLE_STATES.EMERGING
        ? ENEMY_EMERGENCE.durationSeconds
        : 0,
    });
    return enemy;
  }

  update(dt, player, resolvePlayerDamage) {
    this.currentPlayer = player;
    // Encounter triggers are intentionally time/defeat driven; player position only repairs overlap at placement.
    this.encounterScheduler?.advance(dt);
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.lifecycleManagedByScheduler || enemy.lifecycle.state !== ENEMY_LIFECYCLE_STATES.EMERGING) continue;
      if (!advanceEmergence(enemy.lifecycle, dt)) continue;
      this.emit("enemyEmergenceCompleted", {
        floor: this.encounterFloor,
        enemyId: enemy.schedulerEnemyId ?? enemy.id,
        runtimeEnemyId: enemy.id,
        type: enemy.type,
        durationSeconds: ENEMY_EMERGENCE.durationSeconds,
        position: clonePosition(enemy.position),
      });
    }
    this.bombardierAttackCooldown = Math.max(0, this.bombardierAttackCooldown - dt);
    for (const enemy of this.enemies) {
      if (!this.isEnemyInteractive(enemy)) this.releaseAttackLease(enemy, enemy.active ? "emerging" : "inactive");
    }
    this.beginAttackStep();
    for (const enemy of this.enemies) {
      if (!this.isEnemyInteractive(enemy)) continue;
      enemy.previousPosition.x = enemy.position.x;
      enemy.previousPosition.z = enemy.position.z;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.progressionSlowTimer = Math.max(0, (enemy.progressionSlowTimer ?? 0) - dt);
      if (enemy.progressionSlowTimer <= 0) enemy.progressionSpeedMultiplier = 1;
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      if (enemy.comboPending) enemy.comboPending.window = Math.max(0, enemy.comboPending.window - dt);
      this.updatePoise(enemy, dt);

      if (this.updateStagger(enemy, dt)) continue;
      if (enemy.type === "queen" && this.updateQueenPhase(enemy, dt)) continue;
      if (this.updateKnockback(enemy, dt)) continue;
      if (this.updateDash(enemy, dt, player, resolvePlayerDamage)) continue;
      this.updateEnemyBehavior(enemy, dt, player, resolvePlayerDamage);
    }

    separateCircles(this.enemies, this.arena, (enemy) => this.isEnemyInteractive(enemy));
    this.updateProjectiles(dt, player, resolvePlayerDamage);
  }

  isEnemyInteractive(enemy) {
    return Boolean(enemy?.active && lifecycleIsInteractive(enemy));
  }

  handleSchedulerEvent(type, detail, atSeconds) {
    if (type === "enemyDefeated") return;
    if (type === "encounterBatchTriggered") {
      this.pendingWaves = this.pendingWaves.filter((wave) => wave.id !== detail.batchId);
      const batch = this.encounterPlan?.batches.find((entry) => entry.id === detail.batchId);
      const originCounts = (batch?.entries ?? []).reduce((counts, entry) => {
        counts[entry.origin] += 1;
        return counts;
      }, { [ENEMY_ORIGINS.STABLE]: 0, [ENEMY_ORIGINS.VOLATILE]: 0 });
      this.emit(type, {
        ...detail,
        atSeconds,
        types: batch?.entries.map((entry) => entry.type) ?? [],
        entries: batch?.entries ?? [],
        originCounts,
      });
      return;
    }
    if (type === "enemyEmergenceStarted") {
      const scheduledEnemy = this.encounterScheduler?.enemies.get(detail.enemyId);
      if (!scheduledEnemy) return;
      if (this.stableOriginDismissed && scheduledEnemy.entry.origin === ENEMY_ORIGINS.STABLE) {
        this.encounterScheduler.killEnemy(scheduledEnemy.id);
        return;
      }
      const enemy = this.spawnScheduledEnemy(scheduledEnemy);
      this.schedulerEnemyActors.set(scheduledEnemy.id, enemy);
      const playerPosition = this.currentPlayer?.position ?? this.arena.playerSpawn ?? { x: 0, z: 0 };
      this.emit(type, {
        ...detail,
        atSeconds,
        runtimeEnemyId: enemy.id,
        position: clonePosition(enemy.position),
        playerPosition: clonePosition(playerPosition),
        playerDistance: distanceBetween(enemy.position, playerPosition),
      });
      return;
    }
    if (type === "enemyEmergenceCompleted") {
      const enemy = this.schedulerEnemyActors.get(detail.enemyId);
      if (!enemy?.active) return;
      this.emit(type, {
        ...detail,
        atSeconds,
        runtimeEnemyId: enemy.id,
        position: clonePosition(enemy.position),
      });
      return;
    }
    this.emit(type, { ...detail, atSeconds });
  }

  spawnScheduledEnemy(scheduledEnemy) {
    const entry = scheduledEnemy.entry;
    const spawnPoints = this.arena.enemySpawnPoints ?? [];
    const fallback = { x: entry.formationIndex ?? 0, z: 4 };
    const spawn = spawnPoints[entry.spawnIndex % Math.max(1, spawnPoints.length)] ?? fallback;
    const definition = getEnemyArchetype(entry.type);
    const requested = entry.origin === ENEMY_ORIGINS.VOLATILE
      ? {
        x: spawn.x + Math.cos(entry.originPhase) * 0.55,
        z: spawn.z + Math.sin(entry.originPhase) * 0.55,
      }
      : spawn;
    const position = this.findSpawnPoint(requested, definition.stats.radius, entry.originPhase);
    return this.spawnEnemy(entry.type, position, this.encounterFloor, {
      ...entry,
      lifecycle: scheduledEnemy.lifecycle,
      schedulerEnemyId: scheduledEnemy.id,
    });
  }

  findSpawnPoint(requested, radius, phase = 0) {
    const player = this.currentPlayer ?? {
      position: this.arena.playerSpawn ?? { x: 0, z: 0 },
      radius: 0.58,
    };
    const open = this.findOpenPoint(requested, radius);
    const minimum = radius + player.radius + 0.08;
    if (distanceBetween(open, player.position) >= minimum) return open;
    const candidates = [];
    for (let ring = 0; ring < 3; ring += 1) {
      const distance = minimum + ring * 0.45;
      for (let index = 0; index < 24; index += 1) {
        const angle = phase + (index / 24) * Math.PI * 2;
        const candidate = {
          x: player.position.x + Math.cos(angle) * distance,
          z: player.position.z + Math.sin(angle) * distance,
        };
        if (!this.isOpenPoint(candidate, radius)) continue;
        candidates.push(candidate);
      }
      if (candidates.length > 0) break;
    }
    candidates.sort((left, right) => (
      distanceBetween(left, requested) - distanceBetween(right, requested)
      || left.x - right.x
      || left.z - right.z
    ));
    return candidates[0] ?? open;
  }

  updateKnockback(enemy, dt) {
    const speed = Math.hypot(enemy.knockback.x, enemy.knockback.z);
    if (speed <= 0.2) return false;
    this.clearEnemyPath(enemy);
    enemy.position = moveCircle(enemy.position, enemy.knockback, dt, enemy.radius, this.arena);
    const decay = Math.exp(-11 * dt);
    enemy.knockback.x *= decay;
    enemy.knockback.z *= decay;
    return true;
  }

  updatePoise(enemy, dt) {
    const recoveryTime = Math.max(0, dt - enemy.poiseRecoveryDelay);
    enemy.poiseRecoveryDelay = Math.max(0, enemy.poiseRecoveryDelay - dt);
    if (recoveryTime <= 0 || enemy.poise >= enemy.maxPoise) return;
    enemy.poise = Math.min(enemy.maxPoise, enemy.poise + enemy.maxPoise * POISE_RECOVERY_PER_SECOND * recoveryTime);
  }

  updateStagger(enemy, dt) {
    if (enemy.state !== "staggered") return false;
    enemy.actionTimer = Math.max(0, enemy.actionTimer - dt);
    if (enemy.actionTimer <= 0) {
      enemy.state = "chase";
      enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.22);
    }
    return true;
  }

  updateEnemyBehavior(enemy, dt, player, resolvePlayerDamage) {
    if (enemy.type === "queen" && this.updateQueenSpecial(enemy, dt)) return;
    if (this.updateWindup(enemy, dt, player, resolvePlayerDamage)) return;
    if (this.updateComboIntent(enemy, dt, player)) return;
    switch (enemy.type) {
      case "thrall":
        this.updateThrall(enemy, dt, player);
        break;
      case "reaver":
        this.updateReaver(enemy, dt, player);
        break;
      case "boneguard":
        this.updateBoneguard(enemy, dt, player);
        break;
      case "hexer":
        this.updateHexer(enemy, dt, player);
        break;
      case "wraith":
        this.updateWraith(enemy, dt, player);
        break;
      case "bombardier":
        this.updateBombardier(enemy, dt, player);
        break;
      case "queen":
        this.updateQueen(enemy, dt, player);
        break;
      default:
        throw new RangeError(`Unsupported enemy behavior: ${enemy.type}`);
    }
  }

  updateThrall(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance <= 1.9 ? "graveCleave" : "lunge";
      if (this.beginTrackedAttack(enemy, attack, player)) return;
    }
    this.pursueEngagementSlot(enemy, player, 1.35, dt);
  }

  updateReaver(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance <= 2.55 ? "crosscut" : "dashLane";
      if (this.beginTrackedAttack(enemy, attack, player)) return;
    }
    this.steerAtRange(enemy, toPlayer, 4.5, 7.2, dt);
  }

  updateBoneguard(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance > 3.35 ? "guardCharge" : "shieldSlam";
      if (this.beginTrackedAttack(enemy, attack, player)) return;
    }
    this.pursueEngagementSlot(enemy, player, 2.2, dt);
  }

  updateHexer(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      let spell;
      if (toPlayer.distance < 5.6) spell = enemy.lastAttackKind === "rune" ? "fan" : "rune";
      else if (toPlayer.distance > 8.2) spell = enemy.lastAttackKind === "aimedBolt" ? "fan" : "aimedBolt";
      else spell = enemy.lastAttackKind === "fan" ? "aimedBolt" : "fan";
      if (this.beginTrackedAttack(enemy, spell, player)) return;
    }
    this.steerAtRange(enemy, toPlayer, 6.1, 9, dt);
  }

  updateWraith(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      if (toPlayer.distance <= 3.15) {
        if (this.beginTrackedAttack(enemy, "veilSweep", player)) return;
        this.steerAtRange(enemy, toPlayer, 4.2, 7.2, dt);
        return;
      }
      const sideX = -toPlayer.z * enemy.strafeDirection;
      const sideZ = toPlayer.x * enemy.strafeDirection;
      const target = this.findOpenPoint({ x: player.position.x + sideX * 1.85, z: player.position.z + sideZ * 1.85 }, enemy.radius);
      const direction = normalize(target.x - enemy.position.x, target.z - enemy.position.z);
      if (this.beginAttack(enemy, "blinkFlank", target, direction)) {
        enemy.strafeDirection *= -1;
        return;
      }
    }
    this.steerAtRange(enemy, toPlayer, 4.2, 7.2, dt);
  }

  updateBombardier(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && this.bombardierAttackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance < 7.2 ? "cinderBurst" : "lobbedBomb";
      if (this.beginTrackedAttack(enemy, attack, player)) {
        this.bombardierAttackCooldown = BOMBADIER_ATTACK_SPACING * this.currentDifficulty().cooldownMultiplier;
        return;
      }
    }
    this.steerAtRange(enemy, toPlayer, 7, 10, dt);
  }

  updateQueen(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0) {
      const action = this.chooseQueenAction(enemy);
      if (action === "teleport") {
        this.beginQueenSpecial(enemy, action);
      } else if (action === "summon") {
        this.beginQueenSpecial(enemy, action);
      } else {
        if (!this.beginTrackedAttack(enemy, action, player)) {
          if (toPlayer.distance > 5) this.moveEnemyToward(enemy, player.position, enemy.speed, dt);
        }
      }
      return;
    }
    if (toPlayer.distance > 5) this.moveEnemyToward(enemy, player.position, enemy.speed, dt);
  }

  chooseQueenAction(enemy) {
    const guardCount = this.enemies.filter((actor) => actor.active && actor.type !== "queen").length;
    const hazardCount = this.activeQueenHazardCount();
    if (!this.queenPatternState) this.queenPatternState = createQueenPatternState(this.rng.fork("queen-patterns"));
    const action = nextQueenAction(this.queenPatternState, enemy.bossPhase, { guardCount, hazardCount });
    enemy.queenActionMeta = this.queenPatternState.lastActionMeta;
    return action;
  }

  updateQueenPhase(enemy, dt) {
    const targetPhase = queenPhaseForHealth(enemy.health, enemy.maxHealth);
    if (targetPhase > enemy.bossPhase && enemy.state !== "phaseTransition") {
      const phase = Math.min(targetPhase, enemy.bossPhase + 1);
      if (enemy.queenSpecialActionId) {
        this.emit("queenSpecialCancelled", this.queenSpecialEventDetail(enemy, {
          reason: "phaseTransition",
        }));
      }
      this.clearEnemyCommitment(enemy, "phaseTransition");
      enemy.bossPhase = phase;
      enemy.state = "phaseTransition";
      enemy.actionTimer = 0.82;
      enemy.attackCooldown = this.scaleAttackCooldown(enemy, 0.82);
      this.deactivateProjectilesFrom("queen");
      const dismissedGuards = phase === 3 ? this.dismissQueenGuards(enemy) : null;
      this.emit("bossPhaseChanged", {
        enemyId: enemy.id,
        origin: enemy.origin,
        phase,
        duration: enemy.actionTimer,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        position: clonePosition(enemy.position),
        dismissedGuards,
      });
    }
    if (enemy.state !== "phaseTransition") return false;
    enemy.actionTimer = Math.max(0, enemy.actionTimer - dt);
    if (enemy.actionTimer <= 0) {
      enemy.state = "chase";
      enemy.attackCooldown = this.scaleAttackCooldown(enemy, 0.18);
    }
    return true;
  }

  beginQueenSpecial(enemy, kind) {
    const timing = QUEEN_SPECIAL_TIMING[kind];
    if (!timing || (kind === "summon" && enemy.bossPhase >= 3)) return false;
    const actionId = `enemy-action-${this.nextEnemyActionId++}`;
    const target = kind === "teleport" ? this.planQueenTeleport(enemy) : clonePosition(enemy.position);
    const duration = this.scaleAttackWindup(enemy, timing.anticipation);
    enemy.state = "queenSpecial";
    enemy.actionTimer = duration;
    enemy.attackActionId = actionId;
    enemy.attackKind = kind;
    enemy.queenSpecialKind = kind;
    enemy.queenSpecialStage = "anticipation";
    enemy.queenSpecialActionId = actionId;
    enemy.queenSpecialTarget = target;
    const direction = normalize(target.x - enemy.position.x, target.z - enemy.position.z);
    const telegraph = {
      actionId,
      enemyId: enemy.id,
      type: enemy.type,
      enemyOrigin: enemy.origin,
      attack: kind,
      shape: kind === "teleport" ? "blink" : "circle",
      position: clonePosition(enemy.position),
      origin: clonePosition(enemy.position),
      target: clonePosition(target),
      direction: { x: direction.x, z: direction.z },
      radius: timing.radius,
      width: 0,
      duration,
      bossPhase: enemy.bossPhase,
      ...this.queenComboDetail(enemy.queenActionMeta),
    };
    this.emit("enemyTelegraph", telegraph);
    this.emit("queenSpecialAnticipated", this.queenSpecialEventDetail(enemy, {
      duration,
      target: clonePosition(target),
    }));
    return actionId;
  }

  updateQueenSpecial(enemy, dt) {
    if (enemy.state !== "queenSpecial") return false;
    enemy.actionTimer = Math.max(0, enemy.actionTimer - dt);
    if (enemy.actionTimer > 0) return true;

    if (enemy.queenSpecialStage === "anticipation") {
      const kind = enemy.queenSpecialKind;
      const timing = QUEEN_SPECIAL_TIMING[kind];
      this.emit("queenSpecialReleased", this.queenSpecialEventDetail(enemy, {
        stage: "release",
        target: clonePosition(enemy.queenSpecialTarget),
      }));
      if (kind === "teleport") this.teleportQueen(enemy, enemy.queenSpecialTarget, enemy.queenSpecialActionId);
      if (kind === "summon") this.summonQueenGuard(enemy, enemy.queenSpecialActionId);
      this.emit("enemyAttack", {
        actionId: enemy.queenSpecialActionId,
        enemyId: enemy.id,
        type: enemy.type,
        origin: enemy.origin,
        attack: kind,
        shape: kind === "teleport" ? "blink" : "circle",
        position: clonePosition(enemy.position),
        target: clonePosition(enemy.queenSpecialTarget),
        direction: clonePosition(enemy.facing),
        radius: timing.radius,
        width: 0,
        bossPhase: enemy.bossPhase,
        ...this.queenComboDetail(enemy.queenActionMeta),
      });
      enemy.lastAttackKind = kind;
      enemy.attackCooldown = this.scaleAttackCooldown(enemy, timing.cooldown, {
        comboContinues: enemy.queenActionMeta?.continuesCombo === true,
      });
      enemy.queenSpecialStage = "recovery";
      enemy.actionTimer = timing.recovery;
      return true;
    }

    this.emit("queenSpecialRecovered", this.queenSpecialEventDetail(enemy));
    enemy.state = "chase";
    this.clearQueenSpecial(enemy);
    return true;
  }

  queenSpecialEventDetail(enemy, extra = {}) {
    return {
      actionId: enemy.queenSpecialActionId,
      enemyId: enemy.id,
      type: enemy.type,
      origin: enemy.origin,
      action: enemy.queenSpecialKind,
      stage: enemy.queenSpecialStage,
      phase: enemy.bossPhase,
      position: clonePosition(enemy.position),
      ...this.queenComboDetail(enemy.queenActionMeta),
      ...extra,
    };
  }

  queenComboDetail(meta) {
    return {
      comboId: meta?.comboId ?? null,
      comboStep: meta?.comboStep ?? 0,
      comboLength: meta?.comboLength ?? 0,
      continuesCombo: meta?.continuesCombo === true,
    };
  }

  enemyComboDetail(meta) {
    return {
      comboId: meta?.comboId ?? null,
      comboStep: meta?.comboStep ?? 0,
      comboLength: meta?.comboLength ?? 0,
      continuesCombo: meta?.continuesCombo === true,
    };
  }

  attackComboDetail(enemy, comboMeta = enemy.attackComboMeta) {
    return enemy.type === "queen"
      ? this.queenComboDetail(enemy.queenActionMeta)
      : this.enemyComboDetail(comboMeta);
  }

  planQueenTeleport(enemy) {
    const point = this.rng.pick(this.arena.enemySpawnPoints) ?? { x: 0, z: 0 };
    return this.findOpenPoint({ x: point.x * 0.72, z: point.z * 0.72 }, enemy.radius);
  }

  teleportQueen(enemy, plannedTarget = null, actionId = null) {
    const previousPosition = clonePosition(enemy.position);
    const target = plannedTarget ?? this.planQueenTeleport(enemy);
    this.clearEnemyPath(enemy);
    enemy.position.x = target.x;
    enemy.position.z = target.z;
    enemy.previousPosition.x = target.x;
    enemy.previousPosition.z = target.z;
    this.emit("queenTeleport", {
      actionId,
      enemyId: enemy.id,
      type: enemy.type,
      origin: enemy.origin,
      phase: enemy.bossPhase,
      position: clonePosition(enemy.position),
      previousPosition,
      ...this.queenComboDetail(enemy.queenActionMeta),
    });
    return target;
  }

  summonQueenGuard(enemy, actionId = null) {
    if (enemy.bossPhase >= 3) return [];
    const summonTypes = ["thrall", "reaver", "wraith"];
    const activeGuards = this.enemies.filter((actor) => actor.active && actor.type !== "queen").length;
    const availableSlots = Math.max(0, QUEEN_SUMMON_CAP - activeGuards);
    const selectedTypes = summonTypes.slice(0, availableSlots);
    for (let index = 0; index < selectedTypes.length; index += 1) {
      const angle = (index / Math.max(1, selectedTypes.length)) * Math.PI * 2;
      const position = this.findOpenPoint({
        x: enemy.position.x + Math.cos(angle) * 3,
        z: enemy.position.z + Math.sin(angle) * 3,
      }, getEnemyArchetype(selectedTypes[index]).stats.radius);
      const guard = this.spawnEnemy(selectedTypes[index], position, 10, {
        origin: enemy.origin,
        formationIndex: index,
        lifecycle: createEmergenceState(0),
      });
      const playerPosition = this.currentPlayer?.position ?? this.arena.playerSpawn ?? { x: 0, z: 0 };
      this.emit("enemyEmergenceStarted", {
        floor: this.encounterFloor,
        enemyId: guard.id,
        runtimeEnemyId: guard.id,
        type: guard.type,
        origin: guard.origin,
        durationSeconds: ENEMY_EMERGENCE.durationSeconds,
        position: clonePosition(guard.position),
        playerPosition: clonePosition(playerPosition),
        playerDistance: distanceBetween(guard.position, playerPosition),
      });
    }
    this.emit("queenSummon", {
      actionId,
      enemyId: enemy.id,
      type: enemy.type,
      origin: enemy.origin,
      phase: enemy.bossPhase,
      position: clonePosition(enemy.position),
      types: selectedTypes,
      ...this.queenComboDetail(enemy.queenActionMeta),
    });
    return selectedTypes;
  }

  dismissQueenGuards(queen) {
    const candidates = this.enemies.filter((enemy) => (
      enemy.active
      && enemy.id !== queen.id
      && enemy.origin === ENEMY_ORIGINS.STABLE
    ));
    const keep = candidates.slice(0, QUEEN_PHASE_THREE_GUARD_CAP);
    const keptIds = new Set(keep.map((enemy) => enemy.id));
    const actors = [];
    const dismissedIds = new Set();
    for (const enemy of candidates) {
      if (keptIds.has(enemy.id)) continue;
      this.clearEnemyCommitment(enemy, "bossPhaseThree");
      enemy.active = false;
      enemy.dismissed = true;
      dismissedIds.add(enemy.id);
      actors.push({ id: enemy.id, type: enemy.type, position: clonePosition(enemy.position) });
    }
    let projectiles = 0;
    for (const projectile of this.projectiles) {
      if (!projectile.active || !dismissedIds.has(projectile.ownerEnemyId)) continue;
      projectiles += 1;
      this.deactivateProjectile(projectile);
    }
    const detail = {
      enemyId: queen.id,
      origin: queen.origin,
      phase: 3,
      actors,
      projectiles,
      remaining: keep.length,
    };
    this.emit("queenGuardsDismissed", detail);
    return detail;
  }

  facePlayer(enemy, player) {
    const direction = normalize(player.position.x - enemy.position.x, player.position.z - enemy.position.z);
    enemy.facing.x = direction.x;
    enemy.facing.z = direction.z;
    return direction;
  }

  predictAttackTarget(enemy, attackKind, player) {
    const attack = getEnemyArchetype(enemy.type).attacks[attackKind];
    const target = clonePosition(player.position);
    const tracking = attack?.tracking;
    if (tracking && finitePoint(player.previousPosition)) {
      let velocityX = (player.position.x - player.previousPosition.x) / RUN_CONFIG.fixedStep;
      let velocityZ = (player.position.z - player.previousPosition.z) / RUN_CONFIG.fixedStep;
      const speed = Math.hypot(velocityX, velocityZ);
      if (speed > MAX_TRACKED_PLAYER_SPEED) {
        const scale = MAX_TRACKED_PLAYER_SPEED / speed;
        velocityX *= scale;
        velocityZ *= scale;
      }
      let leadX = velocityX * tracking.leadTime;
      let leadZ = velocityZ * tracking.leadTime;
      const leadDistance = Math.hypot(leadX, leadZ);
      if (leadDistance > tracking.maxLead) {
        const scale = tracking.maxLead / leadDistance;
        leadX *= scale;
        leadZ *= scale;
      }
      target.x += leadX;
      target.z += leadZ;
    }

    if (this.arena) Object.assign(target, nearestWalkablePoint(this.arena, target, 0.2));
    if (["rune", "lobbedBomb", "voidWell"].includes(attackKind)) return this.findOpenPoint(target, 0.2);
    return target;
  }

  beginTrackedAttack(enemy, attackKind, player, options = {}) {
    const target = this.predictAttackTarget(enemy, attackKind, player);
    if (!hasLineOfSight(enemy.position, target, this.arena, 0.08)) return null;
    const direction = normalize(target.x - enemy.position.x, target.z - enemy.position.z);
    return this.beginAttack(enemy, attackKind, target, direction, options);
  }

  updateComboIntent(enemy, dt, player) {
    const pending = enemy.comboPending;
    if (!pending) return false;
    if (pending.window <= 0) {
      enemy.comboPending = null;
      this.emit("enemyComboEnded", Object.freeze({
        enemyId: enemy.id,
        type: enemy.type,
        origin: enemy.origin,
        comboId: pending.comboId,
        reason: "expired",
      }));
      return false;
    }

    const toPlayer = this.facePlayer(enemy, player);
    const bombardierSpacing = enemy.type === "bombardier" && this.bombardierAttackCooldown > 0;
    if (enemy.attackCooldown <= 0 && !bombardierSpacing && toPlayer.distance <= pending.maxRange) {
      const comboMeta = Object.freeze({
        comboId: pending.comboId,
        comboStep: 2,
        comboLength: pending.comboLength,
        continuesCombo: false,
      });
      const actionId = this.beginTrackedAttack(enemy, pending.attackKind, player, { comboMeta });
      if (actionId) {
        enemy.comboPending = null;
        this.emit("enemyComboContinued", Object.freeze({
          actionId,
          enemyId: enemy.id,
          type: enemy.type,
          origin: enemy.origin,
          attack: pending.attackKind,
          ...this.enemyComboDetail(comboMeta),
        }));
        return true;
      }
    }

    if (pending.preferredDistance) {
      this.steerAtRange(
        enemy,
        toPlayer,
        pending.preferredDistance * 0.82,
        pending.preferredDistance * 1.12,
        dt,
      );
    } else {
      this.pursueEngagementSlot(enemy, player, Math.min(2.2, pending.maxRange * 0.55), dt);
    }
    return true;
  }

  pursueEngagementSlot(enemy, player, distance, dt) {
    const angle = enemy.originPhase + enemy.formationIndex * 1.17;
    const target = {
      x: player.position.x + Math.cos(angle) * distance,
      z: player.position.z + Math.sin(angle) * distance,
    };
    this.moveEnemyToward(enemy, target, enemy.speed, dt);
  }

  updateStrafeDecision(enemy, toPlayer, dt) {
    enemy.decisionTimer = Math.max(0, enemy.decisionTimer - dt);
    if (enemy.decisionTimer > 0) return;
    let leftPressure = 0;
    let rightPressure = 0;
    for (const other of this.enemies) {
      if (!this.isEnemyInteractive(other) || other.id === enemy.id) continue;
      const offsetX = other.position.x - enemy.position.x;
      const offsetZ = other.position.z - enemy.position.z;
      if (offsetX * offsetX + offsetZ * offsetZ > 16) continue;
      const side = toPlayer.x * offsetZ - toPlayer.z * offsetX;
      if (side >= 0) leftPressure += 1;
      else rightPressure += 1;
    }
    if (leftPressure !== rightPressure) enemy.strafeDirection = leftPressure < rightPressure ? 1 : -1;
    enemy.decisionTimer = 0.28 + (enemy.id % 5) * 0.035;
  }

  moveEnemy(enemy, directionX, directionZ, speed, dt) {
    if (Math.hypot(directionX, directionZ) > 0.01) {
      enemy.facing.x = directionX;
      enemy.facing.z = directionZ;
    }
    const before = enemy.position;
    const effectiveSpeed = speed * (enemy.progressionSpeedMultiplier ?? 1);
    enemy.position = moveCircle(
      before,
      { x: directionX * effectiveSpeed, z: directionZ * effectiveSpeed },
      dt,
      enemy.radius,
      this.arena,
    );
    return distanceBetween(before, enemy.position);
  }

  slowEnemy(enemy, reduction, durationSeconds) {
    if (
      !this.isEnemyInteractive(enemy)
      || !Number.isFinite(reduction)
      || reduction <= 0
      || !Number.isFinite(durationSeconds)
      || durationSeconds <= 0
    ) return false;
    enemy.progressionSpeedMultiplier = Math.min(
      enemy.progressionSpeedMultiplier ?? 1,
      1 - Math.min(0.6, reduction),
    );
    enemy.progressionSlowTimer = Math.max(enemy.progressionSlowTimer ?? 0, durationSeconds);
    return true;
  }

  clearEnemyPath(enemy) {
    enemy.navigationPath = [];
    enemy.navigationIndex = 0;
    enemy.navigationTarget = null;
    enemy.navigationRefresh = 0.12 + (enemy.id % 7) * 0.035;
  }

  moveEnemyToward(enemy, target, speed, dt) {
    const padding = enemy.radius + ENEMY_PATH_CLEARANCE;
    if (hasLineOfSight(enemy.position, target, this.arena, padding)) {
      this.clearEnemyPath(enemy);
      const direction = normalize(target.x - enemy.position.x, target.z - enemy.position.z);
      return this.moveEnemy(enemy, direction.x, direction.z, speed, dt);
    }

    enemy.navigationRefresh = Math.max(0, enemy.navigationRefresh - dt);
    const targetMoved = !enemy.navigationTarget
      || distanceBetween(enemy.navigationTarget, target) > ENEMY_PATH_TARGET_THRESHOLD;
    if (targetMoved) {
      enemy.navigationRefresh = Math.min(enemy.navigationRefresh, 0.18 + (enemy.id % 7) * 0.035);
    }
    if (enemy.navigationPath.length === 0 && enemy.navigationRefresh > 0) return 0;
    if (enemy.navigationRefresh <= 0) {
      enemy.navigationPath = findNavigationPath(enemy.position, target, this.arena, {
        cellSize: ENEMY_PATH_CELL_SIZE,
        padding,
      });
      enemy.navigationIndex = enemy.navigationPath.length > 1 ? 1 : 0;
      enemy.navigationTarget = clonePosition(target);
      enemy.navigationRefresh = ENEMY_PATH_REFRESH_SECONDS + (enemy.id % 7) * 0.06;
    }

    const waypointRadius = Math.max(0.5, enemy.radius * 0.85);
    while (
      enemy.navigationIndex < enemy.navigationPath.length - 1
      && distanceBetween(enemy.position, enemy.navigationPath[enemy.navigationIndex]) <= waypointRadius
    ) {
      enemy.navigationIndex += 1;
    }
    const waypoint = enemy.navigationPath[enemy.navigationIndex] ?? target;
    const direction = normalize(waypoint.x - enemy.position.x, waypoint.z - enemy.position.z);
    return this.moveEnemy(enemy, direction.x, direction.z, speed, dt);
  }

  steerAtRange(enemy, toPlayer, minimumDistance, maximumDistance, dt) {
    let directionX;
    let directionZ;
    let strafing = false;
    if (toPlayer.distance < minimumDistance) {
      directionX = -toPlayer.x;
      directionZ = -toPlayer.z;
    } else if (toPlayer.distance > maximumDistance) {
      const target = {
        x: enemy.position.x + toPlayer.x * toPlayer.distance,
        z: enemy.position.z + toPlayer.z * toPlayer.distance,
      };
      this.moveEnemyToward(enemy, target, enemy.speed, dt);
      return;
    } else {
      strafing = true;
      this.updateStrafeDecision(enemy, toPlayer, dt);
      directionX = -toPlayer.z * enemy.strafeDirection;
      directionZ = toPlayer.x * enemy.strafeDirection;
    }
    const moved = this.moveEnemy(enemy, directionX, directionZ, enemy.speed, dt);
    if (strafing && moved < enemy.speed * dt * 0.25) {
      enemy.strafeDirection *= -1;
      enemy.decisionTimer = 0.18;
    }
  }

  currentDifficulty() {
    return completeDifficultyProfile(this.difficulty);
  }

  beginAttackStep() {
    const activeEnemyIds = this.enemies
      .filter((enemy) => this.isEnemyInteractive(enemy))
      .map((enemy) => String(enemy.id));
    return this.attackCoordinator.beginStep(activeEnemyIds, this.currentDifficulty());
  }

  ensureAttackStep(enemy) {
    const enemyId = String(enemy.id);
    if (!this.attackCoordinator.isPreparedFor(enemyId)) this.beginAttackStep();
  }

  scaleAttackWindup(enemy, windup) {
    const difficulty = this.currentDifficulty();
    if (enemy.type !== "queen") return windup * difficulty.windupMultiplier;
    const timing = queenPhaseTiming(enemy.bossPhase);
    return Math.max(
      QUEEN_MIN_WINDUP_SECONDS,
      windup * difficulty.windupMultiplier * timing.windupMultiplier,
    );
  }

  scaleAttackCooldown(enemy, cooldown, { comboContinues = false } = {}) {
    const difficulty = this.currentDifficulty();
    const bossCadence = enemy.type === "queen" ? difficulty.bossCadenceMultiplier : 1;
    const timing = enemy.type === "queen" ? queenPhaseTiming(enemy.bossPhase) : queenPhaseTiming(1);
    const comboMultiplier = comboContinues ? timing.comboGapMultiplier : 1;
    return cooldown * difficulty.cooldownMultiplier * timing.cooldownMultiplier * comboMultiplier / bossCadence;
  }

  beginAttack(enemy, attackKind, target, direction, options = {}) {
    if (!this.isEnemyInteractive(enemy)) return null;
    const definition = getEnemyArchetype(enemy.type);
    const attack = definition.attacks[attackKind];
    if (!attack) throw new RangeError(`${enemy.type} cannot use ${attackKind}`);
    const family = ATTACK_FAMILY_BY_KIND[attackKind];
    if (!family) throw new RangeError(`Attack family is not defined for ${attackKind}`);
    this.ensureAttackStep(enemy);
    const telegraphDuration = this.scaleAttackWindup(enemy, attack.windup);
    const lease = this.attackCoordinator.request({
      enemyId: String(enemy.id),
      family,
      priority: definition.threat,
      telegraphDuration,
    });
    if (!lease) {
      this.emit("enemyAttackDeferred", Object.freeze({
        enemyId: enemy.id,
        type: enemy.type,
        origin: enemy.origin,
        attack: attackKind,
        family,
        reason: this.attackCoordinator.lastDenial?.reason ?? "unavailable",
        floor: this.encounterFloor,
        room: this.encounterPlan?.room ?? null,
      }));
      return null;
    }
    let comboMeta = options.comboMeta ?? null;
    if (!comboMeta && enemy.type !== "queen" && attack.combo) {
      enemy.comboSerial += 1;
      comboMeta = Object.freeze({
        comboId: `enemy-${enemy.id}-combo-${enemy.comboSerial}`,
        comboStep: 1,
        comboLength: 2,
        continuesCombo: true,
      });
    }
    enemy.attackPending = true;
    enemy.attackKind = attackKind;
    enemy.attackActionId = `enemy-action-${this.nextEnemyActionId++}`;
    enemy.attackLeaseId = lease.leaseId;
    enemy.attackLeaseFamily = lease.family;
    enemy.attackComboMeta = comboMeta;
    enemy.attackWindup = telegraphDuration;
    enemy.attackTarget.x = target.x;
    enemy.attackTarget.z = target.z;
    enemy.attackDirection.x = direction.x;
    enemy.attackDirection.z = direction.z;
    const targetedCircle = attackKind === "rune" || attackKind === "lobbedBomb" || attackKind === "voidWell";
    this.emit("enemyTelegraph", {
      actionId: enemy.attackActionId,
      enemyId: enemy.id,
      type: enemy.type,
      enemyOrigin: enemy.origin,
      attack: attackKind,
      shape: attack.shape,
      position: targetedCircle ? clonePosition(target) : clonePosition(enemy.position),
      origin: clonePosition(enemy.position),
      target: clonePosition(target),
      direction: { x: direction.x, z: direction.z },
      radius: attack.radius,
      width: attack.width,
      duration: telegraphDuration,
      bossPhase: enemy.type === "queen" ? enemy.bossPhase : null,
      ...this.attackComboDetail(enemy, comboMeta),
    });
    this.emit("enemyAttackLeaseGranted", Object.freeze({
      leaseId: lease.leaseId,
      actionId: enemy.attackActionId,
      enemyId: enemy.id,
      family: lease.family,
      difficultyId: lease.difficultyId,
      floor: this.encounterFloor,
      room: this.encounterPlan?.room ?? null,
    }));
    return enemy.attackActionId;
  }

  updateWindup(enemy, dt, player, resolvePlayerDamage) {
    if (!enemy.attackPending) return false;
    enemy.attackWindup -= dt;
    if (enemy.attackWindup > 0) return true;
    const attackKind = enemy.attackKind;
    const actionId = enemy.attackActionId;
    enemy.attackPending = false;
    enemy.attackKind = null;
    this.executeAttack(enemy, attackKind, actionId, player, resolvePlayerDamage);
    return true;
  }

  executeAttack(enemy, attackKind, actionId, player, resolvePlayerDamage) {
    const attack = getEnemyArchetype(enemy.type).attacks[attackKind];
    const comboMeta = enemy.attackComboMeta;
    switch (attackKind) {
      case "lunge":
        this.startDash(enemy, attackKind, attack, actionId);
        break;
      case "graveCleave":
        if (this.isPlayerInsideAttack(enemy, attack, player)) {
          this.resolvePlayerDamage(resolvePlayerDamage, enemy, actionId, enemy.damage * 0.92, attackKind, "cone");
        }
        break;
      case "dashLane":
      case "guardCharge":
      case "royalDash":
        this.startDash(enemy, attackKind, attack, actionId);
        break;
      case "crosscut":
      case "veilSweep":
      case "shieldSlam":
      case "royalSlam":
        if (isInsideCircle(enemy.position, attack.radius, player.position, player.radius)) {
          this.resolvePlayerDamage(resolvePlayerDamage, enemy, actionId, enemy.damage, attackKind, "circle");
        }
        break;
      case "aimedBolt":
        this.spawnProjectile(enemy.position, Math.atan2(enemy.attackDirection.z, enemy.attackDirection.x), 11.5, enemy.damage, 2.25, "violet", {
          kind: PROJECTILE_KINDS.HEX_BOLT,
          sourceType: enemy.type,
          origin: enemy.origin,
          actionId,
          enemyId: enemy.id,
          enemyType: enemy.type,
          enemyOrigin: enemy.origin,
          radius: 0.24,
        });
        break;
      case "fan":
        this.spawnFan(enemy, actionId, 5, 0.58, 8.5, enemy.damage * 0.78, PROJECTILE_KINDS.HEX_SHARD, "violet");
        break;
      case "rune":
        this.spawnAreaProjectile(enemy, actionId, PROJECTILE_KINDS.HEX_RUNE, "rune", attack.radius, 0.82, "violet");
        break;
      case "blinkFlank":
        this.clearEnemyPath(enemy);
        enemy.position.x = enemy.attackTarget.x;
        enemy.position.z = enemy.attackTarget.z;
        enemy.previousPosition.x = enemy.attackTarget.x;
        enemy.previousPosition.z = enemy.attackTarget.z;
        if (isInsideCircle(enemy.position, attack.radius, player.position, player.radius)) {
          this.resolvePlayerDamage(resolvePlayerDamage, enemy, actionId, enemy.damage, attackKind, "blink");
        }
        this.emit("enemyBlink", { enemyId: enemy.id, type: enemy.type, origin: enemy.origin, position: clonePosition(enemy.position) });
        break;
      case "lobbedBomb":
        this.spawnAreaProjectile(enemy, actionId, PROJECTILE_KINDS.CINDER_BOMB, "lob", attack.radius, attack.travelTime, "ember");
        break;
      case "cinderBurst":
        this.spawnFan(enemy, actionId, 4, 0.72, 8.2, enemy.damage * 0.72, PROJECTILE_KINDS.CINDER_SHARD, "ember");
        break;
      case "royalVolley":
        this.spawnQueenVolley(enemy, actionId);
        this.emit("queenVolley", { origin: enemy.origin, position: clonePosition(enemy.position), phase: enemy.bossPhase });
        break;
      case "royalFan":
        this.spawnFan(enemy, actionId, enemy.bossPhase === 3 ? 11 : enemy.bossPhase === 2 ? 9 : 7, 0.88, 9.5, enemy.damage * 0.72, PROJECTILE_KINDS.QUEEN_ORB, "violet");
        break;
      case "royalLance":
        this.spawnProjectile(enemy.position, Math.atan2(enemy.attackDirection.z, enemy.attackDirection.x), 15, enemy.damage * 1.05, 1.35, "violet", {
          kind: PROJECTILE_KINDS.QUEEN_LANCE,
          sourceType: enemy.type,
          origin: enemy.origin,
          actionId,
          enemyId: enemy.id,
          enemyType: enemy.type,
          enemyOrigin: enemy.origin,
          radius: 0.34,
        });
        break;
      case "voidWell":
        this.spawnAreaProjectile(enemy, actionId, PROJECTILE_KINDS.QUEEN_WELL, "rune", attack.radius, attack.duration, "violet");
        break;
      default:
        throw new RangeError(`Attack execution is not implemented: ${attackKind}`);
    }

    const startsEnemyCombo = enemy.type !== "queen"
      && comboMeta?.comboStep === 1
      && attack.combo;
    if (startsEnemyCombo) {
      enemy.comboPending = {
        comboId: comboMeta.comboId,
        comboLength: comboMeta.comboLength,
        attackKind: attack.combo.followup,
        window: attack.combo.window,
        maxRange: attack.combo.maxRange,
        preferredDistance: attack.combo.preferredDistance ?? null,
      };
      enemy.attackCooldown = this.scaleAttackCooldown(enemy, attack.combo.gap, { comboContinues: true });
      this.emit("enemyComboStarted", Object.freeze({
        actionId,
        enemyId: enemy.id,
        type: enemy.type,
        origin: enemy.origin,
        attack: attackKind,
        followup: attack.combo.followup,
        ...this.enemyComboDetail(comboMeta),
      }));
    } else {
      enemy.attackCooldown = this.scaleAttackCooldown(enemy, attack.cooldown, {
        comboContinues: enemy.type === "queen" && enemy.queenActionMeta?.continuesCombo === true,
      });
    }
    enemy.lastAttackKind = attackKind;
    this.emit("enemyAttack", {
      actionId,
      enemyId: enemy.id,
      type: enemy.type,
      origin: enemy.origin,
      attack: attackKind,
      shape: attack.shape,
      position: clonePosition(enemy.position),
      target: clonePosition(enemy.attackTarget),
      direction: clonePosition(enemy.attackDirection),
      radius: attack.radius,
      width: attack.width,
      bossPhase: enemy.type === "queen" ? enemy.bossPhase : null,
      ...this.attackComboDetail(enemy, comboMeta),
    });
    enemy.attackComboMeta = null;
    if (enemy.state !== "dash") {
      this.releaseAttackLease(enemy, "executed");
      enemy.attackActionId = null;
    }
  }

  resolvePlayerDamage(resolvePlayerDamage, enemy, actionId, amount, source, family, projectile = null) {
    const attempt = Object.freeze({
      attemptId: `player-damage-${this.nextDamageAttemptId++}`,
      actionId: actionId ?? enemy?.attackActionId ?? `enemy-action-${this.nextEnemyActionId++}`,
      amount,
      source,
      family,
      enemyId: enemy?.id ?? projectile?.ownerEnemyId ?? null,
      enemyType: enemy?.type ?? projectile?.ownerEnemyType ?? null,
      enemyOrigin: enemy?.origin ?? projectile?.ownerEnemyOrigin ?? projectile?.origin ?? null,
      projectileId: projectile?.id ?? null,
    });
    resolvePlayerDamage?.(attempt);
    return attempt;
  }

  isPlayerInsideAttack(enemy, attack, player) {
    const offsetX = player.position.x - enemy.position.x;
    const offsetZ = player.position.z - enemy.position.z;
    const distance = Math.hypot(offsetX, offsetZ);
    if (distance > attack.radius + player.radius) return false;
    if (distance < 0.001) return true;
    const dot = (offsetX / distance) * enemy.attackDirection.x + (offsetZ / distance) * enemy.attackDirection.z;
    const halfAngle = Math.atan2(Math.max(0.1, attack.width * 0.5), Math.max(0.1, attack.radius));
    return dot >= Math.cos(halfAngle + Math.asin(Math.min(1, player.radius / distance)));
  }

  startDash(enemy, attackKind, attack, actionId = enemy.attackActionId) {
    this.clearEnemyPath(enemy);
    enemy.attackActionId = actionId ?? `enemy-action-${this.nextEnemyActionId++}`;
    enemy.state = "dash";
    enemy.actionTimer = attack.dashDuration ?? 0.18;
    enemy.actionSpeed = attack.dashSpeed ?? 13.5;
    enemy.actionHit = false;
    enemy.attackKind = attackKind;
  }

  updateDash(enemy, dt, player, resolvePlayerDamage) {
    if (enemy.state !== "dash") return false;
    enemy.actionTimer -= dt;
    this.moveEnemy(enemy, enemy.attackDirection.x, enemy.attackDirection.z, enemy.actionSpeed, dt);
    if (!enemy.actionHit && isInsideCircle(enemy.position, enemy.radius + 0.35, player.position, player.radius)) {
      enemy.actionHit = true;
      this.resolvePlayerDamage(resolvePlayerDamage, enemy, enemy.attackActionId, enemy.damage, enemy.attackKind, "dash");
    }
    if (enemy.actionTimer <= 0) {
      enemy.state = "chase";
      this.releaseAttackLease(enemy, "dashCompleted");
      enemy.attackKind = null;
      enemy.attackActionId = null;
      enemy.actionSpeed = 0;
    }
    return true;
  }

  spawnFan(enemy, actionId, count, spread, speed, damage, kind, color) {
    const centerAngle = Math.atan2(enemy.attackDirection.z, enemy.attackDirection.x);
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
      this.spawnProjectile(enemy.position, centerAngle + offset, speed, damage, 2.7, color, {
        kind,
        sourceType: enemy.type,
        origin: enemy.origin,
        actionId,
        enemyId: enemy.id,
        enemyType: enemy.type,
        enemyOrigin: enemy.origin,
        radius: kind === PROJECTILE_KINDS.QUEEN_ORB ? 0.32 : 0.23,
      });
    }
  }

  spawnQueenVolley(enemy, actionId) {
    const count = enemy.bossPhase === 2 ? 16 : 10;
    const offset = this.rng.float(0, Math.PI * 2);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + offset + this.rng.float(-0.035, 0.035);
      this.spawnProjectile(enemy.position, angle, enemy.bossPhase === 2 ? 9 : 7.5, enemy.damage * 0.68, 3.6, "violet", {
        kind: PROJECTILE_KINDS.QUEEN_ORB,
        sourceType: enemy.type,
        origin: enemy.origin,
        actionId,
        enemyId: enemy.id,
        enemyType: enemy.type,
        enemyOrigin: enemy.origin,
        radius: 0.32,
      });
    }
  }

  spawnAreaProjectile(enemy, actionId, kind, mode, areaRadius, life, color) {
    const angle = Math.atan2(enemy.attackTarget.z - enemy.position.z, enemy.attackTarget.x - enemy.position.x);
    const distance = distanceBetween(enemy.position, enemy.attackTarget);
    this.spawnProjectile(enemy.position, angle, distance / life, enemy.damage, life, color, {
      kind,
      mode,
      sourceType: enemy.type,
      origin: enemy.origin,
      actionId,
      enemyId: enemy.id,
      enemyType: enemy.type,
      enemyOrigin: enemy.origin,
      target: enemy.attackTarget,
      areaRadius,
      radius: mode === "lob" ? 0.38 : areaRadius,
    });
  }

  spawnProjectile(position, angle, speed, damage, life, color, options = {}) {
    const projectile = this.projectiles.find((entry) => !entry.active);
    if (!projectile) return null;
    projectile.id = `projectile-${this.nextProjectileId++}`;
    projectile.active = true;
    projectile.origin = options.origin ?? ENEMY_ORIGINS.STABLE;
    projectile.kind = options.kind ?? PROJECTILE_KINDS.HEX_BOLT;
    projectile.mode = options.mode ?? "direct";
    projectile.sourceType = options.sourceType ?? "projectile";
    projectile.actionId = options.actionId ?? `projectile-action-${projectile.id}`;
    projectile.ownerEnemyId = options.enemyId ?? null;
    projectile.ownerEnemyType = options.enemyType ?? options.sourceType ?? null;
    projectile.ownerEnemyOrigin = options.enemyOrigin ?? options.origin ?? ENEMY_ORIGINS.STABLE;
    projectile.position.x = projectile.mode === "rune" ? options.target.x : position.x;
    projectile.position.z = projectile.mode === "rune" ? options.target.z : position.z;
    projectile.previousPosition.x = projectile.position.x;
    projectile.previousPosition.z = projectile.position.z;
    projectile.target.x = options.target?.x ?? position.x + Math.cos(angle) * speed * life;
    projectile.target.z = options.target?.z ?? position.z + Math.sin(angle) * speed * life;
    projectile.velocity.x = projectile.mode === "rune" ? 0 : Math.cos(angle) * speed;
    projectile.velocity.z = projectile.mode === "rune" ? 0 : Math.sin(angle) * speed;
    projectile.radius = options.radius ?? 0.25;
    projectile.areaRadius = options.areaRadius ?? 0;
    projectile.damage = damage;
    projectile.life = life;
    projectile.totalLife = life;
    projectile.height = 0;
    projectile.color = color;
    return projectile;
  }

  updateProjectiles(dt, player, resolvePlayerDamage) {
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;
      projectile.previousPosition.x = projectile.position.x;
      projectile.previousPosition.z = projectile.position.z;
      projectile.life -= dt;

      if (projectile.mode === "lob") {
        projectile.position.x += projectile.velocity.x * dt;
        projectile.position.z += projectile.velocity.z * dt;
        const progress = 1 - Math.max(0, projectile.life) / projectile.totalLife;
        projectile.height = Math.sin(progress * Math.PI) * 3.8;
      } else if (projectile.mode === "direct") {
        projectile.position.x += projectile.velocity.x * dt;
        projectile.position.z += projectile.velocity.z * dt;
      }

      const containmentRadius = Math.min(projectile.radius, 0.34);
      if (
        !isCircleWalkable(this.arena, projectile.position, containmentRadius)
        || ((projectile.mode === "direct" || projectile.mode === "lob")
          && !isWalkableSegment(
            this.arena,
            projectile.previousPosition,
            projectile.position,
            containmentRadius,
          ))
      ) {
        this.deactivateProjectile(projectile);
        continue;
      }

      if (projectile.life <= 0) {
        if (projectile.mode === "lob" || projectile.mode === "rune") this.detonateProjectile(projectile, player, resolvePlayerDamage);
        else this.deactivateProjectile(projectile);
        continue;
      }

      if (projectile.mode !== "direct") continue;
      const combinedRadius = projectile.radius + player.radius;
      if (segmentDistanceSquared(projectile.previousPosition, projectile.position, player.position) <= combinedRadius * combinedRadius) {
        this.deactivateProjectile(projectile);
        if (this.resolvedProjectileActions.has(projectile.actionId)) continue;
        this.resolvedProjectileActions.add(projectile.actionId);
        this.resolvePlayerDamage(
          resolvePlayerDamage,
          null,
          projectile.actionId,
          projectile.damage,
          projectile.kind,
          "directProjectile",
          projectile,
        );
      }
    }
  }

  detonateProjectile(projectile, player, resolvePlayerDamage) {
    projectile.position.x = projectile.target.x;
    projectile.position.z = projectile.target.z;
    projectile.height = 0;
    if (!isCircleWalkable(this.arena, projectile.position, Math.min(projectile.radius, 0.34))) {
      this.deactivateProjectile(projectile);
      return;
    }
    if (isInsideCircle(projectile.position, projectile.areaRadius, player.position, player.radius)) {
      this.resolvePlayerDamage(
        resolvePlayerDamage,
        null,
        projectile.actionId,
        projectile.damage,
        projectile.kind,
        "areaProjectile",
        projectile,
      );
    }
    this.emit("projectileImpact", {
      projectileId: projectile.id,
      actionId: projectile.actionId,
      enemyId: projectile.ownerEnemyId,
      kind: projectile.kind,
      sourceType: projectile.sourceType,
      origin: projectile.origin,
      shape: "circle",
      position: clonePosition(projectile.position),
      radius: projectile.areaRadius,
    });
    this.deactivateProjectile(projectile);
  }

  findOpenPoint(point, radius) {
    const clearance = radius + (this.arena.walkableShape ? 0.08 : 0.8);
    const repaired = nearestWalkablePoint(this.arena, point, clearance);
    if (this.isOpenPoint(repaired, radius)) return repaired;
    for (let ring = 1; ring <= 128; ring += 1) {
      const distance = ring * 0.25;
      for (let index = 0; index < 32; index += 1) {
        const angle = (index / 32) * Math.PI * 2;
        const candidate = {
          x: repaired.x + Math.cos(angle) * distance,
          z: repaired.z + Math.sin(angle) * distance,
        };
        if (this.isOpenPoint(candidate, radius)) return candidate;
      }
    }
    return repaired;
  }

  isOpenPoint(point, radius) {
    const clearance = radius + (this.arena.walkableShape ? 0.08 : 0.8);
    if (!isCircleWalkable(this.arena, point, clearance)) return false;
    return !(this.arena.obstacles ?? []).some((obstacle) => {
      const closestX = Math.max(obstacle.x - obstacle.width / 2, Math.min(obstacle.x + obstacle.width / 2, point.x));
      const closestZ = Math.max(obstacle.z - obstacle.depth / 2, Math.min(obstacle.z + obstacle.depth / 2, point.z));
      return Math.hypot(point.x - closestX, point.z - closestZ) < radius + 0.12;
    });
  }

  queryClaimCandidates({ pass, from, to, radius, arc = null, direction = null }) {
    if (!["outbound", "recall", "cleave"].includes(pass) || !finitePoint(from) || !finitePoint(to)) return [];
    if (!Number.isFinite(radius) || radius < 0) return [];
    if (pass === "cleave") {
      if (!finitePoint(direction) || !Number.isFinite(arc) || arc <= 0) return [];
      const facing = Math.atan2(direction.z, direction.x);
      return this.enemies.filter((enemy) => (
        this.isEnemyInteractive(enemy)
        && hasLineOfSight(from, enemy.position, this.arena, 0.08)
        && circleIntersectsArc(from, facing, radius, arc, enemy.position, enemy.radius)
      ));
    }
    return this.enemies.filter((enemy) => {
      if (!this.isEnemyInteractive(enemy) || !hasLineOfSight(from, enemy.position, this.arena, 0.08)) return false;
      const combinedRadius = radius + enemy.radius;
      return segmentDistanceSquared(from, to, enemy.position) <= combinedRadius * combinedRadius;
    });
  }

  querySweep(query) {
    return this.queryClaimCandidates(query);
  }

  pullEnemyToward(enemy, origin, requested) {
    const requestedDistance = Math.max(0, Number.isFinite(requested) ? requested : 0);
    const boundedDistance = Math.min(MAX_CLAIM_PULL, requestedDistance);
    if (!this.isEnemyInteractive(enemy) || !this.arena || !finitePoint(origin) || boundedDistance <= 0) {
      return Object.freeze({
        targetId: enemy?.id ?? null,
        requested: requestedDistance,
        applied: 0,
        resistanceClass: enemy?.resistanceClass ?? null,
      });
    }
    const multiplier = PULL_MULTIPLIER[enemy.resistanceClass] ?? 0;
    const direction = normalize(origin.x - enemy.position.x, origin.z - enemy.position.z);
    const distance = Math.min(direction.distance, boundedDistance * multiplier);
    const before = clonePosition(enemy.position);
    if (distance > 0) {
      this.clearEnemyPath(enemy);
      enemy.position = moveCircle(
        enemy.position,
        { x: direction.x * distance, z: direction.z * distance },
        1,
        enemy.radius,
        this.arena,
      );
    }
    const applied = Math.min(boundedDistance, distanceBetween(before, enemy.position));
    return Object.freeze({
      targetId: enemy.id,
      requested: requestedDistance,
      applied,
      resistanceClass: enemy.resistanceClass,
      position: immutablePoint(enemy.position),
    });
  }

  resolveCombatHit(enemy, hit) {
    if (!enemy?.active) return Object.freeze({ accepted: false, reason: "inactive", defeated: false, hit: null });
    if (!this.isEnemyInteractive(enemy)) {
      return Object.freeze({ accepted: false, reason: "emerging", defeated: false, hit: null });
    }
    if (enemy.type === "queen" && enemy.state === "phaseTransition") {
      return Object.freeze({ accepted: false, reason: "uninterruptible", defeated: false, hit: null });
    }
    const direction = finitePoint(hit?.direction) ? normalize(hit.direction.x, hit.direction.z) : normalize(0, 0);
    const damage = Number.isFinite(hit?.damage) ? Math.max(0, hit.damage) : 0;
    const knockback = Number.isFinite(hit?.knockback) ? Math.max(0, hit.knockback) : 0;
    const poiseDamage = Number.isFinite(hit?.poiseDamage) ? Math.max(0, hit.poiseDamage) : 0;
    const incomingX = -direction.x;
    const incomingZ = -direction.z;
    const frontalHit = incomingX * enemy.facing.x + incomingZ * enemy.facing.z > 0.3;
    const blocked = enemy.type === "boneguard" && enemy.state !== "dash" && !enemy.attackPending && frontalHit;
    const blockScale = blocked ? 0.52 : 1;
    const displacementScale = PULL_MULTIPLIER[enemy.resistanceClass] ?? 0;
    const appliedDamage = damage * blockScale;
    const appliedPoiseDamage = poiseDamage * blockScale;
    const appliedKnockback = knockback * (blocked ? 0.35 : 1) * displacementScale;
    const previousHealth = enemy.health;
    const previousPoise = enemy.poise;
    enemy.health = Math.max(0, enemy.health - appliedDamage);
    enemy.poise = Math.max(0, enemy.poise - appliedPoiseDamage);
    if (appliedPoiseDamage > 0) enemy.poiseRecoveryDelay = POISE_RECOVERY_DELAY;
    enemy.hitFlash = 0.09;
    if (appliedKnockback > 0) {
      enemy.knockback.x += direction.x * appliedKnockback;
      enemy.knockback.z += direction.z * appliedKnockback;
    }

    if (blocked) {
      this.emit("enemyBlock", Object.freeze({
        id: enemy.id,
        type: enemy.type,
        origin: enemy.origin,
        position: immutablePoint(enemy.position),
      }));
    }
    if (enemy.poise !== previousPoise) {
      this.emit("enemyPoiseChanged", Object.freeze({
        enemyId: enemy.id,
        previous: previousPoise,
        current: enemy.poise,
        max: enemy.maxPoise,
        sourceActionId: hit?.actionId ?? null,
        origin: enemy.origin,
      }));
    }

    const resolvedHit = Object.freeze({
      actionId: hit?.actionId ?? null,
      damage: appliedDamage,
      critical: Boolean(hit?.critical),
      direction: immutablePoint(direction),
      knockback: appliedKnockback,
      poiseDamage: appliedPoiseDamage,
      pullStrength: Number.isFinite(hit?.pullStrength) ? Math.max(0, hit.pullStrength) : 0,
      sourcePosition: immutablePoint(finitePoint(hit?.sourcePosition) ? hit.sourcePosition : enemy.position),
      origin: hit?.origin ?? "player",
      enemyOrigin: enemy.origin,
      blocked,
    });
    this.emit("enemyHit", Object.freeze({
      id: enemy.id,
      type: enemy.type,
      origin: enemy.origin,
      enemyOrigin: resolvedHit.enemyOrigin,
      hitOrigin: resolvedHit.origin,
      sourceOrigin: resolvedHit.origin,
      actionId: resolvedHit.actionId,
      position: immutablePoint(enemy.position),
      sourcePosition: resolvedHit.sourcePosition,
      direction: resolvedHit.direction,
      damage: resolvedHit.damage,
      poiseDamage: resolvedHit.poiseDamage,
      knockback: resolvedHit.knockback,
      pullStrength: resolvedHit.pullStrength,
      critical: resolvedHit.critical,
      blocked,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      hit: resolvedHit,
    }));

    const defeated = enemy.health <= 0;
    if (defeated) {
      enemy.active = false;
      this.clearEnemyCommitment(enemy, "defeated");
      this.emit("enemyDefeated", Object.freeze({
        id: enemy.id,
        type: enemy.type,
        origin: enemy.origin,
        position: immutablePoint(enemy.position),
      }));
      if (enemy.schedulerEnemyId) this.encounterScheduler?.killEnemy(enemy.schedulerEnemyId);
    } else if (previousPoise > 0 && enemy.poise <= 0) {
      this.interruptForStagger(enemy, hit?.actionId ?? null);
    }
    return Object.freeze({
      accepted: true,
      defeated,
      previousHealth,
      health: enemy.health,
      previousPoise,
      poise: enemy.poise,
      hit: resolvedHit,
    });
  }

  interruptForStagger(enemy, sourceActionId) {
    this.clearEnemyCommitment(enemy, "staggered");
    enemy.state = "staggered";
    enemy.actionTimer = STAGGER_DURATION[enemy.resistanceClass];
    this.emit("enemyStaggered", Object.freeze({
      enemyId: enemy.id,
      sourceActionId,
      duration: enemy.actionTimer,
      resistanceClass: enemy.resistanceClass,
      origin: enemy.origin,
      position: immutablePoint(enemy.position),
    }));
  }

  releaseAttackLease(enemy, reason) {
    const leaseId = enemy?.attackLeaseId;
    if (!leaseId) return false;
    const family = enemy.attackLeaseFamily;
    enemy.attackLeaseId = null;
    enemy.attackLeaseFamily = null;
    const released = this.attackCoordinator.release(leaseId, reason);
    if (released) {
      this.emit("enemyAttackLeaseReleased", Object.freeze({
        leaseId,
        enemyId: enemy.id,
        family,
        reason,
        floor: this.encounterFloor,
        room: this.encounterPlan?.room ?? null,
      }));
    }
    return released;
  }

  clearQueenSpecial(enemy) {
    enemy.attackActionId = null;
    enemy.attackKind = null;
    enemy.queenSpecialKind = null;
    enemy.queenSpecialStage = null;
    enemy.queenSpecialActionId = null;
    enemy.queenSpecialTarget = null;
    enemy.queenActionMeta = null;
  }

  clearEnemyCommitment(enemy, reason = "interrupted") {
    this.releaseAttackLease(enemy, reason);
    enemy.attackPending = false;
    enemy.attackWindup = 0;
    enemy.attackKind = null;
    enemy.attackActionId = null;
    enemy.actionHit = false;
    enemy.actionSpeed = 0;
    enemy.knockback.x = 0;
    enemy.knockback.z = 0;
    enemy.comboPending = null;
    enemy.attackComboMeta = null;
    this.clearQueenSpecial(enemy);
  }

  hasLivingEnemies() {
    return this.enemies.some((enemy) => enemy.active);
  }

  hasCombatRemaining() {
    const directActorsRemain = this.enemies.some((enemy) => enemy.active && !enemy.schedulerEnemyId);
    return directActorsRemain || Boolean(this.encounterScheduler?.hasCombatRemaining());
  }

  clearEncounter(reason = "clearedExternally") {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      this.clearEnemyCommitment(enemy, reason);
      enemy.active = false;
      enemy.lifecycle.state = ENEMY_LIFECYCLE_STATES.DEFEATED;
      enemy.lifecycle.remainingSeconds = 0;
    }
    this.attackCoordinator.reset(reason);
    this.encounterScheduler = null;
    this.schedulerEnemyActors.clear();
    this.pendingWaves.length = 0;
    this.deactivateProjectiles();
  }

  activeBoss() {
    return this.enemies.find((enemy) => enemy.active && enemy.type === "queen") ?? null;
  }

  deactivateProjectiles() {
    for (const projectile of this.projectiles) this.deactivateProjectile(projectile);
  }

  deactivateProjectilesFrom(sourceType) {
    for (const projectile of this.projectiles) {
      if (projectile.active && projectile.sourceType === sourceType) this.deactivateProjectile(projectile);
    }
  }

  deactivateProjectile(projectile) {
    projectile.active = false;
  }

  dismissStableOrigin() {
    if (this.stableOriginDismissed) return null;
    this.stableOriginDismissed = true;
    const actors = [];
    const pendingEntries = this.encounterScheduler?.batchStates.reduce((count, state) => (
      count + state.batch.entries.slice(state.nextEntryIndex)
        .filter((entry) => entry.origin === ENEMY_ORIGINS.STABLE).length
    ), 0) ?? 0;
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.origin !== ENEMY_ORIGINS.STABLE) continue;
      this.clearEnemyCommitment(enemy, "dismissed");
      enemy.active = false;
      enemy.dismissed = true;
      actors.push({ id: enemy.id, type: enemy.type, position: clonePosition(enemy.position) });
    }
    let projectiles = 0;
    for (const projectile of this.projectiles) {
      if (!projectile.active || projectile.origin !== ENEMY_ORIGINS.STABLE) continue;
      projectiles += 1;
      this.deactivateProjectile(projectile);
    }
    this.encounterScheduler?.cancelWhere(
      (entry) => entry.origin === ENEMY_ORIGINS.STABLE,
      "stableOriginDismissed",
    );
    this.pendingWaves = this.pendingWaves.flatMap((wave) => {
      const entries = wave.entries.filter((entry) => {
        if (entry.origin !== ENEMY_ORIGINS.STABLE) return true;
        return false;
      });
      return entries.length > 0 ? [{ ...wave, entries }] : [];
    });
    const detail = { origin: ENEMY_ORIGINS.STABLE, actors, projectiles, pendingEntries };
    this.emit("stableOriginDismissed", detail);
    return detail;
  }

  activeQueenHazardCount() {
    return this.projectiles.filter((projectile) => (
      projectile.active &&
      projectile.sourceType === "queen" &&
      projectile.mode !== "direct"
    )).length;
  }

  stressSpawn(count, floor = 9) {
    this.attackCoordinator.reset("stressSpawn");
    this.enemies.length = 0;
    this.encounterPlan = null;
    this.encounterScheduler = null;
    this.schedulerEnemyActors.clear();
    this.pendingWaves.length = 0;
    this.waveDelay = 0;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const radius = 6 + (index % 4) * 1.3;
      const type = NON_BOSS_ARCHETYPE_IDS[index % NON_BOSS_ARCHETYPE_IDS.length];
      this.spawnEnemy(type, { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }, floor);
    }
  }
}

export { ENEMY_ARCHETYPES };
