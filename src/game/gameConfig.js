export const GAME_TITLE = "The Saviour";

export const RUN_CONFIG = Object.freeze({
  totalFloors: 10,
  roomsPerFloor: 3,
  fixedStep: 1 / 60,
  maxFixedSteps: 5,
  roomClearDelay: 0.8,
  roomRecoveryPercent: 0.15,
  floorRecoveryPercent: 0.24,
});

export const ENDING_TIMING = Object.freeze({
  decisionDurationMs: 5_000,
  fadeDurationMs: 1_200,
  endingStrike: Object.freeze({
    A0: 0,
    T: 0.14,
    C: 0.34,
    R: 0.78,
  }),
});

export const PORTAL_CONFIG = Object.freeze({
  interactionRadius: 1.85,
  clearanceRadius: 2.4,
  traversalDuration: 0.82,
  launchPeakAt: 0.32,
  launchHeight: 1.05,
  fallDepth: 2.55,
});

export const PLAYER_CONFIG = Object.freeze({
  maxHealth: 140,
  speed: 9.2,
  radius: 0.58,
  baseDamageMultiplier: 1,
  baseReachMultiplier: 1,
  hitInvulnerability: 0.52,
  hitSeverity: Object.freeze({
    heavyThresholdRatio: 0.18,
  }),
  combat: Object.freeze({
    attackBuffer: 0.14,
    dashBuffer: 0.12,
    heavyBuffer: 0.12,
    comboGrace: 0.28,
    attackMoveScale: 0.72,
    chargeMoveScale: 0.42,
  }),
  dash: Object.freeze({
    speed: 25,
    duration: 0.19,
    perfectOpen: 0,
    perfectClose: 0.12,
    invulnerability: 0.29,
    cooldown: 0.64,
    steeringRate: 3.2,
    exitSpeed: 13.5,
    momentumDuration: 0.22,
    momentumDecay: 14,
    reverseBrakeMultiplier: 2.6,
  }),
});

export const HARVEST_CONFIG = Object.freeze({
  maxUnits: 300,
  unitsPerSegment: 100,
  floorMinimumUnits: 100,
  closeHitRange: 3.5,
  rememberedEventIds: 512,
  gainUnits: Object.freeze({
    closeHit: 14,
    critical: 22,
    kill: 34,
    perfectDash: 28,
    perfectCharge: 28,
    upgradeModifier: 10,
  }),
});

export const HIT_STOP_CONFIG = Object.freeze({
  maxDuration: 6 / 60,
  tiers: Object.freeze({ light: 1, medium: 2, heavy: 3 }),
  policies: Object.freeze({
    critical: Object.freeze({ duration: 2 / 60, tier: "light" }),
    comboFinisher: Object.freeze({ duration: 3 / 60, tier: "medium" }),
    chargePartial: Object.freeze({ duration: 2 / 60, tier: "light" }),
    chargeFull: Object.freeze({ duration: 3 / 60, tier: "medium" }),
    chargePerfect: Object.freeze({ duration: 4 / 60, tier: "heavy" }),
    lineCharge: Object.freeze({ duration: 4 / 60, tier: "heavy" }),
    claimRecall: Object.freeze({ duration: 3 / 60, tier: "medium" }),
  }),
});

export const CLAIM_CONFIG = Object.freeze({
  costSegments: 1,
  inputBuffer: 0.14,
  movementScale: 0.62,
  maxTargetsPerPass: 64,
  outbound: Object.freeze({
    duration: 0.32,
    releaseAt: 0.08,
    distance: 7.2,
    radius: 0.72,
    damage: 46,
    poiseDamage: 32,
  }),
  recall: Object.freeze({
    duration: 0.28,
    radius: 0.8,
    damage: 38,
    poiseDamage: 38,
    pullStrength: 7,
    followupBuffer: 0.12,
  }),
  empoweredWindow: 0.22,
  empoweredCleave: Object.freeze({
    duration: 0.44,
    activeStart: 0.08,
    activeEnd: 0.25,
    cancelToDashAt: 0.25,
    radius: 5.4,
    arc: Math.PI * 1.15,
    damage: 76,
    poiseDamage: 60,
  }),
  recoveryDuration: 0.18,
});

export const PROGRESSION_BALANCE_LIMITS = Object.freeze({
  actionDamageBonus: 0.9,
  criticalChance: 0.3,
  dashCooldownSeconds: 0.48,
  maxHealth: 180,
  automaticRoomRecovery: 0.25,
  harvestRefundPerAction: 25,
  harvestRefundPerTechnique: 50,
});

export const OATH_PROGRESSION_CONFIG = Object.freeze({
  techniqueChoiceFloors: Object.freeze([1, 2, 3, 4, 5]),
  oathRankUpFloors: Object.freeze([6, 7, 8, 9]),
  oathMaxRank: 2,
  techniqueSlotCount: 5,
});

export const CHARGE_CONFIG = Object.freeze({
  timing: Object.freeze({
    minimumRelease: 0.12,
    fullThreshold: 0.55,
    perfectOpen: 0.72,
    perfectClose: 0.82,
    forcedRelease: 0.9,
  }),
  qualities: Object.freeze({
    partial: Object.freeze({ damageMultiplier: 0.78, rangeMultiplier: 0.92, poiseDamage: 30, harvestUnits: 0 }),
    full: Object.freeze({ damageMultiplier: 1, rangeMultiplier: 1, poiseDamage: 46, harvestUnits: 0 }),
    perfect: Object.freeze({ damageMultiplier: 1.22, rangeMultiplier: 1.08, poiseDamage: 62, harvestUnits: 28 }),
  }),
});

export const STRAIGHT_CHARGE_CONFIG = Object.freeze({
  costSegments: 1,
  dashAllowance: 1,
  holdThreshold: 0.18,
  buildupDuration: 0.72,
  minimumPower: 0.68,
  minimumRange: 0.8,
  minimumWidth: 0.86,
});

export const SCYTHE_ATTACKS = Object.freeze([
  Object.freeze({
    name: "Crescent Cut",
    duration: 0.31,
    activeStart: 0.075,
    activeEnd: 0.19,
    range: 4.25,
    arc: Math.PI * 0.78,
    damage: 28,
    knockback: 4.5,
    swing: 1,
    moveScale: 0.82,
    queueOpen: 0.13,
    chainAt: 0.25,
    cancelToDashAt: 0.19,
    nextComboIndex: 1,
  }),
  Object.freeze({
    name: "Grave Return",
    duration: 0.35,
    activeStart: 0.08,
    activeEnd: 0.22,
    range: 4.65,
    arc: Math.PI * 0.88,
    damage: 34,
    knockback: 5.2,
    swing: -1,
    moveScale: 0.78,
    queueOpen: 0.15,
    chainAt: 0.29,
    cancelToDashAt: 0.22,
    nextComboIndex: 2,
  }),
  Object.freeze({
    name: "Harvest Moon",
    duration: 0.47,
    activeStart: 0.11,
    activeEnd: 0.3,
    range: 5.25,
    arc: Math.PI * 1.08,
    damage: 52,
    knockback: 8,
    swing: 1,
    moveScale: 0.64,
    cancelToDashAt: 0.31,
    nextComboIndex: null,
  }),
]);

export const HEAVY_ATTACK = Object.freeze({
  name: "Death's Orbit",
  duration: 0.72,
  activeStart: 0.2,
  activeEnd: 0.46,
  range: 5.5,
  arc: Math.PI * 2,
  damage: 74,
  knockback: 10,
  cooldown: 1.35,
  moveScale: 0.42,
  cancelToDashAt: 0.48,
  nextComboIndex: null,
});

export const STRAIGHT_CHARGE_ATTACK = Object.freeze({
  name: "Grave Line",
  shape: "line",
  duration: 0.62,
  activeStart: 0.17,
  activeEnd: 0.31,
  range: 9.4,
  width: 2.45,
  damage: 82,
  poiseDamage: 72,
  knockback: 12,
  moveScale: 0.32,
  cancelToDashAt: 0.34,
  nextComboIndex: null,
});

export const DASH_ATTACK = Object.freeze({
  name: "Reaping Passage",
  duration: 0.28,
  activeStart: 0.025,
  activeEnd: 0.2,
  range: 5.8,
  arc: Math.PI * 0.64,
  damage: 42,
  knockback: 7,
  swing: 1,
  moveScale: 0.8,
  queueOpen: 0.12,
  chainAt: 0.235,
  cancelToDashAt: 0.2,
  nextComboIndex: 1,
});

export const CAMERA_CONFIG = Object.freeze({
  pitch: 43 * (Math.PI / 180),
  yaw: 45 * (Math.PI / 180),
  baseViewHeight: 18,
  followRate: 8.5,
  aimLookAhead: 2.1,
  bossZoomMultiplier: 1.2,
});

export const PERFORMANCE_BUDGET = Object.freeze({
  cpuP95Ms: 6,
  gpuP95Ms: 8,
  drawCalls: 100,
  triangles: 200_000,
  stressEnemies: 35,
  stressParticles: 200,
});

export const DEFAULT_DIFFICULTY_ID = "standard";
export const DIFFICULTY_IDS = Object.freeze(["relaxed", "standard", "ruthless"]);
export const DEFAULT_RUN_TYPE = "normal";
export const RUN_TYPE_IDS = Object.freeze(["normal", "speedrun"]);

export const ENEMY_FLOOR_BAND_STAT_SCALARS = Object.freeze({
  early: Object.freeze({
    floorStart: 1,
    floorEnd: 3,
    healthByFloor: Object.freeze([1, 1.078, 1.156]),
    damage: 1,
    speed: 1,
  }),
  middle: Object.freeze({
    floorStart: 4,
    floorEnd: 6,
    healthByFloor: Object.freeze([1.234, 1.312, 1.39]),
    damage: 1.005,
    speed: 1.004,
  }),
  late: Object.freeze({
    floorStart: 7,
    floorEnd: 10,
    healthByFloor: Object.freeze([1.468, 1.546, 1.624, 1.702]),
    damage: 1.01,
    speed: 1.008,
  }),
});

export const ENEMY_FAMILY_STAT_SCALARS = Object.freeze({
  thrall: Object.freeze({ health: 0.97, damage: 0.99, speed: 1.01 }),
  reaver: Object.freeze({ health: 1, damage: 1, speed: 1 }),
  boneguard: Object.freeze({ health: 1.035, damage: 1.02, speed: 0.99 }),
  hexer: Object.freeze({ health: 0.97, damage: 1, speed: 1 }),
  wraith: Object.freeze({ health: 1, damage: 1.01, speed: 1.01 }),
  bombardier: Object.freeze({ health: 1.02, damage: 1.02, speed: 0.99 }),
});

/**
 * Immutable scalar and behavioral rules copied into a run when difficulty is confirmed.
 * Attack budgets are simultaneous committed actions, not enemy population caps.
 */
function difficultyProfile(definition) {
  return Object.freeze({
    ...definition,
    attackBudgets: Object.freeze({ ...definition.attackBudgets }),
    nonBossStats: Object.freeze({ ...definition.nonBossStats }),
    bossStats: Object.freeze({ ...definition.bossStats }),
  });
}

export const DIFFICULTY = Object.freeze({
  relaxed: difficultyProfile({
    id: "relaxed",
    label: "Relaxed",
    description: "More recovery and fewer overlapping threats, with the complete combat and build system preserved.",
    enemyHealth: 0.82,
    enemyDamage: 0.76,
    enemySpeed: 0.94,
    populationMultiplier: 0.8,
    nonBossStats: { health: 0.82, damage: 0.76, speed: 0.94 },
    bossStats: { health: 0.82, damage: 0.76, speed: 0.94 },
    windupMultiplier: 1.18,
    cooldownMultiplier: 1.18,
    attackBudgets: { total: 3, melee: 2, ranged: 1, area: 1 },
    compositionPressure: 0.82,
    poiseMultiplier: 0.88,
    bossCadenceMultiplier: 0.88,
  }),
  standard: difficultyProfile({
    id: "standard",
    label: "Standard",
    description: "The intended balance of readable squad pressure, build choices, and mechanical execution.",
    enemyHealth: 1,
    enemyDamage: 1,
    enemySpeed: 1,
    populationMultiplier: 1,
    nonBossStats: { health: 1.2, damage: 1.075, speed: 1.06 },
    bossStats: { health: 1, damage: 1, speed: 1 },
    windupMultiplier: 1,
    cooldownMultiplier: 1,
    attackBudgets: { total: 7, melee: 4, ranged: 3, area: 2 },
    compositionPressure: 1,
    poiseMultiplier: 1,
    bossCadenceMultiplier: 1,
  }),
  ruthless: difficultyProfile({
    id: "ruthless",
    label: "Ruthless",
    description: "Tighter telegraphs, coordinated overlaps, and specialist-heavy squads demand a coherent build and precise play.",
    enemyHealth: 1.15,
    enemyDamage: 1.14,
    enemySpeed: 1.08,
    populationMultiplier: 1.15,
    nonBossStats: { health: 1.4, damage: 1.22, speed: 1.14 },
    bossStats: { health: 1.15, damage: 1.14, speed: 1.08 },
    windupMultiplier: 0.88,
    cooldownMultiplier: 0.84,
    attackBudgets: { total: 10, melee: 5, ranged: 4, area: 3 },
    compositionPressure: 1.24,
    poiseMultiplier: 1.14,
    bossCadenceMultiplier: 1.2,
  }),
});

export function getDifficultyProfile(id, { fallback = true } = {}) {
  const profile = DIFFICULTY[id];
  if (profile) return profile;
  if (fallback) return DIFFICULTY[DEFAULT_DIFFICULTY_ID];
  throw new RangeError(`Unknown difficulty ID: ${id}`);
}

function statBandForFloor(floor) {
  if (!Number.isInteger(floor) || floor < 1 || floor > 10) throw new RangeError("Enemy stat floor must be from 1 to 10.");
  if (floor <= 3) return ENEMY_FLOOR_BAND_STAT_SCALARS.early;
  if (floor <= 6) return ENEMY_FLOOR_BAND_STAT_SCALARS.middle;
  return ENEMY_FLOOR_BAND_STAT_SCALARS.late;
}

export function resolveEnemyStatScalars({ type, floor, difficulty = DEFAULT_DIFFICULTY_ID }) {
  if (!Number.isInteger(floor) || floor < 1 || floor > 10) throw new RangeError("Enemy stat floor must be from 1 to 10.");
  const profile = typeof difficulty === "string" ? getDifficultyProfile(difficulty) : difficulty;
  if (!profile || !profile.nonBossStats || !profile.bossStats) throw new TypeError("Enemy stat scaling requires a complete difficulty profile.");
  if (type === "queen") {
    return Object.freeze({
      health: profile.bossStats.health * (1 + Math.max(0, floor - 1) * 0.02),
      damage: profile.bossStats.damage,
      speed: profile.bossStats.speed,
    });
  }
  const family = ENEMY_FAMILY_STAT_SCALARS[type];
  if (!family) throw new RangeError(`Unknown non-boss enemy family: ${type}`);
  const band = statBandForFloor(floor);
  const floorHealth = band.healthByFloor[floor - band.floorStart];
  return Object.freeze({
    health: floorHealth * profile.nonBossStats.health * family.health,
    damage: band.damage * profile.nonBossStats.damage * family.damage,
    speed: band.speed * profile.nonBossStats.speed * family.speed,
  });
}
