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
    Object.freeze(["royalLance", "royalDash", "voidWell", "royalSlam", "royalVolley", "summon"]),
    Object.freeze(["teleport", "royalSlam", "royalFan", "royalDash", "royalLance", "voidWell"]),
  ]),
});

export const QUEEN_PHASE_THRESHOLDS = Object.freeze([0.7, 0.35]);
export const QUEEN_SUMMON_CAP = 5;
export const QUEEN_HAZARD_CAP = 2;

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
  };
}

function refillQueue(state, phase) {
  const patterns = PHASE_PATTERNS[phase];
  const pattern = [...state.rng.pick(patterns)];
  while (pattern.length > 1 && ACTION_FAMILY[pattern[0]] === state.lastFamily) {
    pattern.push(pattern.shift());
  }
  state.phase = phase;
  state.queue = pattern;
}

function isAvailable(action, context) {
  if (action === "summon") return context.guardCount < QUEEN_SUMMON_CAP;
  if (action === "voidWell") return context.hazardCount < QUEEN_HAZARD_CAP;
  return true;
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
    if (isAvailable(candidate, safeContext) && family !== state.lastFamily) {
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
  return action;
}

export function queenActionFamily(action) {
  return ACTION_FAMILY[action] ?? "unknown";
}

export { PHASE_PATTERNS };
