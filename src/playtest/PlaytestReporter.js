const DEFAULT_OPTIONS = Object.freeze({
  expectedEnemyTypeCount: 6,
  targetFps: 60,
  targetRoomSeconds: Object.freeze({ min: 8, max: 55 }),
  targetRoomSecondsByBand: Object.freeze({
    early: Object.freeze({ min: 8, max: 61 }),
    middle: Object.freeze({ min: 10, max: 72 }),
    late: Object.freeze({ min: 12, max: 83 }),
  }),
  performanceSampleInterval: 0.25,
  maxTimelineEntries: 1200,
});

const ENEMY_ROLES = Object.freeze({
  thrall: "frontline",
  boneguard: "frontline",
  reaver: "mobile",
  wraith: "mobile",
  hexer: "ranged",
  bombardier: "area",
  queen: "boss",
});

const SPECIALIST_TYPES = new Set(["boneguard", "hexer", "wraith", "bombardier"]);

const TIMELINE_EVENTS = new Set([
  "runStarted",
  "arenaChanged",
  "encounterPlanned",
  "encounterStarted",
  "encounterBatchTriggered",
  "encounterWaveStarted",
  "enemyEmergenceStarted",
  "enemyEmergenceCompleted",
  "attackLeaseGranted",
  "attackLeaseDenied",
  "attackLeaseReleased",
  "enemyAttackLeaseGranted",
  "enemyAttackDeferred",
  "enemyAttackLeaseReleased",
  "roomCleared",
  "playerHit",
  "enemyDefeated",
  "blessingChosen",
  "bookendStarted",
  "bookendAdvanced",
  "bookendCompleted",
  "witchMagicCeased",
  "endingDecisionStarted",
  "endingChoiceResolved",
  "endingFadeStarted",
  "endingCompleted",
  "queenVolley",
  "queenSummon",
  "queenTeleport",
  "runEnded",
]);

function increment(map, key, amount = 1) {
  const safeKey = key || "unknown";
  map[safeKey] = (map[safeKey] ?? 0) + amount;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maximum(values) {
  return values.reduce((result, value) => Math.max(result, value), 0);
}

function roomKey(floor, room) {
  return `${floor}-${room}`;
}

function floorBand(floor) {
  if (floor <= 3) return "early";
  if (floor <= 6) return "middle";
  return "late";
}

function distanceBetween(left, right) {
  if (!left || !right) return null;
  if (![left.x, left.z, right.x, right.z].every(Number.isFinite)) return null;
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function createRoom(floor, room, startedAt, boss = false) {
  return {
    floor,
    room,
    floorBand: floorBand(floor),
    boss,
    startedAt: round(startedAt),
    clearedAt: null,
    endedAt: null,
    clearSeconds: null,
    totalSeconds: null,
    kills: 0,
    deaths: 0,
    damageDealt: 0,
    damageTaken: 0,
    buildProfile: null,
    layoutFamily: null,
    recipeId: null,
    recipeType: null,
    population: {
      total: 0,
      spawned: 0,
      spawning: 0,
      living: 0,
      pending: 0,
      maximumSpawning: 0,
      maximumLiving: 0,
      maximumSimultaneous: 0,
    },
    batchTriggers: [],
    roster: {
      roles: {},
      threat: 0,
      origins: { stable: 0, volatile: 0 },
      specialistMaxima: {},
    },
    emergence: {
      durationSeconds: null,
      minimumSpawnDistance: null,
      started: 0,
      completed: 0,
      interactionLockViolations: 0,
    },
    geometry: {
      walkableArea: null,
      connectorWidths: [],
      objectiveReachable: null,
      escapeRouteChecks: 0,
      escapeRouteFailures: 0,
    },
    navigation: {
      enemyDistanceTravelled: 0,
      pursuitIdleSeconds: 0,
      unreachablePathEvents: 0,
    },
  };
}

function createCombatMetrics() {
  return {
    damageDealt: 0,
    damageTaken: 0,
    largestHitTaken: 0,
    kills: 0,
    killsByType: {},
    encounteredByType: {},
    damageTakenBySource: {},
    attacks: { light: 0, heavy: 0, dash: 0, dashAttack: 0 },
    commands: { attack: 0, heavy: 0, dash: 0, interact: 0 },
    criticalHits: 0,
    telegraphsSeen: 0,
    enemyAttacksSeen: 0,
    attackLeases: {
      grantedByFamily: {},
      deniedByFamily: {},
      denialsByReason: {},
      activeByFamily: {},
      peakActiveByFamily: {},
      peakActiveTotal: 0,
    },
  };
}

function createPerformanceMetrics() {
  return {
    fps: [],
    cpuMs: [],
    gpuMs: [],
    drawCalls: [],
    triangles: [],
    frameMs: [],
    telegraphs: [],
    actors: [],
    damageNumbers: [],
    longTasks: 0,
  };
}

function serializeDetail(detail) {
  if (!detail || typeof detail !== "object") return detail ?? null;
  const safe = {};
  for (const [key, value] of Object.entries(detail)) {
    if (["arena", "choices"].includes(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) safe[key] = value;
    else if (key === "position" && value && Number.isFinite(value.x) && Number.isFinite(value.z)) {
      safe.position = { x: round(value.x), z: round(value.z) };
    }
  }
  return safe;
}

export class PlaytestReporter {
  constructor(options = {}) {
    const targetRoomSecondsByBand = Object.fromEntries(
      Object.entries(DEFAULT_OPTIONS.targetRoomSecondsByBand).map(([band, target]) => [
        band,
        { ...target, ...options.targetRoomSecondsByBand?.[band] },
      ]),
    );
    if (options.targetRoomSeconds) {
      for (const band of Object.keys(targetRoomSecondsByBand)) {
        targetRoomSecondsByBand[band] = {
          ...targetRoomSecondsByBand[band],
          ...options.targetRoomSeconds,
        };
      }
    }
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      targetRoomSecondsByBand,
    };
    this.beginRun();
  }

  beginRun({ runNumber = 1, seed = null, difficulty = "standard", buildProfile = null, startedAt = 0 } = {}) {
    this.elapsed = 0;
    this.run = { runNumber, seed, difficulty, buildProfile, startedAt, endedAt: null };
    this.outcome = { completed: false, victory: false, reason: null, ending: null, deaths: 0 };
    this.combat = createCombatMetrics();
    this.performance = createPerformanceMetrics();
    this.rooms = new Map();
    this.currentRoomKey = null;
    this.floorsReached = new Set();
    this.bookendChoices = [];
    this.bookendSequences = [];
    this.endingDecision = { startedAt: null, resolvedAt: null, durationSeconds: null, outcome: null };
    this.endingDecisionStartedAtMs = null;
    this.blessings = [];
    this.pathRanks = { Reaper: 0, Shade: 0, Grave: 0 };
    this.timeline = [];
    this.navigation = {
      stuckEvents: 0,
      recoveryEvents: 0,
      distanceTravelled: 0,
      enemyDistanceTravelled: 0,
      pursuitIdleSeconds: 0,
      unreachablePathEvents: 0,
      modeSeconds: {},
      lastPosition: null,
    };
    this.activeAttackLeases = new Map();
    this.lastEnemyPositions = new Map();
    this.spawnedEnemyIds = new Set();
    this.emergingEnemyIds = new Set();
    this.completedEmergenceIds = new Set();
    this.observedRosters = new Map();
    this.pendingRoomEvents = [];
    this.health = { samples: 0, lowHealthSamples: 0, minimumRatio: 1, lastMaxHealth: 0 };
    this.lastPerformanceSampleAt = -Infinity;
    this.lastIntentSignature = null;
    this.seenEnemies = new Set();
    this.finalReport = null;
    return this;
  }

  sample({ state, intent = null, performance = null, dt = 0 }) {
    const safeDt = Math.max(0, Number.isFinite(dt) ? dt : 0);
    this.elapsed += safeDt;
    if (state) this.recordStateSample(state, safeDt);
    if (intent) this.recordIntent(intent, safeDt);
    if (performance && this.elapsed - this.lastPerformanceSampleAt >= this.options.performanceSampleInterval) {
      this.recordPerformance(performance);
      this.lastPerformanceSampleAt = this.elapsed;
    }
  }

  recordStateSample(state, dt) {
    if (Number.isFinite(state.floor)) this.floorsReached.add(state.floor);
    const room = this.currentRoom();
    const enemies = state.enemies ?? [];
    let living = 0;
    let spawning = 0;
    let pursuitIdle = 0;
    const activeLeaseCounts = {};
    let leaseStateObserved = false;
    for (const enemy of enemies) {
      const lifecycleState = enemy.lifecycle?.state ?? enemy.lifecycleState;
      if (lifecycleState === "emerging") spawning += 1;
      else if (enemy.active !== false && lifecycleState !== "defeated") living += 1;
      if (enemy.pursuitIdle === true && lifecycleState !== "emerging" && enemy.active !== false) pursuitIdle += dt;
      if (Object.hasOwn(enemy, "attackLeaseFamily")) leaseStateObserved = true;
      if (enemy.attackLeaseFamily && lifecycleState !== "emerging" && enemy.active !== false) {
        increment(activeLeaseCounts, enemy.attackLeaseFamily);
      }

      if (enemy.position && enemy.id != null) {
        const identity = `${state.floor ?? 0}:${state.room ?? 0}:${enemy.id}`;
        const previous = this.lastEnemyPositions.get(identity);
        const stepDistance = distanceBetween(previous, enemy.position);
        if (stepDistance !== null && stepDistance < 8) {
          this.navigation.enemyDistanceTravelled += stepDistance;
          if (room) room.navigation.enemyDistanceTravelled += stepDistance;
        }
        this.lastEnemyPositions.set(identity, { ...enemy.position });
      }

      if (enemy.active === false || lifecycleState === "emerging" || lifecycleState === "defeated") continue;
      const identity = `${state.floor ?? 0}:${state.room ?? 0}:${enemy.id ?? enemy.type}`;
      if (this.seenEnemies.has(identity)) continue;
      this.seenEnemies.add(identity);
      increment(this.combat.encounteredByType, enemy.type);
    }

    this.navigation.pursuitIdleSeconds += pursuitIdle;
    if (room) {
      room.navigation.pursuitIdleSeconds += pursuitIdle;
      const pending = state.encounter?.pending
        ?? state.encounter?.pendingPopulation
        ?? state.pendingEnemyCount
        ?? state.pendingEnemies?.length;
      const total = state.encounter?.totalPopulation ?? state.totalEnemyPopulation;
      if (Number.isFinite(total)) room.population.total = Math.max(room.population.total, total);
      if (Number.isFinite(pending)) room.population.pending = Math.max(0, pending);
      room.population.living = living;
      room.population.spawning = spawning;
      room.population.maximumLiving = Math.max(room.population.maximumLiving, living);
      room.population.maximumSpawning = Math.max(room.population.maximumSpawning, spawning);
      room.population.maximumSimultaneous = Math.max(room.population.maximumSimultaneous, living + spawning);
    }
    if (leaseStateObserved) this.updateAttackLeasePeaks(activeLeaseCounts);

    if (state.player?.position) {
      if (this.navigation.lastPosition) {
        const stepDistance = Math.hypot(
          state.player.position.x - this.navigation.lastPosition.x,
          state.player.position.z - this.navigation.lastPosition.z,
        );
        if (stepDistance < 4) this.navigation.distanceTravelled += stepDistance;
      }
      this.navigation.lastPosition = { ...state.player.position };
    }

    if (state.player && Number.isFinite(state.player.health) && Number.isFinite(state.player.maxHealth)) {
      const ratio = state.player.health / Math.max(1, state.player.maxHealth);
      this.health.samples += 1;
      this.health.lastMaxHealth = state.player.maxHealth;
      this.health.minimumRatio = Math.min(this.health.minimumRatio, ratio);
      if (ratio <= 0.3) this.health.lowHealthSamples += 1;
    }

    if (state.phase) increment(this.navigation.modeSeconds, `phase:${state.phase}`, dt);
  }

  recordIntent(intent, dt) {
    increment(this.navigation.modeSeconds, intent.mode ?? "unknown", dt);
    const pressed = new Set(intent.pressed ?? []);
    for (const action of ["attack", "heavy", "dash", "interact"]) {
      if (pressed.has(action)) this.combat.commands[action] += 1;
    }

    if (intent.recoveryStarted) this.navigation.recoveryEvents += 1;
    if (!intent.uiAction) {
      this.lastIntentSignature = null;
      return;
    }
    const signature = JSON.stringify(intent.uiAction);
    if (signature === this.lastIntentSignature) return;
    this.lastIntentSignature = signature;
    if (intent.uiAction.type === "continueBookend") this.bookendChoices.push({ atSeconds: round(this.elapsed), action: "continue" });
  }

  recordDiagnostic(diagnostic) {
    if (!diagnostic || typeof diagnostic.type !== "string") return;
    const room = this.currentRoom();
    if (diagnostic.type === "stuckRecovery") {
      this.navigation.stuckEvents += 1;
    } else if (["unreachablePath", "pathUnreachable", "navigationUnreachable"].includes(diagnostic.type)) {
      this.navigation.unreachablePathEvents += 1;
      if (room) room.navigation.unreachablePathEvents += 1;
    } else if (diagnostic.type === "pursuitIdle") {
      const seconds = Number.isFinite(diagnostic.seconds) ? Math.max(0, diagnostic.seconds) : 0;
      this.navigation.pursuitIdleSeconds += seconds;
      if (room) room.navigation.pursuitIdleSeconds += seconds;
    } else if (diagnostic.type === "emergenceInteractionViolation" && room) {
      room.emergence.interactionLockViolations += 1;
    } else if (diagnostic.type === "arenaGeometry") {
      this.recordGeometry(room, diagnostic);
    } else if (diagnostic.type === "attackLeaseDenied") {
      this.recordAttackLeaseDenied(diagnostic);
    }
    this.addTimeline(diagnostic.type, diagnostic);
  }

  recordPerformance(sample) {
    for (const key of ["fps", "cpuMs", "gpuMs", "drawCalls", "triangles", "frameMs"]) {
      if (Number.isFinite(sample[key])) this.performance[key].push(sample[key]);
    }
    const telegraphs = sample.telegraphs ?? sample.activeTelegraphs;
    const actors = sample.actors ?? sample.activeActors;
    const damageNumbers = sample.damageNumbers ?? sample.damageNumberCount;
    if (Number.isFinite(telegraphs)) this.performance.telegraphs.push(telegraphs);
    if (Number.isFinite(actors)) this.performance.actors.push(actors);
    if (Number.isFinite(damageNumbers)) this.performance.damageNumbers.push(damageNumbers);
    if (sample.longTask === true) this.performance.longTasks += 1;
    if (Number.isFinite(sample.longTasks)) this.performance.longTasks += sample.longTasks;
  }

  recordEvent(event, atSeconds = this.elapsed) {
    if (!event || typeof event.type !== "string") return;
    const detail = event.detail ?? {};
    if (Number.isFinite(atSeconds)) this.elapsed = Math.max(this.elapsed, atSeconds);

    if (event.type === "runStarted") {
      this.run.seed = detail.seed ?? this.run.seed;
      this.run.buildProfile = detail.buildProfile ?? this.run.buildProfile ?? null;
    } else if (event.type === "arenaChanged") {
      this.startRoom(detail.floor, detail.room, detail.boss ?? detail.arena?.boss ?? false);
      this.recordRoomMetadata(this.currentRoom(), detail);
      this.flushPendingRoomEvents(detail.floor, detail.room);
    } else if (["encounterPlanned", "encounterStarted", "encounterRecipeStarted"].includes(event.type)) {
      this.recordRoomScopedEvent(event.type, detail);
    } else if (["encounterBatchTriggered", "encounterWaveStarted"].includes(event.type)) {
      this.recordRoomScopedEvent(event.type, detail);
    } else if (event.type === "enemyEmergenceStarted") {
      this.recordRoomScopedEvent(event.type, detail);
    } else if (event.type === "enemyEmergenceCompleted") {
      this.recordRoomScopedEvent(event.type, detail);
    } else if (event.type === "enemySpawned") {
      this.recordRoomScopedEvent(event.type, detail);
    } else if (["attackLeaseGranted", "enemyAttackLeaseGranted"].includes(event.type)) {
      this.recordAttackLeaseGranted(detail);
    } else if (["attackLeaseDenied", "enemyAttackDeferred"].includes(event.type)) {
      this.recordAttackLeaseDenied(detail);
    } else if (["attackLeaseReleased", "enemyAttackLeaseReleased"].includes(event.type)) {
      this.recordAttackLeaseReleased(detail);
    } else if (event.type === "roomCleared") {
      this.clearRoom(detail.floor, detail.room);
    } else if (event.type === "enemyHit") {
      this.combat.damageDealt += detail.damage ?? 0;
      if (detail.critical) this.combat.criticalHits += 1;
      const room = this.currentRoom();
      if (room) room.damageDealt += detail.damage ?? 0;
    } else if (event.type === "enemyDefeated") {
      this.combat.kills += 1;
      increment(this.combat.killsByType, detail.type);
      const room = this.currentRoom();
      if (room) {
        room.kills += 1;
        room.population.living = Math.max(0, room.population.living - 1);
      }
    } else if (event.type === "playerHit") {
      const amount = detail.amount ?? 0;
      this.combat.damageTaken += amount;
      this.combat.largestHitTaken = Math.max(this.combat.largestHitTaken, amount);
      increment(this.combat.damageTakenBySource, detail.source, amount);
      const room = this.currentRoom();
      if (room) room.damageTaken += amount;
    } else if (event.type === "attack") {
      if (detail.heavy) this.combat.attacks.heavy += 1;
      else if (detail.dash) this.combat.attacks.dashAttack += 1;
      else this.combat.attacks.light += 1;
    } else if (event.type === "dash") {
      this.combat.attacks.dash += 1;
    } else if (event.type === "enemyTelegraph") {
      this.combat.telegraphsSeen += 1;
    } else if (event.type === "enemyAttack") {
      this.combat.enemyAttacksSeen += 1;
    } else if (event.type === "blessingChosen") {
      this.blessings.push({
        atSeconds: round(this.elapsed), id: detail.id, name: detail.name, path: detail.path ?? null, rank: detail.rank ?? 1,
      });
      if (detail.path in this.pathRanks) this.pathRanks[detail.path] += 1;
    } else if (event.type === "bookendStarted") {
      this.recordBookendSequence(detail.sequenceId);
    } else if (event.type === "endingDecisionStarted") {
      this.endingDecision.startedAt = round(this.elapsed);
      this.endingDecisionStartedAtMs = Number.isFinite(detail.decision?.startedAtMs)
        ? detail.decision.startedAtMs
        : null;
    } else if (event.type === "endingChoiceResolved") {
      this.endingDecision.resolvedAt = round(this.elapsed);
      this.endingDecision.outcome = detail.ending ?? null;
      if (Number.isFinite(detail.decision?.durationMs) && Number.isFinite(detail.decision?.remainingMs)) {
        this.endingDecision.durationSeconds = round(
          (detail.decision.durationMs - detail.decision.remainingMs) / 1000,
        );
      } else if (this.endingDecisionStartedAtMs !== null && Number.isFinite(detail.result?.resolvedAtMs)) {
        this.endingDecision.durationSeconds = round(
          (detail.result.resolvedAtMs - this.endingDecisionStartedAtMs) / 1000,
        );
      } else if (this.endingDecision.startedAt !== null) {
        this.endingDecision.durationSeconds = round(this.endingDecision.resolvedAt - this.endingDecision.startedAt);
      }
    } else if (event.type === "runEnded") {
      this.outcome.completed = detail.completed === true || detail.victory === true;
      this.outcome.victory = detail.victory === true;
      this.outcome.reason = detail.completed ? "ending" : detail.victory ? "victory" : "defeat";
      this.outcome.ending = detail.ending ?? null;
      if (!detail.completed && !detail.victory) {
        this.outcome.deaths += 1;
        const room = this.currentRoom();
        if (room) room.deaths += 1;
      }
    }

    if (TIMELINE_EVENTS.has(event.type)) this.addTimeline(event.type, detail);
  }

  recordRoomScopedEvent(type, detail, { allowQueue = true } = {}) {
    const hasLocation = Number.isFinite(detail.floor) && Number.isFinite(detail.room);
    const room = hasLocation ? this.rooms.get(roomKey(detail.floor, detail.room)) : this.currentRoom();
    if (!room) {
      if (allowQueue && this.pendingRoomEvents.length < 100) this.pendingRoomEvents.push({ type, detail });
      return;
    }
    if (["encounterPlanned", "encounterStarted", "encounterRecipeStarted"].includes(type)) {
      this.recordRoomMetadata(room, detail);
    } else if (["encounterBatchTriggered", "encounterWaveStarted"].includes(type)) {
      this.recordBatchTrigger(room, detail, type);
    } else if (type === "enemyEmergenceStarted") {
      this.recordEnemySpawn(room, detail, true);
    } else if (type === "enemyEmergenceCompleted") {
      this.recordEmergenceCompleted(room, detail);
    } else if (type === "enemySpawned") {
      this.recordEnemySpawn(room, detail, false);
    }
  }

  flushPendingRoomEvents(floor, room) {
    const remaining = [];
    for (const event of this.pendingRoomEvents) {
      const hasLocation = Number.isFinite(event.detail.floor) && Number.isFinite(event.detail.room);
      if (hasLocation && (event.detail.floor !== floor || event.detail.room !== room)) {
        remaining.push(event);
        continue;
      }
      this.recordRoomScopedEvent(event.type, event.detail, { allowQueue: false });
    }
    this.pendingRoomEvents = remaining;
  }

  recordRoomMetadata(room, detail) {
    if (!room || !detail) return;
    const arena = detail.arena ?? {};
    const recipe = detail.recipe ?? detail.encounter ?? detail.encounterPlan ?? {};
    room.layoutFamily = detail.layoutFamily
      ?? arena.layoutFamily
      ?? arena.family
      ?? arena.layout?.family
      ?? room.layoutFamily;
    room.recipeId = detail.recipeId ?? recipe.id ?? room.recipeId;
    room.recipeType = detail.recipeType ?? recipe.type ?? room.recipeType;
    room.buildProfile = detail.buildProfile ?? recipe.buildProfile ?? this.run.buildProfile ?? room.buildProfile;

    const total = detail.totalPopulation ?? recipe.totalPopulation ?? recipe.population;
    if (Number.isFinite(total)) room.population.total = Math.max(room.population.total, total);
    const pending = detail.pendingPopulation ?? recipe.pendingPopulation;
    if (Number.isFinite(pending)) room.population.pending = Math.max(0, pending);
    const threat = detail.threat ?? recipe.threat;
    if (Number.isFinite(threat)) room.roster.threat = Math.max(room.roster.threat, threat);
    const roles = detail.roles ?? recipe.roles;
    if (roles && typeof roles === "object") {
      for (const [role, count] of Object.entries(roles)) {
        if (Number.isFinite(count)) room.roster.roles[role] = Math.max(room.roster.roles[role] ?? 0, count);
      }
    }
    const origins = detail.originCounts ?? recipe.originCounts;
    if (origins && typeof origins === "object") {
      for (const origin of ["stable", "volatile"]) {
        if (Number.isFinite(origins[origin])) room.roster.origins[origin] = Math.max(room.roster.origins[origin], origins[origin]);
      }
    }
    this.recordGeometry(room, arena);
    this.recordGeometry(room, detail.geometry ?? detail);
  }

  recordBatchTrigger(room, detail, eventType) {
    if (!room) return;
    const triggerType = detail.triggerType
      ?? detail.trigger?.type
      ?? (eventType === "encounterWaveStarted" ? "sequential" : "unknown");
    const timestamp = detail.triggerTimestamp ?? detail.triggeredAtSeconds ?? this.elapsed;
    const batchId = detail.batchId ?? detail.id ?? (Number.isFinite(detail.wave) ? `wave-${detail.wave}` : null);
    const duplicate = room.batchTriggers.some((trigger) => (
      trigger.batchId === batchId && trigger.triggerType === triggerType && trigger.timestamp === round(timestamp)
    ));
    if (!duplicate) {
      room.batchTriggers.push({
        batchId,
        batchIndex: detail.batchIndex ?? (Number.isFinite(detail.wave) ? detail.wave - 1 : null),
        triggerType,
        timestamp: round(timestamp),
        spawnMode: detail.spawnMode ?? null,
        population: detail.population ?? detail.entries?.length ?? detail.types?.length ?? null,
      });
    }

    const specialistCounts = { ...(detail.specialistCounts ?? {}) };
    const types = detail.types ?? detail.entries?.map((entry) => entry.type) ?? [];
    if (!detail.specialistCounts) {
      for (const type of types) {
        if (SPECIALIST_TYPES.has(type)) increment(specialistCounts, type);
      }
    }
    for (const [type, count] of Object.entries(specialistCounts)) {
      if (Number.isFinite(count)) {
        room.roster.specialistMaxima[type] = Math.max(room.roster.specialistMaxima[type] ?? 0, count);
      }
    }
    this.recordRoomMetadata(room, detail);
  }

  recordEnemySpawn(room, detail, emerging) {
    if (!room) return;
    const rawId = detail.enemyId ?? detail.id ?? `${detail.batchId ?? "spawn"}:${detail.entryIndex ?? room.population.spawned}`;
    const identity = `${roomKey(room.floor, room.room)}:${rawId}`;
    if (!this.spawnedEnemyIds.has(identity)) {
      this.spawnedEnemyIds.add(identity);
      room.population.spawned += 1;
      room.population.total = Math.max(room.population.total, room.population.spawned + room.population.pending);
      const role = detail.role ?? ENEMY_ROLES[detail.type] ?? "unknown";
      const key = roomKey(room.floor, room.room);
      const observed = this.observedRosters.get(key) ?? {
        roles: {}, origins: { stable: 0, volatile: 0 }, threat: 0,
      };
      increment(observed.roles, role);
      room.roster.roles[role] = Math.max(room.roster.roles[role] ?? 0, observed.roles[role]);
      if (Number.isFinite(detail.threat)) {
        observed.threat += detail.threat;
        room.roster.threat = Math.max(room.roster.threat, observed.threat);
      }
      if (["stable", "volatile"].includes(detail.origin)) {
        increment(observed.origins, detail.origin);
        room.roster.origins[detail.origin] = Math.max(room.roster.origins[detail.origin], observed.origins[detail.origin]);
      }
      this.observedRosters.set(key, observed);
    }

    if (!emerging || this.emergingEnemyIds.has(identity) || this.completedEmergenceIds.has(identity)) return;
    this.emergingEnemyIds.add(identity);
    room.emergence.started += 1;
    room.population.spawning += 1;
    room.population.maximumSpawning = Math.max(room.population.maximumSpawning, room.population.spawning);
    room.population.maximumSimultaneous = Math.max(
      room.population.maximumSimultaneous,
      room.population.living + room.population.spawning,
    );
    const duration = detail.durationSeconds ?? detail.emergenceDurationSeconds;
    if (Number.isFinite(duration)) room.emergence.durationSeconds = round(duration);
    const spawnDistance = detail.spawnDistance
      ?? detail.playerDistance
      ?? distanceBetween(detail.position, detail.playerPosition ?? this.navigation.lastPosition);
    if (Number.isFinite(spawnDistance)) {
      room.emergence.minimumSpawnDistance = room.emergence.minimumSpawnDistance === null
        ? round(spawnDistance)
        : Math.min(room.emergence.minimumSpawnDistance, round(spawnDistance));
    }
  }

  recordEmergenceCompleted(room, detail) {
    if (!room) return;
    const rawId = detail.enemyId ?? detail.id;
    const identity = `${roomKey(room.floor, room.room)}:${rawId}`;
    if (rawId != null && this.completedEmergenceIds.has(identity)) return;
    if (rawId != null) {
      this.completedEmergenceIds.add(identity);
      this.emergingEnemyIds.delete(identity);
    }
    room.emergence.completed += 1;
    room.population.spawning = Math.max(0, room.population.spawning - 1);
    room.population.living += 1;
    room.population.maximumLiving = Math.max(room.population.maximumLiving, room.population.living);
    room.population.maximumSimultaneous = Math.max(
      room.population.maximumSimultaneous,
      room.population.living + room.population.spawning,
    );
    const duration = detail.durationSeconds ?? detail.emergenceDurationSeconds;
    if (Number.isFinite(duration)) room.emergence.durationSeconds = round(duration);
  }

  recordAttackLeaseGranted(detail) {
    const family = detail.family ?? "unknown";
    const leaseId = detail.leaseId ?? `${detail.enemyId ?? "enemy"}:${family}`;
    if (this.activeAttackLeases.has(leaseId)) return;
    this.activeAttackLeases.set(leaseId, { family, enemyId: detail.enemyId ?? null });
    increment(this.combat.attackLeases.grantedByFamily, family);
    this.updateAttackLeasePeaks();
  }

  recordAttackLeaseDenied(detail) {
    const family = detail.family ?? "unknown";
    increment(this.combat.attackLeases.deniedByFamily, family);
    increment(this.combat.attackLeases.denialsByReason, detail.reason ?? "unknown");
  }

  recordAttackLeaseReleased(detail) {
    if (detail.leaseId && this.activeAttackLeases.delete(detail.leaseId)) {
      this.updateAttackLeasePeaks();
      return;
    }
    if (detail.enemyId != null) {
      for (const [leaseId, lease] of this.activeAttackLeases) {
        if (lease.enemyId === detail.enemyId) this.activeAttackLeases.delete(leaseId);
      }
      this.updateAttackLeasePeaks();
    }
  }

  updateAttackLeasePeaks(sampleCounts = null) {
    const activeByFamily = sampleCounts ?? {};
    if (!sampleCounts) {
      for (const lease of this.activeAttackLeases.values()) increment(activeByFamily, lease.family);
    }
    this.combat.attackLeases.activeByFamily = { ...activeByFamily };
    let activeTotal = 0;
    for (const [family, count] of Object.entries(activeByFamily)) {
      activeTotal += count;
      this.combat.attackLeases.peakActiveByFamily[family] = Math.max(
        this.combat.attackLeases.peakActiveByFamily[family] ?? 0,
        count,
      );
    }
    this.combat.attackLeases.peakActiveTotal = Math.max(
      this.combat.attackLeases.peakActiveTotal,
      activeTotal,
    );
  }

  recordGeometry(room, detail) {
    if (!room || !detail || typeof detail !== "object") return;
    const geometry = detail.geometry ?? detail;
    const walkableArea = geometry.walkableArea ?? geometry.actualWalkableArea ?? geometry.walkableShape?.area;
    if (Number.isFinite(walkableArea)) room.geometry.walkableArea = round(walkableArea);
    const connectorWidths = geometry.connectorWidths
      ?? geometry.walkableShape?.connectors?.map((connector) => connector.width);
    if (Array.isArray(connectorWidths)) {
      room.geometry.connectorWidths = connectorWidths.filter(Number.isFinite).map((width) => round(width));
    }
    const objectiveReachable = geometry.objectiveReachable ?? geometry.objectivesReachable;
    if (typeof objectiveReachable === "boolean") room.geometry.objectiveReachable = objectiveReachable;
    if (Number.isFinite(geometry.escapeRouteChecks)) room.geometry.escapeRouteChecks += geometry.escapeRouteChecks;
    if (Number.isFinite(geometry.escapeRouteFailures)) room.geometry.escapeRouteFailures += geometry.escapeRouteFailures;
    if (typeof geometry.escapeRoutesValid === "boolean") {
      room.geometry.escapeRouteChecks += 1;
      if (!geometry.escapeRoutesValid) room.geometry.escapeRouteFailures += 1;
    }
  }

  recordBookendSequence(sequenceId) {
    if (!sequenceId || this.bookendSequences.includes(sequenceId)) return;
    this.bookendSequences.push(sequenceId);
  }

  startRoom(floor, room, boss) {
    this.closeCurrentRoom();
    this.activeAttackLeases.clear();
    this.updateAttackLeasePeaks();
    const key = roomKey(floor, room);
    this.currentRoomKey = key;
    this.floorsReached.add(floor);
    if (!this.rooms.has(key)) this.rooms.set(key, createRoom(floor, room, this.elapsed, boss));
  }

  clearRoom(floor, room) {
    const entry = this.rooms.get(roomKey(floor, room));
    if (!entry || entry.clearedAt !== null) return;
    entry.clearedAt = round(this.elapsed);
    entry.clearSeconds = round(this.elapsed - entry.startedAt);
  }

  closeCurrentRoom() {
    const room = this.currentRoom();
    if (!room || room.endedAt !== null) return;
    room.endedAt = round(this.elapsed);
    room.totalSeconds = round(this.elapsed - room.startedAt);
  }

  currentRoom() {
    return this.currentRoomKey ? this.rooms.get(this.currentRoomKey) : null;
  }

  addTimeline(type, detail) {
    if (this.timeline.length >= this.options.maxTimelineEntries) return;
    this.timeline.push({ atSeconds: round(this.elapsed), type, detail: serializeDetail(detail) });
  }

  finalize(outcome = {}) {
    if (this.finalReport) return this.finalReport;
    this.closeCurrentRoom();
    this.run.endedAt = round(this.elapsed);
    this.outcome = { ...this.outcome, ...outcome };
    this.finalReport = this.buildReport();
    return this.finalReport;
  }

  buildReport() {
    const rooms = [...this.rooms.values()].map((room) => ({
      ...room,
      damageDealt: round(room.damageDealt),
      damageTaken: round(room.damageTaken),
      navigation: {
        ...room.navigation,
        enemyDistanceTravelled: round(room.navigation.enemyDistanceTravelled),
        pursuitIdleSeconds: round(room.navigation.pursuitIdleSeconds),
      },
      roster: { ...room.roster, threat: round(room.roster.threat) },
    }));
    const clearedDurations = rooms.map((room) => room.clearSeconds).filter(Number.isFinite);
    const floorTimings = this.buildFloorTimings(rooms);
    const performance = this.summarizePerformance();
    const pacing = this.summarizePacing(clearedDurations, rooms);
    const fairness = this.summarizeFairness();
    const encounters = this.summarizeEncounters(rooms);
    const assessment = this.assess({ rooms, performance, pacing, fairness });

    return {
      schemaVersion: 1,
      run: { ...this.run, durationSeconds: round(this.elapsed) },
      outcome: { ...this.outcome, floorsReached: this.floorsReached.size, roomsVisited: rooms.length },
      progression: {
        rooms,
        floors: floorTimings,
        blessings: [...this.blessings],
        pathRanks: { ...this.pathRanks },
        bookendChoices: [...this.bookendChoices],
        bookendSequences: [...this.bookendSequences],
        endingDecision: { ...this.endingDecision },
      },
      combat: {
        ...this.combat,
        damageDealt: round(this.combat.damageDealt),
        damageTaken: round(this.combat.damageTaken),
        largestHitTaken: round(this.combat.largestHitTaken),
        fairness,
      },
      encounters,
      navigation: {
        ...this.navigation,
        distanceTravelled: round(this.navigation.distanceTravelled),
        playerDistanceTravelled: round(this.navigation.distanceTravelled),
        enemyDistanceTravelled: round(this.navigation.enemyDistanceTravelled),
        pursuitIdleSeconds: round(this.navigation.pursuitIdleSeconds),
        modeSeconds: Object.fromEntries(Object.entries(this.navigation.modeSeconds).map(([key, value]) => [key, round(value)])),
        lastPosition: undefined,
      },
      pacing,
      performance,
      experience: assessment,
      timeline: [...this.timeline],
    };
  }

  buildFloorTimings(rooms) {
    const floors = new Map();
    for (const room of rooms) {
      const entry = floors.get(room.floor) ?? { floor: room.floor, seconds: 0, rooms: 0, kills: 0, damageTaken: 0 };
      entry.seconds += room.totalSeconds ?? room.clearSeconds ?? 0;
      entry.rooms += 1;
      entry.kills += room.kills;
      entry.damageTaken += room.damageTaken;
      floors.set(room.floor, entry);
    }
    return [...floors.values()].map((entry) => ({
      ...entry,
      seconds: round(entry.seconds),
      damageTaken: round(entry.damageTaken),
    }));
  }

  summarizeEncounters(rooms) {
    const recipes = {};
    const layouts = {};
    const buildProfiles = {};
    const roles = {};
    const origins = { stable: 0, volatile: 0 };
    const specialistMaxima = {};
    const batchTriggers = [];
    const walkableAreaByRoom = {};
    const connectorWidths = [];
    let totalPopulation = 0;
    let spawnedPopulation = 0;
    let peakLiving = 0;
    let peakSpawning = 0;
    let peakSimultaneous = 0;
    let totalThreat = 0;
    let emergenceStarted = 0;
    let emergenceCompleted = 0;
    let emergenceDurationSeconds = null;
    let minimumSpawnDistance = null;
    let interactionLockViolations = 0;
    let objectiveReachabilityFailures = 0;
    let escapeRouteChecks = 0;
    let escapeRouteFailures = 0;

    for (const room of rooms) {
      if (room.recipeType) increment(recipes, room.recipeType);
      if (room.layoutFamily) increment(layouts, room.layoutFamily);
      if (room.buildProfile) increment(buildProfiles, room.buildProfile);
      totalPopulation += room.population.total;
      spawnedPopulation += room.population.spawned;
      peakLiving = Math.max(peakLiving, room.population.maximumLiving);
      peakSpawning = Math.max(peakSpawning, room.population.maximumSpawning);
      peakSimultaneous = Math.max(peakSimultaneous, room.population.maximumSimultaneous);
      totalThreat += room.roster.threat;
      for (const [role, count] of Object.entries(room.roster.roles)) increment(roles, role, count);
      for (const origin of ["stable", "volatile"]) origins[origin] += room.roster.origins[origin] ?? 0;
      for (const [type, count] of Object.entries(room.roster.specialistMaxima)) {
        specialistMaxima[type] = Math.max(specialistMaxima[type] ?? 0, count);
      }
      for (const trigger of room.batchTriggers) {
        batchTriggers.push({ floor: room.floor, room: room.room, ...trigger });
      }
      emergenceStarted += room.emergence.started;
      emergenceCompleted += room.emergence.completed;
      interactionLockViolations += room.emergence.interactionLockViolations;
      if (Number.isFinite(room.emergence.durationSeconds)) {
        emergenceDurationSeconds = room.emergence.durationSeconds;
      }
      if (Number.isFinite(room.emergence.minimumSpawnDistance)) {
        minimumSpawnDistance = minimumSpawnDistance === null
          ? room.emergence.minimumSpawnDistance
          : Math.min(minimumSpawnDistance, room.emergence.minimumSpawnDistance);
      }
      if (Number.isFinite(room.geometry.walkableArea)) {
        walkableAreaByRoom[roomKey(room.floor, room.room)] = room.geometry.walkableArea;
      }
      connectorWidths.push(...room.geometry.connectorWidths);
      if (room.geometry.objectiveReachable === false) objectiveReachabilityFailures += 1;
      escapeRouteChecks += room.geometry.escapeRouteChecks;
      escapeRouteFailures += room.geometry.escapeRouteFailures;
    }

    return {
      recipes,
      layouts,
      buildProfiles,
      population: {
        total: totalPopulation,
        spawned: spawnedPopulation,
        peakLiving,
        peakSpawning,
        peakSimultaneous,
      },
      batchTriggers,
      roster: {
        roles,
        threat: round(totalThreat),
        origins,
        specialistMaxima,
      },
      attackLeases: {
        ...this.combat.attackLeases,
        activeByFamily: { ...this.combat.attackLeases.activeByFamily },
        peakActiveByFamily: { ...this.combat.attackLeases.peakActiveByFamily },
      },
      emergence: {
        durationSeconds: emergenceDurationSeconds,
        minimumSpawnDistance,
        started: emergenceStarted,
        completed: emergenceCompleted,
        interactionLockViolations,
      },
      geometry: {
        walkableAreaByRoom,
        minimumConnectorWidth: connectorWidths.length > 0 ? round(Math.min(...connectorWidths)) : null,
        maximumConnectorWidth: connectorWidths.length > 0 ? round(Math.max(...connectorWidths)) : null,
        objectiveReachabilityFailures,
        escapeRouteChecks,
        escapeRouteFailures,
      },
    };
  }

  summarizePerformance() {
    const fps = this.performance.fps;
    const cpu = this.performance.cpuMs;
    const gpu = this.performance.gpuMs;
    return {
      samples: Math.max(...Object.values(this.performance).filter(Array.isArray).map((values) => values.length), 0),
      fpsAverage: round(average(fps)),
      fpsP05: round(percentile(fps, 0.05)),
      frameTimeP95Ms: round(percentile(this.performance.frameMs, 0.95)),
      frameTimePeakMs: round(maximum(this.performance.frameMs)),
      cpuP95Ms: round(percentile(cpu, 0.95)),
      cpuPeakMs: round(maximum(cpu)),
      gpuP95Ms: round(percentile(gpu, 0.95)),
      gpuPeakMs: round(maximum(gpu)),
      drawCallsP95: round(percentile(this.performance.drawCalls, 0.95)),
      drawCallsPeak: round(maximum(this.performance.drawCalls)),
      trianglesP95: Math.round(percentile(this.performance.triangles, 0.95)),
      trianglesPeak: Math.round(maximum(this.performance.triangles)),
      telegraphsPeak: Math.round(maximum(this.performance.telegraphs)),
      actorsPeak: Math.round(maximum(this.performance.actors)),
      damageNumbersPeak: Math.round(maximum(this.performance.damageNumbers)),
      framesBelowTargetPercent: round(fps.length === 0 ? 0 : fps.filter((value) => value < this.options.targetFps).length / fps.length * 100),
      longTasks: this.performance.longTasks,
    };
  }

  summarizePacing(durations, rooms) {
    const targetForRoom = (room) => this.options.targetRoomSecondsByBand[room.floorBand ?? floorBand(room.floor)];
    return {
      clearedRooms: durations.length,
      medianRoomSeconds: round(percentile(durations, 0.5)),
      roomP90Seconds: round(percentile(durations, 0.9)),
      fastestRoomSeconds: round(durations.length > 0 ? Math.min(...durations) : 0),
      slowestRoomSeconds: round(durations.length > 0 ? Math.max(...durations) : 0),
      targetsByBand: Object.fromEntries(
        Object.entries(this.options.targetRoomSecondsByBand).map(([band, target]) => [band, { ...target }]),
      ),
      roomTargets: rooms.map((room) => ({
        room: roomKey(room.floor, room.room),
        band: room.floorBand ?? floorBand(room.floor),
        ...targetForRoom(room),
      })),
      roomsTooFast: rooms.filter((room) => (
        Number.isFinite(room.clearSeconds) && room.clearSeconds < targetForRoom(room).min
      )).map((room) => roomKey(room.floor, room.room)),
      roomsTooSlow: rooms.filter((room) => (
        Number.isFinite(room.clearSeconds) && room.clearSeconds > targetForRoom(room).max
      )).map((room) => roomKey(room.floor, room.room)),
    };
  }

  summarizeFairness() {
    const maxHealth = Math.max(1, this.health.lastMaxHealth);
    return {
      telegraphCoverage: round(this.combat.enemyAttacksSeen === 0 ? 1 : Math.min(1, this.combat.telegraphsSeen / this.combat.enemyAttacksSeen)),
      playerHitPerEnemyAttack: round(this.combat.enemyAttacksSeen === 0 ? 0 : this.timeline.filter((entry) => entry.type === "playerHit").length / this.combat.enemyAttacksSeen),
      largestHitHealthPercent: round(this.combat.largestHitTaken / maxHealth * 100),
      lowHealthTimePercent: round(this.health.samples === 0 ? 0 : this.health.lowHealthSamples / this.health.samples * 100),
      minimumHealthPercent: round(this.health.minimumRatio * 100),
    };
  }

  assess({ performance, pacing, fairness }) {
    const strengths = [];
    const funMoments = [];
    const friction = [];
    const recommendations = [];
    const encounteredTypes = Object.keys(this.combat.encounteredByType).length;
    const executedActions = this.combat.attacks;
    const combatStyles = [executedActions.light, executedActions.heavy, executedActions.dash, executedActions.dashAttack].filter((count) => count > 0).length;

    if (this.outcome.completed) strengths.push(`The agent completed the full dungeon run and reached the ${this.outcome.ending} ending.`);
    if (encounteredTypes >= Math.min(4, this.options.expectedEnemyTypeCount)) {
      strengths.push(`Enemy variety remained visible in play (${encounteredTypes} categories encountered).`);
      funMoments.push("Target priorities changed as ranged, melee, specialist, and boss threats overlapped.");
    }
    if (combatStyles >= 3) {
      strengths.push("The scythe kit supported a healthy mix of light strings, heavy reaps, and dashes.");
      funMoments.push("Wide heavy attacks and dash-engages created distinct answers to crowds and distant threats.");
    }
    if (this.blessings.length >= 5) {
      strengths.push(`Technique Oaths sustained build growth across ${this.blessings.length} choices.`);
      funMoments.push("Oath choices changed the shape of each core technique between floors.");
    }
    if (performance.samples > 0 && performance.fpsP05 >= this.options.targetFps) {
      strengths.push(`Frame pacing stayed above the ${this.options.targetFps} FPS target at the fifth percentile.`);
    }
    if (pacing.clearedRooms > 0 && pacing.roomsTooSlow.length === 0) {
      strengths.push("No cleared room exceeded the configured pacing ceiling.");
    }

    if (!this.outcome.completed) {
      friction.push(`The run ended before victory (${this.outcome.reason ?? "unknown reason"}).`);
      recommendations.push({ priority: "high", category: "survivability", finding: "The automated player could not finish the run.", action: "Inspect the final two damage spikes and reduce unavoidable overlap or improve recovery access." });
    }
    if (this.navigation.stuckEvents > 0) {
      friction.push(`${this.navigation.stuckEvents} navigation stalls required recovery steering.`);
      recommendations.push({ priority: this.navigation.stuckEvents > 2 ? "high" : "medium", category: "navigation", finding: "Obstacle routing produced stuck recoveries.", action: "Increase clearance around the reported coordinates or simplify the local prop collision footprint." });
    }
    if (encounteredTypes < Math.min(4, this.options.expectedEnemyTypeCount)) {
      friction.push(`Only ${encounteredTypes} enemy categories were encountered.`);
      recommendations.push({ priority: "medium", category: "variety", finding: "Encounter variety was below target.", action: "Introduce specialist archetypes earlier and prevent repeated single-family waves." });
    }
    if (combatStyles < 3) {
      friction.push("The run relied on too few parts of the combat kit.");
      recommendations.push({ priority: "medium", category: "combat", finding: "Action diversity was low.", action: "Create clearer windows where heavy attacks and dash-strikes outperform repeated light attacks." });
    }
    if (fairness.largestHitHealthPercent > 25) {
      friction.push(`The largest hit removed ${fairness.largestHitHealthPercent}% of maximum health.`);
      recommendations.push({ priority: "high", category: "fairness", finding: "A single damage event exceeded the health-spike budget.", action: "Lengthen its telegraph or reduce its damage while preserving the attack's area denial role." });
    }
    if (fairness.telegraphCoverage < 0.9) {
      friction.push(`Only ${round(fairness.telegraphCoverage * 100)}% of observed enemy attacks had a matching telegraph event.`);
      recommendations.push({ priority: "high", category: "readability", finding: "Attack telegraph coverage was incomplete.", action: "Emit a consistent pre-attack cue for every damaging archetype action." });
    }
    if (pacing.roomsTooSlow.length > 0) {
      friction.push(`Slow rooms: ${pacing.roomsTooSlow.join(", ")}.`);
      recommendations.push({ priority: "medium", category: "pacing", finding: "Some rooms exceeded the target clear time.", action: "Reduce enemy downtime, travel distance, or excess health in the named rooms." });
    }
    const sustainedLongTaskBudget = Math.max(2, Math.ceil(performance.samples * 0.005));
    if (
      performance.samples > 0 &&
      (performance.fpsP05 < this.options.targetFps || performance.longTasks > sustainedLongTaskBudget)
    ) {
      friction.push(`Performance fell below target: ${performance.fpsP05} FPS p05 with ${performance.longTasks} long tasks.`);
      recommendations.push({ priority: "high", category: "performance", finding: "Frame pacing missed the playtest budget.", action: "Profile the busiest room and reduce the dominant render or simulation cost before adding more content." });
    }

    if (funMoments.length === 0 && this.outcome.victory) funMoments.push("Completing the dungeon and resolving the final choice provided a clear payoff.");
    const penalties = friction.reduce((sum, item) => sum + (item.includes("Performance") || item.includes("ended before") ? 18 : 9), 0);
    const bonuses = strengths.length * 8 + funMoments.length * 5;
    const funScore = clampScore(45 + bonuses - penalties);
    return {
      funScore,
      verdict: funScore >= 80 ? "Strong and replayable" : funScore >= 65 ? "Fun with targeted friction" : funScore >= 45 ? "Promising but uneven" : "Major tuning needed",
      whatWasGood: strengths,
      whatWasFun: funMoments,
      whatWasNotFun: friction,
      recommendations,
    };
  }

  serialize(space = 2) {
    return JSON.stringify(this.finalize(), null, space);
  }
}

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
