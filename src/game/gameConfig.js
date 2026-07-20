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

export const DEATH_DEFIANCE_GRANT_CAP = 2;

export const PROGRESSION_TRANSFORMATION_CONFIG = Object.freeze({
  farReachClaim: Object.freeze({
    recallRadiusPerRank: 0.25,
    recallPullPerRank: 0.35,
    cleaveRadiusPerRank: 0.15,
  }),
  graveEdgeCharge: Object.freeze({ poiseDamagePerRank: 0.35 }),
  harvestCrownClaim: Object.freeze({ harvestUnitsPerRank: HARVEST_CONFIG.gainUnits.upgradeModifier }),
  hollowStepAfterimage: Object.freeze({ damagePerRank: 0.45 }),
  perfectEclipsePerfectDash: Object.freeze({ harvestUnitsPerRank: HARVEST_CONFIG.gainUnits.upgradeModifier }),
  reapingPassageDashAttack: Object.freeze({ damagePerRank: 0.35, arcPerRank: 0.2 }),
  royalBloodWounded: Object.freeze({ healthThreshold: 0.4, damagePerRank: 0.25, poisePerRank: 0.2 }),
  soulSiphonAggressiveHeal: Object.freeze({ damageHealingPerRank: 0.03, actionHealthCapPerRank: 10 }),
  moonwellRenewalRetaliation: Object.freeze({ damagePerRank: 28, poiseDamagePerRank: 32 }),
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

/**
 * Immutable scalar and behavioral rules copied into a run when difficulty is confirmed.
 * Attack budgets are simultaneous committed actions, not enemy population caps.
 */
function difficultyProfile(definition) {
  return Object.freeze({
    ...definition,
    attackBudgets: Object.freeze({ ...definition.attackBudgets }),
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
    windupMultiplier: 1,
    cooldownMultiplier: 1,
    attackBudgets: { total: 5, melee: 3, ranged: 2, area: 1 },
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
    windupMultiplier: 0.88,
    cooldownMultiplier: 0.84,
    attackBudgets: { total: 6, melee: 3, ranged: 3, area: 2 },
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
