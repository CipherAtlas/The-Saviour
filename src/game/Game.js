import { BLESSINGS, chooseBlessings } from "./blessings.js";
import { circleIntersectsArc, moveCircleDetailed, SpatialHash } from "./collision.js";
import { DialogueSystem } from "./DialogueSystem.js";
import { EnemyDirector } from "./EnemyDirector.js";
import { CAMERA_CONFIG, DIFFICULTY, PLAYER_CONFIG, PORTAL_CONFIG, RUN_CONFIG } from "./gameConfig.js";
import { PlayerCombat } from "./PlayerCombat.js";
import {
  applyRunUpgrade,
  offerUpgradeChoices,
  RUN_UPGRADES,
  summarizeUpgradePaths,
} from "./runUpgrades.js";
import { generateArena } from "../generation/arenaGenerator.js";
import { createRunSeed, SeededRandom } from "../generation/seededRandom.js";

function clonePosition(position) {
  return { x: position.x, z: position.z };
}

function publicUpgradeChoice(choice) {
  return {
    id: choice.id,
    name: choice.name,
    description: choice.description,
    path: choice.path,
    tier: choice.tier,
    rank: choice.rank,
    nextRank: choice.nextRank,
    maxRank: Number.isFinite(choice.maxRank) ? choice.maxRank : null,
    fallback: choice.fallback === true,
  };
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
    this.dialogue = new DialogueSystem();
    this.combat = new PlayerCombat((type, detail) => this.emit(type, detail));
    this.director = new EnemyDirector((type, detail) => this.handleDirectorEvent(type, detail));
    this.spatialHash = new SpatialHash(5.5);
    this.phase = "title";
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
    this.pendingBlessings = [];
    this.pendingRoomRewards = [];
    this.roomRewardPending = false;
    this.pendingDialogueCallback = null;
    this.dialogueAwaitingResponse = false;
    this.bossModifiers = { health: 0, enrage: 0 };
    this.ending = null;
    this.benchmarkMode = false;
    this.showcaseMode = null;
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, detail = {}) {
    for (const listener of this.listeners) listener({ type, detail });
  }

  startRun(seed = createRunSeed()) {
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.floor = 1;
    this.room = 1;
    this.flags = {};
    this.ownedBlessings.clear();
    this.upgradeRanks.clear();
    this.pendingBlessings = [];
    this.pendingRoomRewards = [];
    this.roomRewardPending = false;
    this.bossModifiers = { health: 0, enrage: 0 };
    this.ending = null;
    this.benchmarkMode = false;
    this.showcaseMode = null;
    this.portalTraversal = null;
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
    };
    this.combat.reset();
    this.loadRoom();
    this.emit("runStarted", { seed });
    this.startDialogue("intro", () => this.requestRoomPlay());
  }

  loadRoom() {
    const boss = this.floor === RUN_CONFIG.totalFloors && this.room === RUN_CONFIG.roomsPerFloor;
    this.arena = generateArena({ seed: this.seed, floor: this.floor, room: this.room, boss });
    this.roomLoadSerial += 1;
    this.roomLoadToken = `${this.seed}:${this.arena.id}:${this.roomLoadSerial}`;
    this.roomReady = !this.requireRoomReady;
    this.roomPlayRequested = false;
    this.player.position = clonePosition(this.arena.playerSpawn);
    this.player.previousPosition = clonePosition(this.arena.playerSpawn);
    this.portalActive = false;
    this.portalTraversal = null;
    this.clearTimer = 0;
    this.roomClearResolved = false;
    this.pendingRoomRewards = [];
    this.roomRewardPending = false;
    const difficulty = DIFFICULTY[this.settings.get("gameplay.difficulty")] ?? DIFFICULTY.standard;
    this.director.reset({
      arena: this.arena,
      floor: this.floor,
      room: this.room,
      rng: this.rng.fork(`encounter-${this.floor}-${this.room}`),
      difficulty,
      bossModifiers: this.bossModifiers,
    });
    this.emit("arenaChanged", {
      arena: this.arena,
      floor: this.floor,
      room: this.room,
      boss,
      loadToken: this.roomLoadToken,
    });
    this.emitHud();

    const scriptedDialogueEnabled = !this.benchmarkMode && !this.showcaseMode;
    if (scriptedDialogueEnabled && this.floor === 4 && this.room === 1 && !this.flags.metFallenKnight) {
      this.flags.metFallenKnight = true;
      this.startDialogue("fallenKnight", () => this.requestRoomPlay());
    } else if (scriptedDialogueEnabled && this.floor === 6 && this.room === 1 && !this.flags.sawPrincessVision) {
      this.flags.sawPrincessVision = true;
      this.startDialogue("princessVision", () => this.requestRoomPlay());
    } else if (scriptedDialogueEnabled && boss) {
      this.startDialogue("queenConfrontation", () => this.requestRoomPlay());
    } else {
      this.requestRoomPlay();
    }
  }

  setAimPoint(point) {
    this.aimPoint.x = point.x;
    this.aimPoint.z = point.z;
  }

  updateFixed(dt) {
    if (!this.player) return;
    if (this.phase === "portalTraversal") {
      this.updatePortalTraversal(dt);
      return;
    }
    if (this.phase !== "playing") return;

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
    const velocity = this.combat.update(dt, this.input, this.player, movement, {
      onDash: () => {},
      onActiveAttack: (attack, hitIds, facing) => this.resolvePlayerAttack(attack, hitIds, facing),
    });
    const movementResult = moveCircleDetailed(this.player.position, velocity, dt, this.player.radius, this.arena);
    this.player.position = movementResult.position;
    this.combat.resolveMovement(movementResult);

    this.director.update(dt, this.player, (damage, source) => this.damagePlayer(damage, source));
    this.checkRoomProgress(dt);
  }

  resolvePlayerAttack(attack, hitIds, facing = this.combat.attackFacing) {
    this.spatialHash.rebuild(this.director.enemies);
    const range = attack.range * this.player.reachMultiplier;
    const candidates = this.spatialHash.query(this.player.position.x, this.player.position.z, range + 2);
    for (const enemy of candidates) {
      if (!enemy.active || hitIds.has(enemy.id)) continue;
      const assistedArc = attack.arc + this.settings.get("gameplay.aimAssist") * 0.24;
      if (!circleIntersectsArc(this.player.position, facing, range, assistedArc, enemy.position, enemy.radius)) continue;
      hitIds.add(enemy.id);
      const critical = this.rng.chance(this.player.criticalChance);
      const damage = attack.damage * this.player.damageMultiplier * (critical ? 1.75 : 1);
      const dx = enemy.position.x - this.player.position.x;
      const dz = enemy.position.z - this.player.position.z;
      const length = Math.hypot(dx, dz) || 1;
      const defeated = this.director.damageEnemy(enemy, damage, { x: dx / length, z: dz / length }, attack.knockback, critical);
      if (defeated && this.player.healthOnKill > 0) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + this.player.healthOnKill);
      }
    }
  }

  damagePlayer(amount, source) {
    if (this.player.invulnerable > 0 || this.phase !== "playing") return;
    this.player.health = Math.max(0, this.player.health - amount);
    this.player.invulnerable = PLAYER_CONFIG.hitInvulnerability;
    this.player.hitFlash = 0.14;
    this.emit("playerHit", { amount, source, health: this.player.health, maxHealth: this.player.maxHealth });
    this.emitHud();
    if (this.player.health <= 0) {
      if (this.player.deathDefiance > 0) {
        this.player.deathDefiance -= 1;
        this.player.health = Math.max(1, Math.round(this.player.maxHealth * 0.35));
        this.player.invulnerable = 1.2;
        this.emit("playerRevived", {
          health: this.player.health,
          maxHealth: this.player.maxHealth,
          chargesRemaining: this.player.deathDefiance,
        });
        this.emitHud();
        return;
      }
      this.setPhase("dead");
      this.emit("runEnded", { victory: false, floor: this.floor, room: this.room, seed: this.seed });
    }
  }

  handleDirectorEvent(type, detail) {
    this.emit(type, detail);
    if (type === "enemyDefeated") {
      if (this.player.healthOnKill > 0) this.emitHud();
    }
    if (type === "enemyHit" && detail.type === "queen") {
      this.emit("bossHealth", { health: detail.health, maxHealth: detail.maxHealth });
    }
  }

  checkRoomProgress(dt) {
    if (this.director.hasCombatRemaining()) return;
    if (this.arena.boss && !this.flags.queenDefeated) {
      this.clearTimer += dt;
      if (this.clearTimer >= RUN_CONFIG.roomClearDelay) {
        this.flags.queenDefeated = true;
        this.startDialogue("ending", () => {
          this.setPhase("victory");
          this.emit("runEnded", { victory: true, ending: this.ending, seed: this.seed });
        });
      }
      return;
    }

    if (!this.roomClearResolved) {
      this.clearTimer += dt;
      if (this.clearTimer >= RUN_CONFIG.roomClearDelay) {
        this.roomClearResolved = true;
        const recoveryPercent = RUN_CONFIG.roomRecoveryPercent + this.player.roomRecoveryBonus;
        const recovery = Math.max(1, Math.round(this.player.maxHealth * recoveryPercent));
        const restored = Math.min(recovery, this.player.maxHealth - this.player.health);
        this.player.health += restored;
        this.emitHud();
        this.emit("roomCleared", { floor: this.floor, room: this.room, portal: clonePosition(this.arena.portal) });
        if (restored > 0) this.emit("roomRecovered", { amount: restored, health: this.player.health, maxHealth: this.player.maxHealth });
        if (this.room < RUN_CONFIG.roomsPerFloor && !this.benchmarkMode) this.offerRoomReward();
        else this.activatePortal();
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
    if (this.combat.attack) this.combat.cancelAttack("portal");
    if (this.combat.chargingHeavy) this.combat.cancelHeavyCharge();
    this.combat.attackBuffer = 0;
    this.combat.dashBuffer = 0;
    this.combat.heavyBuffer = 0;
    this.combat.dashTime = 0;
    this.combat.dashMomentum = { x: 0, z: 0 };
    this.combat.dashMomentumTime = 0;
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
    this.pendingRoomRewards = offerUpgradeChoices(
      this.rng.fork(`reward-${this.floor}-${this.room}`),
      this.upgradeRanks,
    );
    this.roomRewardPending = true;
    this.setPhase("reward");
    this.emit("roomRewardOffered", {
      floor: this.floor,
      room: this.room,
      choices: this.pendingRoomRewards.map(publicUpgradeChoice),
    });
  }

  chooseRoomReward(id) {
    if (this.phase !== "reward" || !this.roomRewardPending) return;
    const reward = this.pendingRoomRewards.find((choice) => choice.id === id);
    const result = applyRunUpgrade(reward, this.player, this.upgradeRanks);
    if (!result) return;
    this.pendingRoomRewards = [];
    this.roomRewardPending = false;
    this.setPhase("playing");
    this.emit("roomRewardChosen", { ...result, floor: this.floor, room: this.room });
    this.activatePortal();
    this.emitHud();
  }

  advanceRoom() {
    if (this.room < RUN_CONFIG.roomsPerFloor) {
      this.room += 1;
      this.loadRoom();
      return;
    }

    if (this.floor >= RUN_CONFIG.totalFloors) return;
    this.pendingBlessings = chooseBlessings(this.rng.fork(`blessing-${this.floor}`), this.upgradeRanks);
    this.setPhase("blessing");
    this.emit("blessingOffered", { choices: this.pendingBlessings.map(publicUpgradeChoice) });
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
    const result = applyRunUpgrade(blessing, this.player, this.upgradeRanks);
    if (!result) return;
    this.ownedBlessings.add(blessing.id);
    this.pendingBlessings = [];
    this.emit("blessingChosen", result);
    this.floor += 1;
    this.room = 1;
    this.player.health = Math.min(
      this.player.maxHealth,
      this.player.health + Math.round(this.player.maxHealth * RUN_CONFIG.floorRecoveryPercent),
    );
    this.loadRoom();
  }

  startDialogue(id, onComplete) {
    this.pendingDialogueCallback = onComplete;
    this.dialogueAwaitingResponse = false;
    this.setPhase("dialogue");
    this.emit("dialogueStarted", this.dialogue.start(id));
  }

  chooseDialogue(index) {
    if (this.phase !== "dialogue" || this.dialogueAwaitingResponse) return;
    const result = this.dialogue.choose(index);
    this.applyDialogueEffects(result.effects);
    this.dialogueAwaitingResponse = true;
    this.emit("dialogueResponse", { response: result.response });
  }

  continueDialogue() {
    if (!this.dialogueAwaitingResponse) return;
    this.dialogueAwaitingResponse = false;
    const callback = this.pendingDialogueCallback;
    this.pendingDialogueCallback = null;
    callback?.();
  }

  applyDialogueEffects(effects) {
    for (const effect of effects) {
      if (effect.type === "setFlag") this.flags[effect.key] = effect.value;
      if (effect.type === "heal") this.player.health = Math.min(this.player.maxHealth, this.player.health + effect.amount);
      if (effect.type === "healMax") {
        this.player.maxHealth += effect.amount;
        this.player.health += effect.amount;
      }
      if (effect.type === "damage") this.player.damageMultiplier += effect.amount;
      if (effect.type === "critical") this.player.criticalChance += effect.amount;
      if (effect.type === "dashRecovery") this.player.dashCooldownMultiplier *= 1 - effect.amount;
      if (effect.type === "bossHealth") {
        this.bossModifiers.health += effect.amount;
        const boss = this.director.activeBoss();
        if (boss) {
          boss.maxHealth = Math.max(1, Math.round(boss.maxHealth * (1 + effect.amount)));
          boss.health = Math.min(boss.health, boss.maxHealth);
        }
      }
      if (effect.type === "bossEnrage") {
        this.bossModifiers.enrage += effect.amount;
        const boss = this.director.activeBoss();
        if (boss) boss.speed *= 1 + effect.amount;
      }
      if (effect.type === "ending") this.ending = effect.value;
    }
    this.emitHud();
  }

  togglePause() {
    if (this.phase === "playing") {
      this.setPhase("paused");
      return;
    }
    if (this.phase === "paused") this.setPhase("playing");
  }

  setPhase(phase) {
    this.phase = phase;
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
    this.floor = RUN_CONFIG.totalFloors;
    this.room = RUN_CONFIG.roomsPerFloor;
    this.dialogue.current = null;
    this.pendingDialogueCallback = null;
    this.dialogueAwaitingResponse = false;
    this.loadRoom();
    this.player.invulnerable = Number.POSITIVE_INFINITY;
    this.emit("showcaseStarted", { mode: this.showcaseMode, seed });
  }

  enterRewardShowcase(seed = "SHOWCASE-REWARD") {
    this.startRun(seed);
    this.showcaseMode = "reward";
    this.dialogue.current = null;
    this.pendingDialogueCallback = null;
    this.dialogueAwaitingResponse = false;
    for (const enemy of this.director.enemies) enemy.active = false;
    this.director.pendingWaves.length = 0;
    this.roomClearResolved = true;
    this.offerRoomReward();
    this.emit("showcaseStarted", { mode: this.showcaseMode, seed });
  }

  enterBenchmarkMode(enemyCount) {
    this.startRun("BENCHMARK-REAPER");
    this.benchmarkMode = true;
    this.floor = 9;
    this.room = 2;
    this.dialogue.current = null;
    this.pendingDialogueCallback = null;
    this.dialogueAwaitingResponse = false;
    this.loadRoom();
    this.director.stressSpawn(enemyCount, 9);
    this.player.invulnerable = 9999;
    this.emit("benchmarkStarted", { enemyCount });
  }
}
