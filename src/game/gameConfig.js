export const GAME_TITLE = "Reaper of the Hollow Crown";

export const RUN_CONFIG = Object.freeze({
  totalFloors: 10,
  roomsPerFloor: 3,
  fixedStep: 1 / 60,
  maxFixedSteps: 5,
  roomClearDelay: 0.8,
  roomRecoveryPercent: 0.15,
  floorRecoveryPercent: 0.24,
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
    invulnerability: 0.29,
    cooldown: 0.64,
    steeringRate: 3.2,
    exitSpeed: 13.5,
    momentumDuration: 0.22,
    momentumDecay: 14,
    reverseBrakeMultiplier: 2.6,
  }),
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

export const DIFFICULTY = Object.freeze({
  story: Object.freeze({ enemyHealth: 0.78, enemyDamage: 0.72, enemySpeed: 0.92 }),
  standard: Object.freeze({ enemyHealth: 1, enemyDamage: 1, enemySpeed: 1 }),
  ruthless: Object.freeze({ enemyHealth: 1.25, enemyDamage: 1.22, enemySpeed: 1.08 }),
});
