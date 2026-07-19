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
import { DIFFICULTY } from "./gameConfig.js";

const PROJECTILE_POOL_SIZE = 144;
const BOMBADIER_ATTACK_SPACING = 1.15;
const STANDARD_DIFFICULTY = DIFFICULTY.standard;
const MAX_CLAIM_PULL = 3.2;
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
  if (profile?.id && profile.attackBudgets) return profile;
  return {
    ...STANDARD_DIFFICULTY,
    ...profile,
    id: profile?.id ?? STANDARD_DIFFICULTY.id,
    attackBudgets: profile?.attackBudgets ?? STANDARD_DIFFICULTY.attackBudgets,
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
    origin: ENEMY_ORIGINS.WITCH,
    kind: PROJECTILE_KINDS.HEX_BOLT,
    mode: "direct",
    sourceType: "hexer",
    actionId: null,
    ownerEnemyId: null,
    ownerEnemyType: null,
    ownerEnemyOrigin: ENEMY_ORIGINS.WITCH,
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
    this.arena = null;
    this.rng = null;
    this.difficulty = STANDARD_DIFFICULTY;
    this.attackCoordinator = new AttackCoordinator();
    this.bossModifiers = { health: 0, enrage: 0 };
    this.bombardierAttackCooldown = 0;
    this.encounterPlan = null;
    this.pendingWaves = [];
    this.waveDelay = 0;
    this.encounterFloor = 1;
    this.queenPatternState = null;
    this.witchOriginDismissed = false;
  }

  reset({ arena, floor, room, rng, difficulty, bossModifiers = {} }) {
    this.attackCoordinator.reset("encounterReset");
    this.enemies.length = 0;
    this.deactivateProjectiles();
    this.arena = arena;
    this.rng = rng;
    this.difficulty = completeDifficultyProfile(difficulty);
    this.bossModifiers = { health: bossModifiers.health ?? 0, enrage: bossModifiers.enrage ?? 0 };
    this.bombardierAttackCooldown = 0;
    this.encounterFloor = floor;
    this.encounterPlan = null;
    this.pendingWaves.length = 0;
    this.waveDelay = 0;
    this.queenPatternState = createQueenPatternState(rng.fork("queen-patterns"));
    this.witchOriginDismissed = false;

    if (arena.boss) {
      this.spawnEnemy("queen", { x: 0, z: 2.5 }, floor, { origin: ENEMY_ORIGINS.WITCH });
      return;
    }

    this.encounterPlan = createEncounterPlan({
      floor,
      room,
      biome: arena.biome,
      spawnPoints: arena.enemySpawnPoints,
      rng: rng.fork("plan"),
    });
    this.pendingWaves = [...this.encounterPlan.waves];
    this.startNextWave();
  }

  spawnEnemy(type, position, floor = 1, options = {}) {
    const definition = getEnemyArchetype(type);
    const requestedOrigin = options.origin ?? ENEMY_ORIGINS.WITCH;
    if (!Object.values(ENEMY_ORIGINS).includes(requestedOrigin)) throw new RangeError(`Unknown enemy origin: ${requestedOrigin}`);
    const origin = type === "queen" ? ENEMY_ORIGINS.WITCH : requestedOrigin;
    const stats = definition.stats;
    const difficulty = completeDifficultyProfile(this.difficulty);
    const floorHealth = 1 + Math.max(0, floor - 1) * (type === "queen" ? 0.02 : 0.078);
    const bossHealth = type === "queen" ? 1 + this.bossModifiers.health : 1;
    const maxHealth = Math.round(stats.maxHealth * floorHealth * difficulty.enemyHealth * bossHealth);
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
      speed: stats.speed * difficulty.enemySpeed * (type === "queen" ? 1 + this.bossModifiers.enrage : 1),
      damage: stats.damage * difficulty.enemyDamage,
      attackRange: stats.attackRange,
      attackCooldown: this.rng?.float(0.2, 1) ?? 0.5,
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
      knockback: { x: 0, z: 0 },
      bossPhase: 1,
      decisionTimer: this.rng?.float(0, 0.18) ?? 0,
      lastAttackKind: null,
      queenActionMeta: null,
      queenSpecialKind: null,
      queenSpecialStage: null,
      queenSpecialActionId: null,
      queenSpecialTarget: null,
    };
    this.enemies.push(enemy);
    this.emit("enemySpawned", {
      id: enemy.id,
      type: enemy.type,
      origin: enemy.origin,
      originPhase: enemy.originPhase,
      formationIndex: enemy.formationIndex,
      position: clonePosition(enemy.position),
    });
    return enemy;
  }

  update(dt, player, resolvePlayerDamage) {
    this.bombardierAttackCooldown = Math.max(0, this.bombardierAttackCooldown - dt);
    for (const enemy of this.enemies) {
      if (!enemy.active) this.releaseAttackLease(enemy, "inactive");
    }
    this.beginAttackStep();
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.previousPosition.x = enemy.position.x;
      enemy.previousPosition.z = enemy.position.z;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      this.updatePoise(enemy, dt);

      if (this.updateStagger(enemy, dt)) continue;
      if (enemy.type === "queen" && this.updateQueenPhase(enemy, dt)) continue;
      if (this.updateKnockback(enemy, dt)) continue;
      if (this.updateDash(enemy, dt, player, resolvePlayerDamage)) continue;
      this.updateEnemyBehavior(enemy, dt, player, resolvePlayerDamage);
    }

    separateCircles(this.enemies);
    this.updateProjectiles(dt, player, resolvePlayerDamage);
    this.updateEncounterWaves(dt);
  }

  startNextWave() {
    const wave = this.pendingWaves.shift();
    if (!wave) return false;
    for (let index = 0; index < wave.entries.length; index += 1) {
      const entry = wave.entries[index];
      const fallback = { x: index - wave.entries.length / 2, z: 4 };
      const spawn = this.arena.enemySpawnPoints[entry.spawnIndex % Math.max(1, this.arena.enemySpawnPoints.length)] ?? fallback;
      const definition = getEnemyArchetype(entry.type);
      const position = entry.origin === ENEMY_ORIGINS.PRINCESS
        ? this.findOpenPoint({
          x: spawn.x + Math.cos(entry.originPhase) * 0.55,
          z: spawn.z + Math.sin(entry.originPhase) * 0.55,
        }, definition.stats.radius)
        : spawn;
      this.spawnEnemy(entry.type, position, this.encounterFloor, entry);
    }
    this.waveDelay = this.pendingWaves[0]?.delay ?? 0;
    const originCounts = wave.entries.reduce((counts, entry) => {
      counts[entry.origin] += 1;
      return counts;
    }, { [ENEMY_ORIGINS.WITCH]: 0, [ENEMY_ORIGINS.PRINCESS]: 0 });
    this.emit("encounterWaveStarted", {
      planId: this.encounterPlan?.id ?? null,
      wave: wave.index + 1,
      totalWaves: this.encounterPlan?.waves.length ?? 1,
      types: wave.entries.map((entry) => entry.type),
      originCounts,
    });
    return true;
  }

  updateEncounterWaves(dt) {
    if (this.hasLivingEnemies() || this.pendingWaves.length === 0) return;
    this.waveDelay = Math.max(0, this.waveDelay - dt);
    if (this.waveDelay <= 0) this.startNextWave();
  }

  updateKnockback(enemy, dt) {
    const speed = Math.hypot(enemy.knockback.x, enemy.knockback.z);
    if (speed <= 0.2) return false;
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
      if (this.beginAttack(enemy, attack, player.position, toPlayer)) return;
    }
    this.moveEnemy(enemy, toPlayer.x, toPlayer.z, enemy.speed, dt);
  }

  updateReaver(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance <= 2.55 ? "crosscut" : "dashLane";
      if (this.beginAttack(enemy, attack, player.position, toPlayer)) return;
    }
    this.steerAtRange(enemy, toPlayer, 4.5, 7.2, dt);
  }

  updateBoneguard(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance > 3.35 ? "guardCharge" : "shieldSlam";
      if (this.beginAttack(enemy, attack, player.position, toPlayer)) return;
    }
    this.moveEnemy(enemy, toPlayer.x, toPlayer.z, enemy.speed, dt);
  }

  updateHexer(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      let spell;
      if (toPlayer.distance < 5.6) spell = enemy.lastAttackKind === "rune" ? "fan" : "rune";
      else if (toPlayer.distance > 8.2) spell = enemy.lastAttackKind === "aimedBolt" ? "fan" : "aimedBolt";
      else spell = enemy.lastAttackKind === "fan" ? "aimedBolt" : "fan";
      if (this.beginAttack(enemy, spell, player.position, toPlayer)) return;
    }
    this.steerAtRange(enemy, toPlayer, 6.1, 9, dt);
  }

  updateWraith(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      if (toPlayer.distance <= 3.15) {
        if (this.beginAttack(enemy, "veilSweep", player.position, toPlayer)) return;
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
      const target = attack === "lobbedBomb" ? this.findOpenPoint(player.position, 0.2) : player.position;
      if (this.beginAttack(enemy, attack, target, toPlayer)) {
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
        if (!this.beginAttack(enemy, action, player.position, toPlayer)) {
          if (toPlayer.distance > 5) this.moveEnemy(enemy, toPlayer.x, toPlayer.z, enemy.speed, dt);
        }
      }
      return;
    }
    if (toPlayer.distance > 5) this.moveEnemy(enemy, toPlayer.x, toPlayer.z, enemy.speed, dt);
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

  planQueenTeleport(enemy) {
    const point = this.rng.pick(this.arena.enemySpawnPoints) ?? { x: 0, z: 0 };
    return this.findOpenPoint({ x: point.x * 0.72, z: point.z * 0.72 }, enemy.radius);
  }

  teleportQueen(enemy, plannedTarget = null, actionId = null) {
    const previousPosition = clonePosition(enemy.position);
    const target = plannedTarget ?? this.planQueenTeleport(enemy);
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
      this.spawnEnemy(selectedTypes[index], position, 10, { origin: enemy.origin, formationIndex: index });
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
      && enemy.origin === ENEMY_ORIGINS.WITCH
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

  moveEnemy(enemy, directionX, directionZ, speed, dt) {
    if (Math.hypot(directionX, directionZ) > 0.01) {
      enemy.facing.x = directionX;
      enemy.facing.z = directionZ;
    }
    enemy.position = moveCircle(enemy.position, { x: directionX * speed, z: directionZ * speed }, dt, enemy.radius, this.arena);
  }

  steerAtRange(enemy, toPlayer, minimumDistance, maximumDistance, dt) {
    let directionX;
    let directionZ;
    if (toPlayer.distance < minimumDistance) {
      directionX = -toPlayer.x;
      directionZ = -toPlayer.z;
    } else if (toPlayer.distance > maximumDistance) {
      directionX = toPlayer.x;
      directionZ = toPlayer.z;
    } else {
      directionX = -toPlayer.z * enemy.strafeDirection;
      directionZ = toPlayer.x * enemy.strafeDirection;
    }
    this.moveEnemy(enemy, directionX, directionZ, enemy.speed, dt);
  }

  currentDifficulty() {
    return completeDifficultyProfile(this.difficulty);
  }

  beginAttackStep() {
    const activeEnemyIds = this.enemies
      .filter((enemy) => enemy.active)
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

  beginAttack(enemy, attackKind, target, direction) {
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
      }));
      return null;
    }
    enemy.attackPending = true;
    enemy.attackKind = attackKind;
    enemy.attackActionId = `enemy-action-${this.nextEnemyActionId++}`;
    enemy.attackLeaseId = lease.leaseId;
    enemy.attackLeaseFamily = lease.family;
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
      ...(enemy.type === "queen" ? this.queenComboDetail(enemy.queenActionMeta) : {}),
    });
    this.emit("enemyAttackLeaseGranted", Object.freeze({
      leaseId: lease.leaseId,
      actionId: enemy.attackActionId,
      enemyId: enemy.id,
      family: lease.family,
      difficultyId: lease.difficultyId,
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

    enemy.attackCooldown = this.scaleAttackCooldown(enemy, attack.cooldown, {
      comboContinues: enemy.type === "queen" && enemy.queenActionMeta?.continuesCombo === true,
    });
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
      ...(enemy.type === "queen" ? this.queenComboDetail(enemy.queenActionMeta) : {}),
    });
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
    projectile.origin = options.origin ?? ENEMY_ORIGINS.WITCH;
    projectile.kind = options.kind ?? PROJECTILE_KINDS.HEX_BOLT;
    projectile.mode = options.mode ?? "direct";
    projectile.sourceType = options.sourceType ?? "projectile";
    projectile.actionId = options.actionId ?? `projectile-action-${projectile.id}`;
    projectile.ownerEnemyId = options.enemyId ?? null;
    projectile.ownerEnemyType = options.enemyType ?? options.sourceType ?? null;
    projectile.ownerEnemyOrigin = options.enemyOrigin ?? options.origin ?? ENEMY_ORIGINS.WITCH;
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
    const halfWidth = this.arena.width / 2 - 0.7;
    const halfDepth = this.arena.depth / 2 - 0.7;
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

      if (projectile.life <= 0) {
        if (projectile.mode === "lob" || projectile.mode === "rune") this.detonateProjectile(projectile, player, resolvePlayerDamage);
        else this.deactivateProjectile(projectile);
        continue;
      }

      if (projectile.mode !== "direct") continue;
      if (Math.abs(projectile.position.x) > halfWidth || Math.abs(projectile.position.z) > halfDepth) {
        this.deactivateProjectile(projectile);
        continue;
      }
      const combinedRadius = projectile.radius + player.radius;
      if (segmentDistanceSquared(projectile.previousPosition, projectile.position, player.position) <= combinedRadius * combinedRadius) {
        this.deactivateProjectile(projectile);
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
    const halfWidth = this.arena.width / 2 - radius - 0.8;
    const halfDepth = this.arena.depth / 2 - radius - 0.8;
    const candidate = {
      x: Math.max(-halfWidth, Math.min(halfWidth, point.x)),
      z: Math.max(-halfDepth, Math.min(halfDepth, point.z)),
    };
    for (const obstacle of this.arena.obstacles) {
      const blockedX = Math.abs(candidate.x - obstacle.x) < obstacle.width / 2 + radius;
      const blockedZ = Math.abs(candidate.z - obstacle.z) < obstacle.depth / 2 + radius;
      if (!blockedX || !blockedZ) continue;
      const left = obstacle.x - obstacle.width / 2 - radius - 0.15;
      const right = obstacle.x + obstacle.width / 2 + radius + 0.15;
      candidate.x = Math.abs(candidate.x - left) < Math.abs(candidate.x - right) ? left : right;
      candidate.x = Math.max(-halfWidth, Math.min(halfWidth, candidate.x));
    }
    return candidate;
  }

  queryClaimCandidates({ pass, from, to, radius, arc = null, direction = null }) {
    if (!["outbound", "recall", "cleave"].includes(pass) || !finitePoint(from) || !finitePoint(to)) return [];
    if (!Number.isFinite(radius) || radius < 0) return [];
    if (pass === "cleave") {
      if (!finitePoint(direction) || !Number.isFinite(arc) || arc <= 0) return [];
      const facing = Math.atan2(direction.z, direction.x);
      return this.enemies.filter((enemy) => (
        enemy.active && circleIntersectsArc(from, facing, radius, arc, enemy.position, enemy.radius)
      ));
    }
    return this.enemies.filter((enemy) => {
      if (!enemy.active) return false;
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
    if (!enemy?.active || !this.arena || !finitePoint(origin) || boundedDistance <= 0) {
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
    this.clearQueenSpecial(enemy);
  }

  hasLivingEnemies() {
    return this.enemies.some((enemy) => enemy.active);
  }

  hasCombatRemaining() {
    return this.hasLivingEnemies() || this.pendingWaves.length > 0;
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

  dismissWitchOrigin() {
    if (this.witchOriginDismissed) return null;
    this.witchOriginDismissed = true;
    const actors = [];
    for (const enemy of this.enemies) {
      if (!enemy.active || enemy.origin !== ENEMY_ORIGINS.WITCH) continue;
      this.clearEnemyCommitment(enemy, "dismissed");
      enemy.active = false;
      enemy.dismissed = true;
      actors.push({ id: enemy.id, type: enemy.type, position: clonePosition(enemy.position) });
    }
    let projectiles = 0;
    for (const projectile of this.projectiles) {
      if (!projectile.active || projectile.origin !== ENEMY_ORIGINS.WITCH) continue;
      projectiles += 1;
      this.deactivateProjectile(projectile);
    }
    let pendingEntries = 0;
    this.pendingWaves = this.pendingWaves.flatMap((wave) => {
      const entries = wave.entries.filter((entry) => {
        if (entry.origin !== ENEMY_ORIGINS.WITCH) return true;
        pendingEntries += 1;
        return false;
      });
      return entries.length > 0 ? [{ ...wave, entries }] : [];
    });
    const detail = { origin: ENEMY_ORIGINS.WITCH, actors, projectiles, pendingEntries };
    this.emit("witchOriginDismissed", detail);
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
