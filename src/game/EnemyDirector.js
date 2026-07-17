import { moveCircle, separateCircles } from "./collision.js";
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
  QUEEN_SUMMON_CAP,
} from "./bossPatterns.js";
import { createEncounterPlan } from "./encounterPatterns.js";

const PROJECTILE_POOL_SIZE = 144;
const BOMBADIER_ATTACK_SPACING = 1.15;
const STANDARD_DIFFICULTY = Object.freeze({ enemyHealth: 1, enemyDamage: 1, enemySpeed: 1 });

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

function createProjectile() {
  return {
    active: false,
    kind: PROJECTILE_KINDS.HEX_BOLT,
    mode: "direct",
    sourceType: "hexer",
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
    this.arena = null;
    this.rng = null;
    this.difficulty = STANDARD_DIFFICULTY;
    this.bossModifiers = { health: 0, enrage: 0 };
    this.bombardierAttackCooldown = 0;
    this.encounterPlan = null;
    this.pendingWaves = [];
    this.waveDelay = 0;
    this.encounterFloor = 1;
    this.queenPatternState = null;
  }

  reset({ arena, floor, room, rng, difficulty, bossModifiers = {} }) {
    this.enemies.length = 0;
    this.deactivateProjectiles();
    this.arena = arena;
    this.rng = rng;
    this.difficulty = difficulty ?? STANDARD_DIFFICULTY;
    this.bossModifiers = { health: bossModifiers.health ?? 0, enrage: bossModifiers.enrage ?? 0 };
    this.bombardierAttackCooldown = 0;
    this.encounterFloor = floor;
    this.encounterPlan = null;
    this.pendingWaves.length = 0;
    this.waveDelay = 0;
    this.queenPatternState = createQueenPatternState(rng.fork("queen-patterns"));

    if (arena.boss) {
      this.spawnEnemy("queen", { x: 0, z: 2.5 }, floor);
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

  spawnEnemy(type, position, floor = 1) {
    const definition = getEnemyArchetype(type);
    const stats = definition.stats;
    const difficulty = this.difficulty ?? STANDARD_DIFFICULTY;
    const floorHealth = 1 + Math.max(0, floor - 1) * (type === "queen" ? 0.02 : 0.078);
    const bossHealth = type === "queen" ? 1 + this.bossModifiers.health : 1;
    const maxHealth = Math.round(stats.maxHealth * floorHealth * difficulty.enemyHealth * bossHealth);
    const enemy = {
      id: this.nextEnemyId++,
      type,
      modelKey: definition.modelKey,
      behavior: definition.behavior,
      active: true,
      position: clonePosition(position),
      previousPosition: clonePosition(position),
      facing: { x: 0, z: 1 },
      radius: stats.radius,
      maxHealth,
      health: maxHealth,
      speed: stats.speed * difficulty.enemySpeed * (type === "queen" ? 1 + this.bossModifiers.enrage : 1),
      damage: stats.damage * difficulty.enemyDamage,
      attackRange: stats.attackRange,
      attackCooldown: this.rng?.float(0.2, 1) ?? 0.5,
      attackWindup: 0,
      attackPending: false,
      attackKind: null,
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
    };
    this.enemies.push(enemy);
    return enemy;
  }

  update(dt, player, damagePlayer) {
    this.bombardierAttackCooldown = Math.max(0, this.bombardierAttackCooldown - dt);
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.previousPosition.x = enemy.position.x;
      enemy.previousPosition.z = enemy.position.z;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

      if (enemy.type === "queen" && this.updateQueenPhase(enemy, dt)) continue;
      if (this.updateKnockback(enemy, dt)) continue;
      if (this.updateDash(enemy, dt, player, damagePlayer)) continue;
      this.updateEnemyBehavior(enemy, dt, player, damagePlayer);
    }

    separateCircles(this.enemies);
    this.updateProjectiles(dt, player, damagePlayer);
    this.updateEncounterWaves(dt);
  }

  startNextWave() {
    const wave = this.pendingWaves.shift();
    if (!wave) return false;
    for (let index = 0; index < wave.entries.length; index += 1) {
      const entry = wave.entries[index];
      const fallback = { x: index - wave.entries.length / 2, z: 4 };
      const spawn = this.arena.enemySpawnPoints[entry.spawnIndex % Math.max(1, this.arena.enemySpawnPoints.length)] ?? fallback;
      this.spawnEnemy(entry.type, spawn, this.encounterFloor);
    }
    this.waveDelay = this.pendingWaves[0]?.delay ?? 0;
    this.emit("encounterWaveStarted", {
      planId: this.encounterPlan?.id ?? null,
      wave: wave.index + 1,
      totalWaves: this.encounterPlan?.waves.length ?? 1,
      types: wave.entries.map((entry) => entry.type),
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

  updateEnemyBehavior(enemy, dt, player, damagePlayer) {
    if (this.updateWindup(enemy, dt, player, damagePlayer)) return;
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
      this.beginAttack(enemy, attack, player.position, toPlayer);
      return;
    }
    this.moveEnemy(enemy, toPlayer.x, toPlayer.z, enemy.speed, dt);
  }

  updateReaver(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance <= 2.55 ? "crosscut" : "dashLane";
      this.beginAttack(enemy, attack, player.position, toPlayer);
      return;
    }
    this.steerAtRange(enemy, toPlayer, 4.5, 7.2, dt);
  }

  updateBoneguard(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance > 3.35 ? "guardCharge" : "shieldSlam";
      this.beginAttack(enemy, attack, player.position, toPlayer);
      return;
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
      this.beginAttack(enemy, spell, player.position, toPlayer);
      return;
    }
    this.steerAtRange(enemy, toPlayer, 6.1, 9, dt);
  }

  updateWraith(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      if (toPlayer.distance <= 3.15) {
        this.beginAttack(enemy, "veilSweep", player.position, toPlayer);
        return;
      }
      const sideX = -toPlayer.z * enemy.strafeDirection;
      const sideZ = toPlayer.x * enemy.strafeDirection;
      const target = this.findOpenPoint({ x: player.position.x + sideX * 1.85, z: player.position.z + sideZ * 1.85 }, enemy.radius);
      const direction = normalize(target.x - enemy.position.x, target.z - enemy.position.z);
      this.beginAttack(enemy, "blinkFlank", target, direction);
      enemy.strafeDirection *= -1;
      return;
    }
    this.steerAtRange(enemy, toPlayer, 4.2, 7.2, dt);
  }

  updateBombardier(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0 && this.bombardierAttackCooldown <= 0 && toPlayer.distance <= enemy.attackRange) {
      const attack = toPlayer.distance < 7.2 ? "cinderBurst" : "lobbedBomb";
      const target = attack === "lobbedBomb" ? this.findOpenPoint(player.position, 0.2) : player.position;
      this.beginAttack(enemy, attack, target, toPlayer);
      this.bombardierAttackCooldown = BOMBADIER_ATTACK_SPACING;
      return;
    }
    this.steerAtRange(enemy, toPlayer, 7, 10, dt);
  }

  updateQueen(enemy, dt, player) {
    const toPlayer = this.facePlayer(enemy, player);
    if (enemy.attackCooldown <= 0) {
      const action = this.chooseQueenAction(enemy);
      if (action === "teleport") {
        this.teleportQueen(enemy);
      } else if (action === "summon") {
        this.summonQueenGuard(enemy);
      } else {
        this.beginAttack(enemy, action, player.position, toPlayer);
      }
      return;
    }
    if (toPlayer.distance > 5) this.moveEnemy(enemy, toPlayer.x, toPlayer.z, enemy.speed, dt);
  }

  chooseQueenAction(enemy) {
    const guardCount = this.enemies.filter((actor) => actor.active && actor.type !== "queen").length;
    const hazardCount = this.activeQueenHazardCount();
    if (!this.queenPatternState) this.queenPatternState = createQueenPatternState(this.rng.fork("queen-patterns"));
    return nextQueenAction(this.queenPatternState, enemy.bossPhase, { guardCount, hazardCount });
  }

  updateQueenPhase(enemy, dt) {
    const phase = queenPhaseForHealth(enemy.health, enemy.maxHealth);
    if (phase > enemy.bossPhase && enemy.state !== "phaseTransition") {
      enemy.bossPhase = phase;
      enemy.state = "phaseTransition";
      enemy.actionTimer = 0.82;
      enemy.attackPending = false;
      enemy.attackWindup = 0;
      enemy.attackKind = null;
      enemy.attackCooldown = 0.82;
      this.deactivateProjectilesFrom("queen");
      this.emit("bossPhaseChanged", {
        enemyId: enemy.id,
        phase,
        duration: enemy.actionTimer,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        position: clonePosition(enemy.position),
      });
    }
    if (enemy.state !== "phaseTransition") return false;
    enemy.actionTimer = Math.max(0, enemy.actionTimer - dt);
    if (enemy.actionTimer <= 0) {
      enemy.state = "chase";
      enemy.attackCooldown = 0.18;
    }
    return true;
  }

  teleportQueen(enemy) {
    const previousPosition = clonePosition(enemy.position);
    const point = this.rng.pick(this.arena.enemySpawnPoints) ?? { x: 0, z: 0 };
    const target = this.findOpenPoint({ x: point.x * 0.72, z: point.z * 0.72 }, enemy.radius);
    enemy.position.x = target.x;
    enemy.position.z = target.z;
    enemy.previousPosition.x = target.x;
    enemy.previousPosition.z = target.z;
    enemy.attackCooldown = 0.75;
    this.emit("queenTeleport", { position: clonePosition(enemy.position), previousPosition });
  }

  summonQueenGuard(enemy) {
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
      this.spawnEnemy(selectedTypes[index], position, 10);
    }
    enemy.attackCooldown = 2;
    this.emit("queenSummon", { position: clonePosition(enemy.position), types: selectedTypes });
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

  beginAttack(enemy, attackKind, target, direction) {
    const attack = getEnemyArchetype(enemy.type).attacks[attackKind];
    if (!attack) throw new RangeError(`${enemy.type} cannot use ${attackKind}`);
    enemy.attackPending = true;
    enemy.attackKind = attackKind;
    enemy.attackWindup = attack.windup;
    enemy.attackTarget.x = target.x;
    enemy.attackTarget.z = target.z;
    enemy.attackDirection.x = direction.x;
    enemy.attackDirection.z = direction.z;
    const targetedCircle = attackKind === "rune" || attackKind === "lobbedBomb" || attackKind === "voidWell";
    this.emit("enemyTelegraph", {
      enemyId: enemy.id,
      type: enemy.type,
      attack: attackKind,
      shape: attack.shape,
      position: targetedCircle ? clonePosition(target) : clonePosition(enemy.position),
      origin: clonePosition(enemy.position),
      target: clonePosition(target),
      direction: { x: direction.x, z: direction.z },
      radius: attack.radius,
      width: attack.width,
      duration: attack.windup,
    });
  }

  updateWindup(enemy, dt, player, damagePlayer) {
    if (!enemy.attackPending) return false;
    enemy.attackWindup -= dt;
    if (enemy.attackWindup > 0) return true;
    const attackKind = enemy.attackKind;
    enemy.attackPending = false;
    enemy.attackKind = null;
    this.executeAttack(enemy, attackKind, player, damagePlayer);
    return true;
  }

  executeAttack(enemy, attackKind, player, damagePlayer) {
    const attack = getEnemyArchetype(enemy.type).attacks[attackKind];
    switch (attackKind) {
      case "lunge":
        this.startDash(enemy, attackKind, attack);
        break;
      case "graveCleave":
        if (this.isPlayerInsideAttack(enemy, attack, player)) damagePlayer(enemy.damage * 0.92, attackKind);
        break;
      case "dashLane":
      case "guardCharge":
      case "royalDash":
        this.startDash(enemy, attackKind, attack);
        break;
      case "crosscut":
      case "veilSweep":
      case "shieldSlam":
      case "royalSlam":
        if (isInsideCircle(enemy.position, attack.radius, player.position, player.radius)) damagePlayer(enemy.damage, attackKind);
        break;
      case "aimedBolt":
        this.spawnProjectile(enemy.position, Math.atan2(enemy.attackDirection.z, enemy.attackDirection.x), 11.5, enemy.damage, 2.25, "violet", {
          kind: PROJECTILE_KINDS.HEX_BOLT,
          sourceType: enemy.type,
          radius: 0.24,
        });
        break;
      case "fan":
        this.spawnFan(enemy, 5, 0.58, 8.5, enemy.damage * 0.78, PROJECTILE_KINDS.HEX_SHARD, "violet");
        break;
      case "rune":
        this.spawnAreaProjectile(enemy, PROJECTILE_KINDS.HEX_RUNE, "rune", attack.radius, 0.82, "violet");
        break;
      case "blinkFlank":
        enemy.position.x = enemy.attackTarget.x;
        enemy.position.z = enemy.attackTarget.z;
        enemy.previousPosition.x = enemy.attackTarget.x;
        enemy.previousPosition.z = enemy.attackTarget.z;
        if (isInsideCircle(enemy.position, attack.radius, player.position, player.radius)) damagePlayer(enemy.damage, attackKind);
        this.emit("enemyBlink", { enemyId: enemy.id, type: enemy.type, position: clonePosition(enemy.position) });
        break;
      case "lobbedBomb":
        this.spawnAreaProjectile(enemy, PROJECTILE_KINDS.CINDER_BOMB, "lob", attack.radius, attack.travelTime, "ember");
        break;
      case "cinderBurst":
        this.spawnFan(enemy, 4, 0.72, 8.2, enemy.damage * 0.72, PROJECTILE_KINDS.CINDER_SHARD, "ember");
        break;
      case "royalVolley":
        this.spawnQueenVolley(enemy);
        this.emit("queenVolley", { position: clonePosition(enemy.position), phase: enemy.bossPhase });
        break;
      case "royalFan":
        this.spawnFan(enemy, enemy.bossPhase === 3 ? 11 : enemy.bossPhase === 2 ? 9 : 7, 0.88, 9.5, enemy.damage * 0.72, PROJECTILE_KINDS.QUEEN_ORB, "violet");
        break;
      case "royalLance":
        this.spawnProjectile(enemy.position, Math.atan2(enemy.attackDirection.z, enemy.attackDirection.x), 15, enemy.damage * 1.05, 1.35, "violet", {
          kind: PROJECTILE_KINDS.QUEEN_LANCE,
          sourceType: enemy.type,
          radius: 0.34,
        });
        break;
      case "voidWell":
        this.spawnAreaProjectile(enemy, PROJECTILE_KINDS.QUEEN_WELL, "rune", attack.radius, attack.duration, "violet");
        break;
      default:
        throw new RangeError(`Attack execution is not implemented: ${attackKind}`);
    }

    enemy.attackCooldown = attack.cooldown;
    enemy.lastAttackKind = attackKind;
    this.emit("enemyAttack", {
      enemyId: enemy.id,
      type: enemy.type,
      attack: attackKind,
      shape: attack.shape,
      position: clonePosition(enemy.position),
      target: clonePosition(enemy.attackTarget),
      direction: clonePosition(enemy.attackDirection),
      radius: attack.radius,
      width: attack.width,
    });
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

  startDash(enemy, attackKind, attack) {
    enemy.state = "dash";
    enemy.actionTimer = attack.dashDuration ?? 0.18;
    enemy.actionSpeed = attack.dashSpeed ?? 13.5;
    enemy.actionHit = false;
    enemy.attackKind = attackKind;
  }

  updateDash(enemy, dt, player, damagePlayer) {
    if (enemy.state !== "dash") return false;
    enemy.actionTimer -= dt;
    this.moveEnemy(enemy, enemy.attackDirection.x, enemy.attackDirection.z, enemy.actionSpeed, dt);
    if (!enemy.actionHit && isInsideCircle(enemy.position, enemy.radius + 0.35, player.position, player.radius)) {
      enemy.actionHit = true;
      damagePlayer(enemy.damage, enemy.attackKind);
    }
    if (enemy.actionTimer <= 0) {
      enemy.state = "chase";
      enemy.attackKind = null;
      enemy.actionSpeed = 0;
    }
    return true;
  }

  spawnFan(enemy, count, spread, speed, damage, kind, color) {
    const centerAngle = Math.atan2(enemy.attackDirection.z, enemy.attackDirection.x);
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
      this.spawnProjectile(enemy.position, centerAngle + offset, speed, damage, 2.7, color, {
        kind,
        sourceType: enemy.type,
        radius: kind === PROJECTILE_KINDS.QUEEN_ORB ? 0.32 : 0.23,
      });
    }
  }

  spawnQueenVolley(enemy) {
    const count = enemy.bossPhase === 2 ? 16 : 10;
    const offset = this.rng.float(0, Math.PI * 2);
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + offset + this.rng.float(-0.035, 0.035);
      this.spawnProjectile(enemy.position, angle, enemy.bossPhase === 2 ? 9 : 7.5, enemy.damage * 0.68, 3.6, "violet", {
        kind: PROJECTILE_KINDS.QUEEN_ORB,
        sourceType: enemy.type,
        radius: 0.32,
      });
    }
  }

  spawnAreaProjectile(enemy, kind, mode, areaRadius, life, color) {
    const angle = Math.atan2(enemy.attackTarget.z - enemy.position.z, enemy.attackTarget.x - enemy.position.x);
    const distance = distanceBetween(enemy.position, enemy.attackTarget);
    this.spawnProjectile(enemy.position, angle, distance / life, enemy.damage, life, color, {
      kind,
      mode,
      sourceType: enemy.type,
      target: enemy.attackTarget,
      areaRadius,
      radius: mode === "lob" ? 0.38 : areaRadius,
    });
  }

  spawnProjectile(position, angle, speed, damage, life, color, options = {}) {
    const projectile = this.projectiles.find((entry) => !entry.active);
    if (!projectile) return null;
    projectile.active = true;
    projectile.kind = options.kind ?? PROJECTILE_KINDS.HEX_BOLT;
    projectile.mode = options.mode ?? "direct";
    projectile.sourceType = options.sourceType ?? "projectile";
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

  updateProjectiles(dt, player, damagePlayer) {
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
        if (projectile.mode === "lob" || projectile.mode === "rune") this.detonateProjectile(projectile, player, damagePlayer);
        else projectile.active = false;
        continue;
      }

      if (projectile.mode !== "direct") continue;
      if (Math.abs(projectile.position.x) > halfWidth || Math.abs(projectile.position.z) > halfDepth) {
        projectile.active = false;
        continue;
      }
      const combinedRadius = projectile.radius + player.radius;
      if (segmentDistanceSquared(projectile.previousPosition, projectile.position, player.position) <= combinedRadius * combinedRadius) {
        projectile.active = false;
        damagePlayer(projectile.damage, projectile.kind);
      }
    }
  }

  detonateProjectile(projectile, player, damagePlayer) {
    projectile.position.x = projectile.target.x;
    projectile.position.z = projectile.target.z;
    projectile.height = 0;
    if (isInsideCircle(projectile.position, projectile.areaRadius, player.position, player.radius)) {
      damagePlayer(projectile.damage, projectile.kind);
    }
    this.emit("projectileImpact", {
      kind: projectile.kind,
      sourceType: projectile.sourceType,
      shape: "circle",
      position: clonePosition(projectile.position),
      radius: projectile.areaRadius,
    });
    projectile.active = false;
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

  damageEnemy(enemy, damage, direction, knockback, critical = false) {
    if (!enemy.active) return false;
    if (enemy.type === "queen" && enemy.state === "phaseTransition") return false;
    const incomingX = -direction.x;
    const incomingZ = -direction.z;
    const frontalHit = incomingX * enemy.facing.x + incomingZ * enemy.facing.z > 0.3;
    const blocked = enemy.type === "boneguard" && enemy.state !== "dash" && !enemy.attackPending && frontalHit;
    const appliedDamage = blocked ? damage * 0.52 : damage;
    const appliedKnockback = blocked ? knockback * 0.35 : knockback;
    enemy.health -= appliedDamage;
    enemy.hitFlash = 0.09;
    if (enemy.type !== "queen") {
      enemy.knockback.x += direction.x * appliedKnockback;
      enemy.knockback.z += direction.z * appliedKnockback;
    }
    if (blocked) this.emit("enemyBlock", { id: enemy.id, type: enemy.type, position: clonePosition(enemy.position) });
    this.emit("enemyHit", {
      id: enemy.id,
      type: enemy.type,
      position: clonePosition(enemy.position),
      damage: appliedDamage,
      critical,
      blocked,
      health: Math.max(0, enemy.health),
      maxHealth: enemy.maxHealth,
    });
    if (enemy.health > 0) return false;
    enemy.active = false;
    this.emit("enemyDefeated", { id: enemy.id, type: enemy.type, position: clonePosition(enemy.position) });
    return true;
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
    for (const projectile of this.projectiles) projectile.active = false;
  }

  deactivateProjectilesFrom(sourceType) {
    for (const projectile of this.projectiles) {
      if (projectile.active && projectile.sourceType === sourceType) projectile.active = false;
    }
  }

  activeQueenHazardCount() {
    return this.projectiles.filter((projectile) => (
      projectile.active &&
      projectile.sourceType === "queen" &&
      projectile.mode !== "direct"
    )).length;
  }

  stressSpawn(count, floor = 9) {
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
