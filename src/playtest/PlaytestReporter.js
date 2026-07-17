const DEFAULT_OPTIONS = Object.freeze({
  expectedEnemyTypeCount: 6,
  targetFps: 60,
  targetRoomSeconds: Object.freeze({ min: 8, max: 55 }),
  performanceSampleInterval: 0.25,
  maxTimelineEntries: 1200,
});

const TIMELINE_EVENTS = new Set([
  "runStarted",
  "arenaChanged",
  "roomCleared",
  "roomRewardOffered",
  "roomRewardChosen",
  "playerHit",
  "enemyDefeated",
  "blessingChosen",
  "dialogueStarted",
  "dialogueResponse",
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

function roomKey(floor, room) {
  return `${floor}-${room}`;
}

function createRoom(floor, room, startedAt, boss = false) {
  return {
    floor,
    room,
    boss,
    startedAt: round(startedAt),
    clearedAt: null,
    endedAt: null,
    clearSeconds: null,
    totalSeconds: null,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
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
  };
}

function createPerformanceMetrics() {
  return {
    fps: [],
    cpuMs: [],
    gpuMs: [],
    drawCalls: [],
    triangles: [],
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
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      targetRoomSeconds: { ...DEFAULT_OPTIONS.targetRoomSeconds, ...options.targetRoomSeconds },
    };
    this.beginRun();
  }

  beginRun({ runNumber = 1, seed = null, difficulty = "standard", startedAt = 0 } = {}) {
    this.elapsed = 0;
    this.run = { runNumber, seed, difficulty, startedAt, endedAt: null };
    this.outcome = { completed: false, victory: false, reason: null, ending: null, deaths: 0 };
    this.combat = createCombatMetrics();
    this.performance = createPerformanceMetrics();
    this.rooms = new Map();
    this.currentRoomKey = null;
    this.floorsReached = new Set();
    this.dialogueChoices = [];
    this.blessings = [];
    this.chamberRewards = [];
    this.pathRanks = { Reaper: 0, Shade: 0, Grave: 0 };
    this.timeline = [];
    this.navigation = {
      stuckEvents: 0,
      recoveryEvents: 0,
      distanceTravelled: 0,
      modeSeconds: {},
      lastPosition: null,
    };
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
    for (const enemy of state.enemies ?? []) {
      if (enemy.active === false) continue;
      const identity = `${state.floor ?? 0}:${state.room ?? 0}:${enemy.id ?? enemy.type}`;
      if (this.seenEnemies.has(identity)) continue;
      this.seenEnemies.add(identity);
      increment(this.combat.encounteredByType, enemy.type);
    }

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
    if (intent.uiAction.type === "chooseDialogue") {
      this.dialogueChoices.push({ atSeconds: round(this.elapsed), index: intent.uiAction.index });
    }
  }

  recordDiagnostic(diagnostic) {
    if (diagnostic?.type !== "stuckRecovery") return;
    this.navigation.stuckEvents += 1;
    this.addTimeline("stuckRecovery", diagnostic);
  }

  recordPerformance(sample) {
    for (const key of ["fps", "cpuMs", "gpuMs", "drawCalls", "triangles"]) {
      if (Number.isFinite(sample[key])) this.performance[key].push(sample[key]);
    }
    if (sample.longTask === true) this.performance.longTasks += 1;
    if (Number.isFinite(sample.longTasks)) this.performance.longTasks += sample.longTasks;
  }

  recordEvent(event, atSeconds = this.elapsed) {
    if (!event || typeof event.type !== "string") return;
    const detail = event.detail ?? {};
    if (Number.isFinite(atSeconds)) this.elapsed = Math.max(this.elapsed, atSeconds);

    if (event.type === "runStarted") {
      this.run.seed = detail.seed ?? this.run.seed;
    } else if (event.type === "arenaChanged") {
      this.startRoom(detail.floor, detail.room, detail.boss ?? detail.arena?.boss ?? false);
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
      if (room) room.kills += 1;
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
    } else if (event.type === "roomRewardChosen") {
      this.chamberRewards.push({
        atSeconds: round(this.elapsed),
        floor: detail.floor,
        room: detail.room,
        id: detail.id,
        name: detail.name,
        path: detail.path,
        rank: detail.rank,
      });
      if (detail.path in this.pathRanks) this.pathRanks[detail.path] += 1;
    } else if (event.type === "runEnded") {
      this.outcome.completed = true;
      this.outcome.victory = detail.victory === true;
      this.outcome.reason = detail.victory ? "victory" : "defeat";
      this.outcome.ending = detail.ending ?? null;
      if (!detail.victory) this.outcome.deaths += 1;
    }

    if (TIMELINE_EVENTS.has(event.type)) this.addTimeline(event.type, detail);
  }

  startRoom(floor, room, boss) {
    this.closeCurrentRoom();
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
    }));
    const clearedDurations = rooms.map((room) => room.clearSeconds).filter(Number.isFinite);
    const floorTimings = this.buildFloorTimings(rooms);
    const performance = this.summarizePerformance();
    const pacing = this.summarizePacing(clearedDurations, rooms);
    const fairness = this.summarizeFairness();
    const assessment = this.assess({ rooms, performance, pacing, fairness });

    return {
      schemaVersion: 1,
      run: { ...this.run, durationSeconds: round(this.elapsed) },
      outcome: { ...this.outcome, floorsReached: this.floorsReached.size, roomsVisited: rooms.length },
      progression: {
        rooms,
        floors: floorTimings,
        chamberRewards: [...this.chamberRewards],
        blessings: [...this.blessings],
        pathRanks: { ...this.pathRanks },
        dialogueChoices: [...this.dialogueChoices],
      },
      combat: {
        ...this.combat,
        damageDealt: round(this.combat.damageDealt),
        damageTaken: round(this.combat.damageTaken),
        largestHitTaken: round(this.combat.largestHitTaken),
        fairness,
      },
      navigation: {
        ...this.navigation,
        distanceTravelled: round(this.navigation.distanceTravelled),
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

  summarizePerformance() {
    const fps = this.performance.fps;
    const cpu = this.performance.cpuMs;
    const gpu = this.performance.gpuMs;
    return {
      samples: Math.max(fps.length, cpu.length, gpu.length),
      fpsAverage: round(average(fps)),
      fpsP05: round(percentile(fps, 0.05)),
      cpuP95Ms: round(percentile(cpu, 0.95)),
      gpuP95Ms: round(percentile(gpu, 0.95)),
      drawCallsP95: round(percentile(this.performance.drawCalls, 0.95)),
      trianglesP95: Math.round(percentile(this.performance.triangles, 0.95)),
      framesBelowTargetPercent: round(fps.length === 0 ? 0 : fps.filter((value) => value < this.options.targetFps).length / fps.length * 100),
      longTasks: this.performance.longTasks,
    };
  }

  summarizePacing(durations, rooms) {
    const { min, max } = this.options.targetRoomSeconds;
    return {
      clearedRooms: durations.length,
      medianRoomSeconds: round(percentile(durations, 0.5)),
      roomP90Seconds: round(percentile(durations, 0.9)),
      fastestRoomSeconds: round(durations.length > 0 ? Math.min(...durations) : 0),
      slowestRoomSeconds: round(durations.length > 0 ? Math.max(...durations) : 0),
      roomsTooFast: rooms.filter((room) => Number.isFinite(room.clearSeconds) && room.clearSeconds < min).map((room) => roomKey(room.floor, room.room)),
      roomsTooSlow: rooms.filter((room) => Number.isFinite(room.clearSeconds) && room.clearSeconds > max).map((room) => roomKey(room.floor, room.room)),
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

    if (this.outcome.victory) strengths.push("The agent completed the full dungeon run and reached a valid ending.");
    if (encounteredTypes >= Math.min(4, this.options.expectedEnemyTypeCount)) {
      strengths.push(`Enemy variety remained visible in play (${encounteredTypes} categories encountered).`);
      funMoments.push("Target priorities changed as ranged, melee, specialist, and boss threats overlapped.");
    }
    if (combatStyles >= 3) {
      strengths.push("The scythe kit supported a healthy mix of light strings, heavy reaps, and dashes.");
      funMoments.push("Wide heavy attacks and dash-engages created distinct answers to crowds and distant threats.");
    }
    if (this.chamberRewards.length >= 4) {
      strengths.push(`Chamber rewards sustained build growth across ${this.chamberRewards.length} choices.`);
      funMoments.push("Frequent Reaper, Shade, and Grave decisions changed the shape of the run between floors.");
    }
    if (performance.samples > 0 && performance.fpsP05 >= this.options.targetFps) {
      strengths.push(`Frame pacing stayed above the ${this.options.targetFps} FPS target at the fifth percentile.`);
    }
    if (pacing.clearedRooms > 0 && pacing.roomsTooSlow.length === 0) {
      strengths.push("No cleared room exceeded the configured pacing ceiling.");
    }

    if (!this.outcome.victory) {
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

    if (funMoments.length === 0 && this.outcome.victory) funMoments.push("Completing the dungeon arc and resolving the final dialogue provided a clear payoff.");
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
