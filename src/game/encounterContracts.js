export const ENCOUNTER_RECIPE_TYPES = Object.freeze({
  HORDE: "horde",
  DEATH_TRIGGERED: "deathTriggered",
  POPULATION_PRESSURE: "populationPressure",
  HYBRID: "hybrid",
});

export const BATCH_TRIGGER_TYPES = Object.freeze({
  INITIAL: "initial",
  REMAINING: "remaining",
});

export const BATCH_SPAWN_MODES = Object.freeze({
  TOGETHER: "together",
  STREAMED: "streamed",
});

export const ENEMY_LIFECYCLE_STATES = Object.freeze({
  EMERGING: "emerging",
  ACTIVE: "active",
  DEFEATED: "defeated",
});

export const ENEMY_EMERGENCE = Object.freeze({
  durationSeconds: 0.56,
  blocksMovement: false,
  canMove: false,
  canAttack: false,
  canObtainAttackLease: false,
  canDealContactDamage: false,
  canBeDamaged: false,
});

const RECIPE_TYPE_SET = new Set(Object.values(ENCOUNTER_RECIPE_TYPES));
const TRIGGER_TYPE_SET = new Set(Object.values(BATCH_TRIGGER_TYPES));
const SPAWN_MODE_SET = new Set(Object.values(BATCH_SPAWN_MODES));

function finiteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be a non-negative finite number.`);
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer.`);
  return value;
}

export function createBatchTrigger(trigger) {
  if (!trigger || !TRIGGER_TYPE_SET.has(trigger.type)) throw new TypeError("Encounter batches require a supported trigger type.");
  if (trigger.type === BATCH_TRIGGER_TYPES.INITIAL) return Object.freeze({ type: trigger.type });
  const remainingCount = trigger.remainingCount == null ? null : finiteNonNegative(trigger.remainingCount, "Remaining trigger count");
  const remainingRatio = trigger.remainingRatio == null ? null : finiteNonNegative(trigger.remainingRatio, "Remaining trigger ratio");
  if (remainingCount === null && remainingRatio === null) throw new TypeError("Remaining triggers require a count or ratio threshold.");
  if (remainingRatio !== null && remainingRatio > 1) throw new RangeError("Remaining trigger ratio cannot exceed one.");
  return Object.freeze({
    type: trigger.type,
    ...(remainingCount === null ? {} : { remainingCount }),
    ...(remainingRatio === null ? {} : { remainingRatio }),
  });
}

export function createEncounterBatch({ id, index, trigger, spawnMode = BATCH_SPAWN_MODES.TOGETHER, streamIntervalSeconds = 0, entries }) {
  if (!SPAWN_MODE_SET.has(spawnMode)) throw new TypeError("Encounter batch requires a supported spawn mode.");
  if (!Array.isArray(entries) || entries.length === 0) throw new TypeError("Encounter batches require at least one roster entry.");
  const frozenEntries = Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
  return Object.freeze({
    id: String(id),
    index: finiteNonNegative(index, "Batch index"),
    trigger: createBatchTrigger(trigger),
    spawnMode,
    streamIntervalSeconds: spawnMode === BATCH_SPAWN_MODES.STREAMED
      ? finiteNonNegative(streamIntervalSeconds, "Stream interval")
      : 0,
    entries: frozenEntries,
  });
}

export function createEncounterRecipe({ id, type, activePopulationCap, batches }) {
  if (!RECIPE_TYPE_SET.has(type)) throw new TypeError("Encounter recipe requires a supported family.");
  positiveInteger(activePopulationCap, "Active population cap");
  if (!Array.isArray(batches) || batches.length === 0) throw new TypeError("Encounter recipes require at least one batch.");
  const frozenBatches = Object.freeze(batches.map((batch, index) => createEncounterBatch({ ...batch, index })));
  if (frozenBatches[0].trigger.type !== BATCH_TRIGGER_TYPES.INITIAL) {
    throw new TypeError("The first encounter batch must use the initial trigger.");
  }
  const totalPopulation = frozenBatches.reduce((sum, batch) => sum + batch.entries.length, 0);
  return Object.freeze({
    id: String(id),
    type,
    activePopulationCap,
    totalPopulation,
    batches: frozenBatches,
  });
}

export function createEmergenceState(startedAtSeconds = 0) {
  finiteNonNegative(startedAtSeconds, "Emergence start time");
  return {
    state: ENEMY_LIFECYCLE_STATES.EMERGING,
    startedAtSeconds,
    elapsedSeconds: 0,
    remainingSeconds: ENEMY_EMERGENCE.durationSeconds,
  };
}

export function advanceEmergence(state, dt) {
  if (!state || state.state !== ENEMY_LIFECYCLE_STATES.EMERGING) return false;
  state.elapsedSeconds = Math.min(ENEMY_EMERGENCE.durationSeconds, state.elapsedSeconds + finiteNonNegative(dt, "Emergence delta"));
  state.remainingSeconds = Math.max(0, ENEMY_EMERGENCE.durationSeconds - state.elapsedSeconds);
  if (state.remainingSeconds > 0) return false;
  state.state = ENEMY_LIFECYCLE_STATES.ACTIVE;
  return true;
}

export function isEnemyInteractive(enemy) {
  const state = enemy?.lifecycle?.state ?? enemy?.lifecycleState;
  return state === ENEMY_LIFECYCLE_STATES.ACTIVE;
}
