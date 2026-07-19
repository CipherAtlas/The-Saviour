const ACTION_FAMILY = Object.freeze({
  royalVolley: "projectile",
  royalFan: "projectile",
  royalLance: "projectile",
  royalSlam: "melee",
  royalDash: "mobility",
  teleport: "mobility",
  voidWell: "control",
  summon: "summon",
});

const PHASE_PATTERNS = Object.freeze({
  1: Object.freeze([
    Object.freeze(["royalFan", "royalSlam", "royalVolley"]),
    Object.freeze(["royalLance", "royalSlam", "royalFan"]),
    Object.freeze(["royalVolley", "royalSlam", "royalLance"]),
  ]),
  2: Object.freeze([
    Object.freeze(["teleport", "voidWell", "royalDash", "royalVolley", "summon", "royalSlam"]),
    Object.freeze(["royalDash", "royalFan", "voidWell", "teleport", "royalLance", "summon"]),
    Object.freeze(["summon", "royalSlam", "royalVolley", "teleport", "voidWell", "royalDash"]),
  ]),
  3: Object.freeze([
    Object.freeze(["royalDash", "royalFan", "royalSlam", "voidWell", "royalVolley", "teleport"]),
    Object.freeze(["royalLance", "royalDash", "voidWell", "royalSlam", "royalVolley", "teleport"]),
    Object.freeze(["teleport", "royalSlam", "royalFan", "royalDash", "royalLance", "voidWell"]),
  ]),
});

export const QUEEN_PHASE_THRESHOLDS = Object.freeze([0.7, 0.35]);
export const QUEEN_SUMMON_CAP = 5;
export const QUEEN_HAZARD_CAP = 2;
export const QUEEN_MIN_WINDUP_SECONDS = 0.34;

const QUEEN_PHASE_TIMING = Object.freeze({
  1: Object.freeze({ windupMultiplier: 1, cooldownMultiplier: 1, comboGapMultiplier: 1 }),
  2: Object.freeze({ windupMultiplier: 1, cooldownMultiplier: 1, comboGapMultiplier: 1 }),
  3: Object.freeze({ windupMultiplier: 0.78, cooldownMultiplier: 0.72, comboGapMultiplier: 0.28 }),
});

export function queenPhaseForHealth(health, maxHealth) {
  const ratio = maxHealth > 0 ? health / maxHealth : 0;
  if (ratio <= QUEEN_PHASE_THRESHOLDS[1]) return 3;
  if (ratio <= QUEEN_PHASE_THRESHOLDS[0]) return 2;
  return 1;
}

export function createQueenPatternState(rng) {
  return {
    rng,
    phase: 0,
    queue: [],
    lastAction: null,
    lastFamily: null,
    lastActionMeta: null,
    comboSerial: 0,
    comboStep: 0,
  };
}

function refillQueue(state, phase) {
  const phaseChanged = state.phase !== phase;
  const patterns = PHASE_PATTERNS[phase];
  const pattern = [...state.rng.pick(patterns)];
  const rotationSize = phase === 3 ? 2 : 1;
  const maxRotations = Math.floor(pattern.length / rotationSize);
  for (
    let rotations = 0;
    rotations < maxRotations && ACTION_FAMILY[pattern[0]] === state.lastFamily;
    rotations += 1
  ) {
    pattern.push(...pattern.splice(0, rotationSize));
  }
  state.phase = phase;
  state.queue = pattern;
  if (phaseChanged) state.comboStep = 0;
}

function isAvailable(action, phase, context) {
  if (phase === 3 && action === "summon") return false;
  if (action === "summon") return context.guardCount < QUEEN_SUMMON_CAP;
  if (action === "voidWell") return context.hazardCount < QUEEN_HAZARD_CAP;
  return true;
}

function recordActionMeta(state, phase) {
  if (phase !== 3) {
    state.lastActionMeta = Object.freeze({
      phase,
      comboId: null,
      comboStep: 0,
      comboLength: 0,
      continuesCombo: false,
    });
    return;
  }

  if (state.comboStep === 0) {
    state.comboSerial += 1;
    state.comboStep = 1;
  } else {
    state.comboStep = 0;
  }
  const comboStep = state.comboStep === 1 ? 1 : 2;
  state.lastActionMeta = Object.freeze({
    phase,
    comboId: `queen-combo-${state.comboSerial}`,
    comboStep,
    comboLength: 2,
    continuesCombo: comboStep === 1,
  });
}

export function nextQueenAction(state, phase, context = {}) {
  const safeContext = {
    guardCount: context.guardCount ?? 0,
    hazardCount: context.hazardCount ?? 0,
  };
  if (state.phase !== phase || state.queue.length === 0) refillQueue(state, phase);

  let action = null;
  for (let attempts = 0; attempts < state.queue.length; attempts += 1) {
    const candidate = state.queue.shift();
    const family = ACTION_FAMILY[candidate];
    if (isAvailable(candidate, phase, safeContext) && family !== state.lastFamily) {
      action = candidate;
      break;
    }
    state.queue.push(candidate);
  }

  if (!action) {
    const fallback = phase >= 2 ? ["royalSlam", "royalVolley", "royalDash"] : ["royalSlam", "royalVolley"];
    action = fallback.find((candidate) => ACTION_FAMILY[candidate] !== state.lastFamily) ?? fallback[0];
  }

  state.lastAction = action;
  state.lastFamily = ACTION_FAMILY[action];
  recordActionMeta(state, phase);
  return action;
}

export function queenActionFamily(action) {
  return ACTION_FAMILY[action] ?? "unknown";
}

export function queenPhaseTiming(phase) {
  return QUEEN_PHASE_TIMING[phase] ?? QUEEN_PHASE_TIMING[1];
}

export { PHASE_PATTERNS };
