import {
  BATCH_SPAWN_MODES,
  BATCH_TRIGGER_TYPES,
  createEmergenceState,
  ENEMY_EMERGENCE,
  ENEMY_LIFECYCLE_STATES,
  isEnemyInteractive,
} from "../game/encounterContracts.js";

const EPSILON = 1e-9;

function finiteDelta(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("Encounter scheduler delta must be a non-negative finite number.");
  }
  return value;
}

function positiveKillCount(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError("Encounter scheduler kill count must be a non-negative integer.");
  }
  return value;
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validateRecipe(recipe) {
  if (!recipe || !Array.isArray(recipe.batches) || recipe.batches.length === 0) {
    throw new TypeError("EncounterScheduler requires an encounter recipe.");
  }
  if (!Number.isInteger(recipe.activePopulationCap) || recipe.activePopulationCap < 1) {
    throw new TypeError("Encounter recipe activePopulationCap must be a positive integer.");
  }
  return recipe;
}

function lifecycleSnapshot(enemy) {
  const interactive = isEnemyInteractive(enemy);
  return {
    id: enemy.id,
    type: enemy.entry.type,
    batchId: enemy.batchId,
    batchIndex: enemy.batchIndex,
    entryIndex: enemy.entryIndex,
    state: enemy.lifecycle.state,
    startedAtSeconds: round(enemy.lifecycle.startedAtSeconds),
    remainingSeconds: round(enemy.lifecycle.remainingSeconds),
    interactive,
    canMove: interactive,
    canAttack: interactive,
    canObtainAttackLease: interactive,
    canDealContactDamage: interactive,
    canBeDamaged: interactive,
    blocksMovement: interactive,
  };
}

/**
 * Rendering-free encounter lifecycle simulator. It intentionally models only
 * recipe timing, population pressure, emergence, and direct deterministic kills.
 */
export class EncounterScheduler {
  constructor(recipe, {
    onEvent = null,
    floor = recipe?.floor ?? null,
    room = recipe?.room ?? null,
    layoutFamily = recipe?.layoutFamily ?? null,
  } = {}) {
    this.recipe = validateRecipe(recipe);
    this.onEvent = typeof onEvent === "function" ? onEvent : null;
    this.context = {
      ...(Number.isFinite(floor) ? { floor } : {}),
      ...(Number.isFinite(room) ? { room } : {}),
      ...(layoutFamily ? { layoutFamily } : {}),
    };
    this.elapsedSeconds = 0;
    this.enemySerial = 0;
    this.enemies = new Map();
    this.cancelledEntries = new Set();
    this.events = [];
    this.maximumSimultaneous = 0;
    this.clearEmitted = false;
    this.batchStates = recipe.batches.map((batch) => ({
      batch,
      status: "pending",
      triggeredAtSeconds: null,
      nextStreamAtSeconds: null,
      nextEntryIndex: 0,
      enemyIds: [],
    }));

    this.processCurrentTime();
  }

  advance(dt, { kills = 0 } = {}) {
    const targetSeconds = this.elapsedSeconds + finiteDelta(dt);
    let iterations = 0;

    while (this.elapsedSeconds + EPSILON < targetSeconds) {
      if (iterations > 10_000) throw new Error("Encounter scheduler exceeded its event-step safety limit.");
      iterations += 1;
      const nextEventSeconds = this.nextScheduledTime();
      const nextSeconds = nextEventSeconds === null
        ? targetSeconds
        : Math.min(targetSeconds, Math.max(this.elapsedSeconds, nextEventSeconds));

      if (nextSeconds <= this.elapsedSeconds + EPSILON) {
        const progressed = this.processCurrentTime();
        if (!progressed) this.elapsedSeconds = targetSeconds;
      } else {
        this.elapsedSeconds = nextSeconds;
        this.processCurrentTime();
      }
    }

    if (Math.abs(this.elapsedSeconds - targetSeconds) <= EPSILON) this.elapsedSeconds = targetSeconds;
    this.processCurrentTime();
    if (kills > 0) this.kill(kills);
    return this.snapshot();
  }

  kill(count = 1) {
    positiveKillCount(count);
    const targets = [...this.enemies.values()]
      .filter((enemy) => enemy.lifecycle.state === ENEMY_LIFECYCLE_STATES.ACTIVE)
      .sort((left, right) => left.serial - right.serial)
      .slice(0, count);
    for (const enemy of targets) this.defeatEnemy(enemy);
    this.processCurrentTime();
    return targets.map((enemy) => enemy.id);
  }

  killEnemy(enemyId) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.lifecycle.state !== ENEMY_LIFECYCLE_STATES.ACTIVE) return false;
    this.defeatEnemy(enemy);
    this.processCurrentTime();
    return true;
  }

  cancelWhere(predicate, reason = "cancelled") {
    if (typeof predicate !== "function") throw new TypeError("Encounter cancellation requires a predicate.");
    let cancelled = 0;
    for (const enemy of this.enemies.values()) {
      if (enemy.lifecycle.state === ENEMY_LIFECYCLE_STATES.DEFEATED || !predicate(enemy.entry)) continue;
      this.defeatEnemy(enemy, reason);
      cancelled += 1;
    }
    for (const state of this.batchStates) {
      for (let entryIndex = state.nextEntryIndex; entryIndex < state.batch.entries.length; entryIndex += 1) {
        const key = this.entryKey(state.batch.index, entryIndex);
        if (this.cancelledEntries.has(key) || !predicate(state.batch.entries[entryIndex])) continue;
        this.cancelledEntries.add(key);
        cancelled += 1;
      }
    }
    this.processCurrentTime();
    return cancelled;
  }

  isInteractive(enemyId) {
    return isEnemyInteractive(this.enemies.get(enemyId));
  }

  hasCombatRemaining() {
    return this.pendingCount() > 0 || this.occupiedCount() > 0;
  }

  isClear() {
    return !this.hasCombatRemaining();
  }

  snapshot() {
    const active = this.enemiesByState(ENEMY_LIFECYCLE_STATES.ACTIVE);
    const spawning = this.enemiesByState(ENEMY_LIFECYCLE_STATES.EMERGING);
    const defeated = this.enemiesByState(ENEMY_LIFECYCLE_STATES.DEFEATED);
    return {
      recipeId: this.recipe.id,
      recipeType: this.recipe.type,
      ...this.context,
      elapsedSeconds: round(this.elapsedSeconds),
      activePopulationCap: this.recipe.activePopulationCap,
      totalPopulation: this.recipe.totalPopulation,
      alive: active.length,
      living: active.length,
      spawning: spawning.length,
      pending: this.pendingCount(),
      defeated: defeated.length,
      maximumSimultaneous: this.maximumSimultaneous,
      combatRemaining: this.hasCombatRemaining(),
      clear: this.isClear(),
      batches: this.batchStates.map((state) => ({
        id: state.batch.id,
        index: state.batch.index,
        triggerType: state.batch.trigger.type,
        status: state.status,
        triggeredAtSeconds: state.triggeredAtSeconds === null ? null : round(state.triggeredAtSeconds),
        spawned: state.nextEntryIndex,
        pending: state.batch.entries.slice(state.nextEntryIndex)
          .filter((_entry, offset) => !this.cancelledEntries.has(this.entryKey(state.batch.index, state.nextEntryIndex + offset))).length,
        active: this.batchEnemyCount(state, ENEMY_LIFECYCLE_STATES.ACTIVE),
        spawning: this.batchEnemyCount(state, ENEMY_LIFECYCLE_STATES.EMERGING),
        defeated: this.batchEnemyCount(state, ENEMY_LIFECYCLE_STATES.DEFEATED),
      })),
      enemies: [...this.enemies.values()]
        .sort((left, right) => left.serial - right.serial)
        .map(lifecycleSnapshot),
    };
  }

  processCurrentTime() {
    let anyProgress = false;
    let progressed = true;
    let iterations = 0;

    while (progressed) {
      if (iterations > this.recipe.totalPopulation + this.batchStates.length + 8) {
        throw new Error("Encounter scheduler could not settle the current event time.");
      }
      iterations += 1;
      progressed = false;

      for (const enemy of this.enemies.values()) {
        if (enemy.lifecycle.state !== ENEMY_LIFECYCLE_STATES.EMERGING) continue;
        const completedAt = enemy.lifecycle.startedAtSeconds + ENEMY_EMERGENCE.durationSeconds;
        enemy.lifecycle.elapsedSeconds = Math.min(
          ENEMY_EMERGENCE.durationSeconds,
          Math.max(0, this.elapsedSeconds - enemy.lifecycle.startedAtSeconds),
        );
        enemy.lifecycle.remainingSeconds = Math.max(
          0,
          ENEMY_EMERGENCE.durationSeconds - enemy.lifecycle.elapsedSeconds,
        );
        if (completedAt > this.elapsedSeconds + EPSILON) continue;
        enemy.lifecycle.state = ENEMY_LIFECYCLE_STATES.ACTIVE;
        enemy.lifecycle.remainingSeconds = 0;
        this.emit("enemyEmergenceCompleted", {
          enemyId: enemy.id,
          type: enemy.entry.type,
          batchId: enemy.batchId,
          durationSeconds: ENEMY_EMERGENCE.durationSeconds,
        });
        progressed = true;
        anyProgress = true;
      }

      for (let index = 0; index < this.batchStates.length; index += 1) {
        const state = this.batchStates[index];
        if (state.status !== "pending" || !this.triggerReady(index)) continue;
        this.triggerBatch(state);
        progressed = true;
        anyProgress = true;
      }

      for (const state of this.batchStates) {
        const spawned = this.releaseDueEntries(state);
        if (spawned > 0) {
          progressed = true;
          anyProgress = true;
        }
      }
    }

    this.updateMaximumSimultaneous();
    this.emitClearIfNeeded();
    return anyProgress;
  }

  nextScheduledTime() {
    let next = Infinity;
    for (const enemy of this.enemies.values()) {
      if (enemy.lifecycle.state !== ENEMY_LIFECYCLE_STATES.EMERGING) continue;
      next = Math.min(next, enemy.lifecycle.startedAtSeconds + ENEMY_EMERGENCE.durationSeconds);
    }
    for (const state of this.batchStates) {
      if (state.status === "pending" && state.batch.trigger.type === BATCH_TRIGGER_TYPES.TIMER) {
        next = Math.min(next, state.batch.trigger.atSeconds);
      }
      if (
        state.status === "triggered"
        && state.batch.spawnMode === BATCH_SPAWN_MODES.STREAMED
        && state.nextEntryIndex < state.batch.entries.length
        && this.availableCapacity() > 0
      ) next = Math.min(next, state.nextStreamAtSeconds);
    }
    return Number.isFinite(next) ? Math.max(this.elapsedSeconds, next) : null;
  }

  triggerReady(index) {
    const state = this.batchStates[index];
    const trigger = state.batch.trigger;
    if (trigger.type === BATCH_TRIGGER_TYPES.INITIAL) return index === 0;
    if (trigger.type === BATCH_TRIGGER_TYPES.TIMER) {
      return this.elapsedSeconds + EPSILON >= trigger.atSeconds;
    }
    if (trigger.type !== BATCH_TRIGGER_TYPES.REMAINING || index === 0) return false;

    const source = this.batchStates[index - 1];
    if (source.status === "pending") return false;
    const remaining = this.batchRemainingCount(source);
    const ratio = remaining / source.batch.entries.length;
    return (Number.isFinite(trigger.remainingCount) && remaining <= trigger.remainingCount)
      || (Number.isFinite(trigger.remainingRatio) && ratio <= trigger.remainingRatio);
  }

  triggerBatch(state) {
    state.status = "triggered";
    state.triggeredAtSeconds = this.elapsedSeconds;
    state.nextStreamAtSeconds = this.elapsedSeconds;
    this.emit("encounterBatchTriggered", {
      recipeId: this.recipe.id,
      recipeType: this.recipe.type,
      batchId: state.batch.id,
      batchIndex: state.batch.index,
      triggerType: state.batch.trigger.type,
      triggerTimestamp: round(this.elapsedSeconds),
      spawnMode: state.batch.spawnMode,
      population: state.batch.entries.length,
    });
  }

  releaseDueEntries(state) {
    if (state.status !== "triggered") return 0;
    this.skipCancelledEntries(state);
    if (state.nextEntryIndex >= state.batch.entries.length) {
      state.status = "released";
      return 0;
    }
    let spawned = 0;
    if (state.batch.spawnMode === BATCH_SPAWN_MODES.TOGETHER) {
      const count = Math.min(this.availableCapacity(), state.batch.entries.length - state.nextEntryIndex);
      for (let index = 0; index < count; index += 1) {
        this.spawnNextEntry(state);
        spawned += 1;
        this.skipCancelledEntries(state);
        if (state.nextEntryIndex >= state.batch.entries.length) break;
      }
    } else if (
      this.availableCapacity() > 0
      && state.nextStreamAtSeconds <= this.elapsedSeconds + EPSILON
    ) {
      this.spawnNextEntry(state);
      spawned = 1;
      state.nextStreamAtSeconds = this.elapsedSeconds + state.batch.streamIntervalSeconds;
    }

    if (state.nextEntryIndex >= state.batch.entries.length) state.status = "released";
    return spawned;
  }

  spawnNextEntry(state) {
    const entryIndex = state.nextEntryIndex;
    const entry = state.batch.entries[entryIndex];
    this.enemySerial += 1;
    const enemy = {
      id: `${state.batch.id}:${entryIndex}:${this.enemySerial}`,
      serial: this.enemySerial,
      batchId: state.batch.id,
      batchIndex: state.batch.index,
      entryIndex,
      entry,
      lifecycle: createEmergenceState(this.elapsedSeconds),
    };
    state.nextEntryIndex += 1;
    state.enemyIds.push(enemy.id);
    this.enemies.set(enemy.id, enemy);
    this.updateMaximumSimultaneous();
    this.emit("enemyEmergenceStarted", {
      enemyId: enemy.id,
      type: entry.type,
      role: entry.role ?? null,
      origin: entry.origin ?? null,
      threat: entry.threat ?? null,
      batchId: state.batch.id,
      batchIndex: state.batch.index,
      entryIndex,
      durationSeconds: ENEMY_EMERGENCE.durationSeconds,
    });
  }

  defeatEnemy(enemy, reason = "defeated") {
    enemy.lifecycle.state = ENEMY_LIFECYCLE_STATES.DEFEATED;
    enemy.lifecycle.remainingSeconds = 0;
    this.emit("enemyDefeated", {
      enemyId: enemy.id,
      type: enemy.entry.type,
      batchId: enemy.batchId,
      batchIndex: enemy.batchIndex,
      reason,
    });
  }

  emit(type, detail) {
    const event = { atSeconds: round(this.elapsedSeconds), type, detail: { ...this.context, ...detail } };
    this.events.push(event);
    this.onEvent?.(type, event.detail, event.atSeconds);
  }

  emitClearIfNeeded() {
    if (this.clearEmitted || this.hasCombatRemaining()) return;
    this.clearEmitted = true;
    this.emit("encounterCleared", {
      recipeId: this.recipe.id,
      elapsedSeconds: round(this.elapsedSeconds),
      maximumSimultaneous: this.maximumSimultaneous,
    });
  }

  updateMaximumSimultaneous() {
    this.maximumSimultaneous = Math.max(this.maximumSimultaneous, this.occupiedCount());
  }

  availableCapacity() {
    return Math.max(0, this.recipe.activePopulationCap - this.occupiedCount());
  }

  occupiedCount() {
    return this.enemiesByState(ENEMY_LIFECYCLE_STATES.ACTIVE).length
      + this.enemiesByState(ENEMY_LIFECYCLE_STATES.EMERGING).length;
  }

  pendingCount() {
    return this.batchStates.reduce(
      (sum, state) => sum + state.batch.entries.slice(state.nextEntryIndex)
        .filter((_entry, offset) => !this.cancelledEntries.has(this.entryKey(state.batch.index, state.nextEntryIndex + offset))).length,
      0,
    );
  }

  batchRemainingCount(state) {
    const cancelledPending = state.batch.entries.reduce((count, _entry, entryIndex) => (
      count + (this.cancelledEntries.has(this.entryKey(state.batch.index, entryIndex)) ? 1 : 0)
    ), 0);
    return state.batch.entries.length
      - this.batchEnemyCount(state, ENEMY_LIFECYCLE_STATES.DEFEATED)
      - cancelledPending;
  }

  entryKey(batchIndex, entryIndex) {
    return `${batchIndex}:${entryIndex}`;
  }

  skipCancelledEntries(state) {
    while (
      state.nextEntryIndex < state.batch.entries.length
      && this.cancelledEntries.has(this.entryKey(state.batch.index, state.nextEntryIndex))
    ) state.nextEntryIndex += 1;
  }

  batchEnemyCount(state, lifecycleState) {
    return state.enemyIds.reduce(
      (count, id) => count + (this.enemies.get(id)?.lifecycle.state === lifecycleState ? 1 : 0),
      0,
    );
  }

  enemiesByState(state) {
    return [...this.enemies.values()].filter((enemy) => enemy.lifecycle.state === state);
  }
}
